import type { ReflectionKey, StudyKey } from "@/types/record";

export const REFLECTION_SECTIONS: Array<{ key: ReflectionKey; no: string; title: string; prompt: string }> = [
  { key: "remains", no: "01", title: "오늘 내게 남은 한 문장", prompt: "원문에서 마음에 머문 문장을 붙잡아 두세요." },
  { key: "thesis", no: "02", title: "말씀의 핵심 논지", prompt: "설교자가 전하려 한 중심을 내 말로 정리합니다." },
  { key: "learned", no: "03", title: "새롭게 이해한 사실", prompt: "처음 알게 되었거나 달리 보이게 된 것." },
  { key: "apply", no: "04", title: "나의 삶에 적용할 질문", prompt: "오늘과 이번 주에 스스로에게 던질 질문." },
  { key: "prayer", no: "05", title: "오늘의 기도", prompt: "말씀 앞에서 드리는 짧은 기도." },
];

export const STUDY_SECTIONS: Array<{ key: StudyKey; title: string; prompt: string }> = [
  { key: "scripture", title: "본문과 해석", prompt: "성경 본문(장·절)과 해석 메모. 본문은 직접 확인한 내용만 적으세요." },
  { key: "questions", title: "질문", prompt: "들으며 생긴 질문, 더 찾아볼 것." },
  { key: "application", title: "삶의 적용", prompt: "말씀에서 이끌어 낸 구체적 실천." },
  { key: "prayerTopics", title: "기도 제목", prompt: "개인과 공동체를 위한 기도 제목." },
];
