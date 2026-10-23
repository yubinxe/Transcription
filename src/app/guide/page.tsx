import Link from "next/link";

export const metadata = { title: "사용 안내" };

const STEPS = [
  {
    t: "링크를 붙여넣습니다",
    b: "홈 화면 입력창에 YouTube 링크(일반·단축·Shorts·모바일 공유 링크)를 붙여넣으면 자동으로 영상 정보를 확인합니다. ‘기록 시작하기’를 누르면 기록이 만들어지고 영상이 연결됩니다.",
  },
  {
    t: "텍스트를 확보합니다",
    b: "가장 확실한 방법은 YouTube 영상의 ‘스크립트 표시’에서 내용을 복사해 붙여넣는 것입니다. 시간 정보까지 인식되어 문장과 영상 재생 위치가 연결됩니다. 자막 파일(SRT·VTT)이 있거나, 사용 권한이 있는 녹음 파일이 있다면 그것으로도 전사할 수 있습니다.",
  },
  {
    t: "다시 읽고 교정합니다",
    b: "원문은 문단으로 정돈되어 표시됩니다. 시각을 누르면 그 지점부터 재생되고, 재생 중인 문장이 은은하게 표시됩니다. ‘교정’에서 오탈자를 고칠 수 있으며 원본 전사는 언제든 복원할 수 있습니다.",
  },
  {
    t: "문장을 붙잡아 묵상합니다",
    b: "마음에 남는 문장을 드래그하면 ‘문장 저장’과 ‘묵상에 인용’이 나타납니다. 저장한 문장은 ‘말씀 연구’에, 인용한 문장은 ‘나의 묵상’의 해당 칸에 원문 그대로 첨부됩니다.",
  },
  {
    t: "내보내고 백업합니다",
    b: "TXT·Markdown·SRT·VTT·JSON으로 내보낼 수 있습니다. 설정의 ‘백업과 복원’으로 전체 기록을 한 파일로 보관하세요.",
  },
];

export default function GuidePage() {
  return (
    <div className="mx-auto max-w-[1320px] px-5 pt-14 md:px-10 md:pt-20">
      <div className="grid gap-10 md:grid-cols-12">
        <header className="md:col-span-4">
          <p className="eyebrow">Guide</p>
          <h1 className="serif mt-4 text-[2.25rem] font-semibold tracking-[-0.03em] md:text-[2.5rem]">
            사용 안내
          </h1>
          <p className="mt-4 max-w-xs text-[0.9375rem] leading-relaxed text-muted">
            새벽기록은 듣고, 읽고, 새기는 하나의 흐름으로 설계되었습니다.
          </p>
        </header>
        <ol className="md:col-span-8">
          {STEPS.map((s, i) => (
            <li
              key={s.t}
              className="grid grid-cols-[2.5rem_1fr] gap-4 border-t border-border py-8 first:border-ink"
            >
              <span className="numeral pt-1 text-[0.875rem] text-gold-deep">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <h2 className="serif text-[1.25rem] tracking-[-0.015em]">{s.t}</h2>
                <p className="mt-3 max-w-[38rem] text-[0.9375rem] leading-[1.85] text-ink-soft">{s.b}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <section
        id="limits"
        className="mt-20 grid scroll-mt-24 gap-10 border-t border-ink pt-10 md:grid-cols-12"
      >
        <h2 className="serif text-[1.5rem] tracking-[-0.02em] md:col-span-4">
          무엇이 가능하고, 무엇이 제한되는가
        </h2>
        <div className="space-y-5 text-[0.9375rem] leading-[1.85] text-ink-soft md:col-span-8">
          <p>
            <strong className="font-semibold text-ink">YouTube 링크만으로 자동 전사</strong>는 항상 보장되지
            않습니다. 공식 YouTube Data API는 영상 소유자(또는 관리자)에게만 자막 다운로드를 허용합니다. 본인
            채널 영상이라면 Google 계정 연결로 가져올 수 있습니다(서버에 OAuth 클라이언트가 설정된 경우).
          </p>
          <p>
            공개 자막을 읽는 실험 기능은 공식 API가 아니어서 기본적으로 꺼져 있습니다. 서버 관리자가 허용하고
            설정에서 켜야 동작하며, YouTube 측 변경으로 언제든 중단될 수 있습니다.
          </p>
          <p>
            <strong className="font-semibold text-ink">기기 내 음성 인식</strong>은 Whisper 다국어 모델을
            브라우저에서 실행합니다. WebGPU를 지원하는 데스크톱 Chrome·Edge에서 가장 빠르며, 지원하지 않으면
            CPU로 실행되어 영상 길이보다 오래 걸릴 수 있습니다. 1시간 설교는 기기에 따라 수 분에서 수십 분이
            소요됩니다.
          </p>
          <p>자동 전사는 완벽하지 않습니다. 인명·지명·성경 구절은 반드시 원문을 확인해 교정해 주세요.</p>
        </div>
      </section>

      <section
        id="privacy"
        className="mt-20 grid scroll-mt-24 gap-10 border-t border-ink pt-10 md:grid-cols-12"
      >
        <h2 className="serif text-[1.5rem] tracking-[-0.02em] md:col-span-4">개인정보와 저작권</h2>
        <div className="space-y-5 text-[0.9375rem] leading-[1.85] text-ink-soft md:col-span-8">
          <ul className="space-y-3">
            <li>
              기록, 전사문, 메모, 업로드한 파일은 이 브라우저(IndexedDB)에만 저장되며 서버로 전송되지
              않습니다.
            </li>
            <li>
              기기 내 음성 인식은 음성을 외부로 보내지 않습니다. 모델 파일만 Hugging Face에서 내려받습니다.
            </li>
            <li>
              서버를 거치는 요청은 영상 제목 확인(YouTube oEmbed)과, 허용된 경우의 공개 자막 요청뿐입니다.
              서버는 이를 저장하지 않습니다.
            </li>
            <li>faster-whisper 서버를 연결하면 파일은 사용자가 지정한 주소로만 전송됩니다.</li>
          </ul>
          <p>
            전사문은 개인 학습을 위한 것입니다. 설교·강연의 저작권은 원저작자에게 있으니, 외부에 공유하거나
            재배포할 때는 권리자의 허락을 확인해 주세요. 새벽기록은 어떤 교회나 단체의 공식 서비스가 아닙니다.
          </p>
          <Link href="/settings#backup" className="link-quiet inline-block text-[0.875rem]">
            백업 설정으로
          </Link>
        </div>
      </section>
    </div>
  );
}
