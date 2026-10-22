import type { Preferences } from "@/lib/storage/preferences";
import type { DeviceCapabilities } from "./capabilities";
import { getModel } from "./models";
import { createLocalWhisperProvider } from "./providers/local-whisper";
import { createRemoteWhisperProvider } from "./providers/remote-whisper";

export function resolveAsrConfig(prefs: Preferences, caps: DeviceCapabilities | null) {
  const device =
    prefs.asr.device === "auto"
      ? (caps?.recommendedDevice ?? "wasm")
      : prefs.asr.device === "webgpu" && caps && !caps.webgpu
        ? "wasm"
        : prefs.asr.device;
  let modelId = prefs.asr.modelId === "auto" ? (caps?.recommendedModel ?? "base") : prefs.asr.modelId;
  if (getModel(modelId).webgpuOnly && device !== "webgpu") modelId = "small";
  return { device, modelId, language: prefs.asr.language } as const;
}

export function createMediaProvider(prefs: Preferences, caps: DeviceCapabilities | null) {
  if (prefs.asr.backend === "remote")
    return createRemoteWhisperProvider(prefs.asr.remoteEndpoint, prefs.asr.language);
  return createLocalWhisperProvider(resolveAsrConfig(prefs, caps));
}
