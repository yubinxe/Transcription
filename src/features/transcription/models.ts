/**
 * Multilingual Whisper checkpoints converted to ONNX (Hugging Face, onnx-community).
 * English-only ".en" checkpoints are deliberately excluded: they cannot transcribe Korean.
 * Parameter counts are from the original OpenAI Whisper release. Download size is measured
 * at runtime from the actual files and shown to the user before/while loading.
 */
export interface WhisperModelOption {
  id: string;
  repo: string;
  label: string;
  params: string;
  note: string;
  /** Rough minimum RAM (GB) for comfortable use. Advisory only. */
  minMemoryGb: number;
  webgpuOnly?: boolean;
}

export const WHISPER_MODELS: WhisperModelOption[] = [
  {
    id: "base",
    repo: "onnx-community/whisper-base",
    label: "기본",
    params: "7,400만 매개변수",
    note: "가볍고 빠릅니다. 한국어 정확도는 낮은 편이라 교정이 필요할 수 있습니다.",
    minMemoryGb: 4,
  },
  {
    id: "small",
    repo: "onnx-community/whisper-small",
    label: "균형",
    params: "2억 4,400만 매개변수",
    note: "한국어 설교 전사에 권장하는 기본값입니다.",
    minMemoryGb: 6,
  },
  {
    id: "large-v3-turbo",
    repo: "onnx-community/whisper-large-v3-turbo",
    label: "정밀",
    params: "8억 900만 매개변수",
    note: "가장 정확하지만 다운로드가 크고 WebGPU가 있는 데스크톱을 전제로 합니다.",
    minMemoryGb: 12,
    webgpuOnly: true,
  },
];

export function getModel(id: string): WhisperModelOption {
  return WHISPER_MODELS.find((m) => m.id === id) ?? WHISPER_MODELS[1]!;
}

export type AsrDevice = "webgpu" | "wasm";

export function dtypeFor(device: AsrDevice, modelId: string) {
  if (device === "webgpu") {
    return {
      encoder_model: modelId === "large-v3-turbo" ? "fp16" : "fp32",
      decoder_model_merged: "q4",
    } as const;
  }
  return { encoder_model: "q8", decoder_model_merged: "q8" } as const;
}
