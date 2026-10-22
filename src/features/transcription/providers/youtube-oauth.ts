import { parseVtt } from "../parsers";
import {
  TranscriptionError,
  type TranscriptInput,
  type TranscriptionOptions,
  type TranscriptProvider,
  type TranscriptResult,
} from "@/types/transcript";

/**
 * Official YouTube Data API v3 path. captions.download only works for videos the
 * signed-in Google account owns or manages — that is an API rule, not a limitation of
 * this app. Requires NEXT_PUBLIC_GOOGLE_CLIENT_ID (OAuth web client). The access token
 * lives only in memory for the page session.
 */
export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
const SCOPE = "https://www.googleapis.com/auth/youtube.force-ssl";

interface TokenClient {
  requestAccessToken(opts?: { prompt?: string }): void;
}
interface GoogleOAuth {
  accounts: {
    oauth2: {
      initTokenClient(cfg: {
        client_id: string;
        scope: string;
        callback: (r: { access_token?: string; error?: string }) => void;
      }): TokenClient;
    };
  };
}

let token: string | null = null;

function loadGis(): Promise<GoogleOAuth> {
  const w = window as unknown as { google?: GoogleOAuth };
  if (w.google?.accounts?.oauth2) return Promise.resolve(w.google);
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = () => (w.google ? resolve(w.google) : reject(new Error("gis")));
    s.onerror = () => reject(new Error("gis"));
    document.head.appendChild(s);
  });
}

async function getToken(): Promise<string> {
  if (token) return token;
  const google = await loadGis().catch(() => {
    throw new TranscriptionError("network", "Google 로그인 모듈을 불러오지 못했습니다.");
  });
  return new Promise((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: SCOPE,
      callback: (r) => {
        if (r.access_token) {
          token = r.access_token;
          resolve(r.access_token);
        } else reject(new TranscriptionError("caption_forbidden", "Google 계정 권한이 승인되지 않았습니다."));
      },
    });
    client.requestAccessToken({ prompt: "" });
  });
}

export const youtubeOAuthProvider: TranscriptProvider = {
  id: "youtube-oauth",
  label: "내 채널 영상 자막 (YouTube API)",
  canHandle: (input) => input.kind === "youtube" && !!GOOGLE_CLIENT_ID,
  async transcribe(input: TranscriptInput, options: TranscriptionOptions = {}): Promise<TranscriptResult> {
    if (input.kind !== "youtube") throw new TranscriptionError("invalid_input", "YouTube 링크가 필요합니다.");
    if (!GOOGLE_CLIENT_ID) throw new TranscriptionError("provider_disabled", "Google OAuth가 구성되지 않았습니다.");
    options.onStage?.("checking_captions");
    const access = await getToken();
    const headers = { Authorization: `Bearer ${access}` };
    const list = await fetch(
      `https://www.googleapis.com/youtube/v3/captions?part=snippet&videoId=${encodeURIComponent(input.videoId)}`,
      { headers, signal: options.signal },
    );
    if (list.status === 403) throw new TranscriptionError("caption_forbidden", "이 영상의 자막을 내려받을 권한이 없습니다. 내 채널 영상에서만 가능합니다.");
    if (list.status === 404) throw new TranscriptionError("video_unavailable", "영상을 찾을 수 없습니다.");
    if (!list.ok) throw new TranscriptionError("network", `YouTube API 오류 (${list.status})`);
    const data = (await list.json()) as {
      items?: Array<{ id: string; snippet: { language: string; trackKind: string } }>;
    };
    const items = data.items ?? [];
    const pick =
      items.find((i) => i.snippet.language.startsWith("ko") && i.snippet.trackKind !== "asr") ??
      items.find((i) => i.snippet.language.startsWith("ko")) ??
      items[0];
    if (!pick) throw new TranscriptionError("no_captions", "이 영상에는 자막 트랙이 없습니다.");
    options.onStage?.("loading_captions");
    const dl = await fetch(`https://www.googleapis.com/youtube/v3/captions/${encodeURIComponent(pick.id)}?tfmt=vtt`, {
      headers,
      signal: options.signal,
    });
    if (dl.status === 403) throw new TranscriptionError("caption_forbidden", "이 자막을 내려받을 권한이 없습니다.");
    if (!dl.ok) throw new TranscriptionError("network", `자막 다운로드 오류 (${dl.status})`);
    const vtt = await dl.text();
    const segments = parseVtt(vtt).map((s) => ({ ...s, source: "youtube_caption" as const }));
    const last = segments[segments.length - 1];
    return {
      segments,
      method: "youtube_oauth",
      language: pick.snippet.language,
      raw: { fileName: `${input.videoId}.${pick.snippet.language}.vtt`, content: vtt },
      durationMs: last?.endMs ?? null,
      warnings: pick.snippet.trackKind === "asr" ? ["자동 생성 자막입니다."] : [],
    };
  },
};
