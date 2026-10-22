import type { AsrDevice } from "./models";

export interface DeviceCapabilities {
  webgpu: boolean;
  /** navigator.deviceMemory (Chromium only, capped at 8). null when unknown. */
  memoryGb: number | null;
  isIOS: boolean;
  isMobile: boolean;
  workers: boolean;
  audioDecode: boolean;
  recommendedDevice: AsrDevice;
  recommendedModel: string;
}

interface GpuNavigator {
  gpu?: { requestAdapter(): Promise<unknown | null> };
  deviceMemory?: number;
}

export async function detectCapabilities(): Promise<DeviceCapabilities> {
  const nav = (typeof navigator !== "undefined" ? navigator : {}) as Navigator & GpuNavigator;
  let webgpu = false;
  try {
    webgpu = !!nav.gpu && !!(await nav.gpu.requestAdapter());
  } catch {
    webgpu = false;
  }
  const ua = nav.userAgent ?? "";
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && "ontouchend" in globalThis);
  const isMobile = isIOS || /Android|Mobile/i.test(ua);
  const memoryGb = typeof nav.deviceMemory === "number" ? nav.deviceMemory : null;
  const recommendedDevice: AsrDevice = webgpu ? "webgpu" : "wasm";
  const lowMemory = memoryGb != null && memoryGb < 6;
  const recommendedModel = !webgpu || lowMemory || isMobile ? "base" : "small";
  return {
    webgpu,
    memoryGb,
    isIOS,
    isMobile,
    workers: typeof Worker !== "undefined",
    audioDecode: typeof AudioContext !== "undefined" || typeof OfflineAudioContext !== "undefined",
    recommendedDevice,
    recommendedModel,
  };
}
