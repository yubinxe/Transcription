import { TranscriptionError } from "@/types/transcript";

export const ASR_SAMPLE_RATE = 16_000;
export const MAX_MEDIA_BYTES = 1024 * 1024 * 1024; // 1 GB
export const ACCEPTED_MEDIA = /^(audio|video)\//;
const ACCEPTED_EXT = /\.(mp3|m4a|aac|wav|ogg|oga|opus|webm|flac|mp4|mov|m4v)$/i;

export function validateMediaFile(file: File) {
  if (!ACCEPTED_MEDIA.test(file.type) && !ACCEPTED_EXT.test(file.name)) {
    throw new TranscriptionError(
      "unsupported_file",
      "음성·영상 파일만 전사할 수 있습니다. (mp3, m4a, wav, webm, mp4 등)",
    );
  }
  if (file.size > MAX_MEDIA_BYTES) {
    throw new TranscriptionError("file_too_large", "1GB를 넘는 파일은 브라우저에서 처리할 수 없습니다. 음성만 추출해 다시 시도해 주세요.");
  }
}

/** Decodes any browser-supported audio/video file into 16 kHz mono PCM. */
export async function decodeToMono16k(file: Blob): Promise<Float32Array> {
  const buf = await file.arrayBuffer();
  const Ctx: typeof AudioContext | undefined =
    typeof AudioContext !== "undefined"
      ? AudioContext
      : (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) throw new TranscriptionError("unsupported_file", "이 브라우저는 오디오 디코딩을 지원하지 않습니다.");
  let ctx: AudioContext;
  try {
    ctx = new Ctx({ sampleRate: ASR_SAMPLE_RATE });
  } catch {
    ctx = new Ctx();
  }
  try {
    const audio = await ctx.decodeAudioData(buf);
    const mono = mixToMono(audio);
    return audio.sampleRate === ASR_SAMPLE_RATE ? mono : resampleLinear(mono, audio.sampleRate, ASR_SAMPLE_RATE);
  } catch (e) {
    if (e instanceof RangeError) {
      throw new TranscriptionError("out_of_memory", "파일이 너무 길어 기기 메모리에서 디코딩하지 못했습니다. 파일을 나눠 업로드해 주세요.");
    }
    throw new TranscriptionError("unsupported_file", "오디오 트랙을 읽지 못했습니다. 다른 형식(mp3, m4a, wav)으로 시도해 주세요.");
  } finally {
    void ctx.close();
  }
}

function mixToMono(audio: AudioBuffer): Float32Array {
  if (audio.numberOfChannels === 1) return audio.getChannelData(0).slice();
  const out = new Float32Array(audio.length);
  for (let c = 0; c < audio.numberOfChannels; c++) {
    const data = audio.getChannelData(c);
    for (let i = 0; i < data.length; i++) out[i]! += data[i]! / audio.numberOfChannels;
  }
  return out;
}

export function resampleLinear(input: Float32Array, from: number, to: number): Float32Array {
  if (from === to) return input;
  const ratio = from / to;
  const out = new Float32Array(Math.floor(input.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const x = i * ratio;
    const i0 = Math.floor(x);
    const i1 = Math.min(i0 + 1, input.length - 1);
    const t = x - i0;
    out[i] = input[i0]! * (1 - t) + input[i1]! * t;
  }
  return out;
}

export function rms(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i]! * samples[i]!;
  return Math.sqrt(sum / samples.length);
}
