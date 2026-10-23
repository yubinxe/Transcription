export interface VideoMeta {
  videoId: string;
  title: string;
  channel: string | null;
  channelUrl: string | null;
  thumbnailUrl: string;
}

export type MetaResult =
  | { ok: true; meta: VideoMeta }
  | { ok: false; reason: "restricted" | "not_found" | "network" | "rate_limited" };

export async function fetchVideoMeta(videoId: string, signal?: AbortSignal): Promise<MetaResult> {
  try {
    const res = await fetch(`/api/youtube/meta?id=${encodeURIComponent(videoId)}`, { signal });
    if (res.ok) return { ok: true, meta: (await res.json()) as VideoMeta };
    if (res.status === 403) return { ok: false, reason: "restricted" };
    if (res.status === 404) return { ok: false, reason: "not_found" };
    if (res.status === 429) return { ok: false, reason: "rate_limited" };
    return { ok: false, reason: "network" };
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    return { ok: false, reason: "network" };
  }
}

export const META_FAILURE_MESSAGE: Record<Exclude<MetaResult, { ok: true }>["reason"], string> = {
  restricted:
    "비공개이거나 외부 재생이 제한된 영상일 수 있습니다. 제목을 직접 입력해 기록을 이어갈 수 있습니다.",
  not_found: "영상을 찾지 못했습니다. 삭제되었거나 주소가 잘못되었을 수 있습니다.",
  network: "영상 정보를 확인하지 못했습니다. 제목을 직접 입력해 계속할 수 있습니다.",
  rate_limited: "요청이 많습니다. 잠시 후 다시 시도해 주세요.",
};
