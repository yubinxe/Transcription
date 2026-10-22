import { LinkComposer } from "@/components/home/LinkComposer";
import { AlternateInputs } from "@/components/home/AlternateInputs";
import { RevivalStrip } from "@/components/home/RevivalStrip";
import { RecentRecords } from "@/components/home/RecentRecords";

const PRINCIPLES = [
  { en: "Listen", ko: "듣다", body: "영상과 음성을 그대로 두고, 들은 말을 시간과 함께 텍스트로 옮깁니다." },
  {
    en: "Read",
    ko: "읽다",
    body: "문단으로 다시 읽고, 찾고, 고칩니다. 원문은 언제든 되돌릴 수 있게 보존됩니다.",
  },
  {
    en: "Reflect",
    ko: "새기다",
    body: "붙잡은 문장을 묵상 노트로 옮기고, 오래 남을 나의 문장으로 정리합니다.",
  },
];

export default function HomePage() {
  return (
    <>
      <section className="mx-auto max-w-[1320px] px-5 pb-20 pt-16 md:px-10 md:pb-28 md:pt-28">
        <div className="max-w-[52rem]">
          <p className="eyebrow">A place to listen, read and reflect</p>
          <h1 className="serif mt-6 text-[2.375rem] font-semibold leading-[1.22] tracking-[-0.035em] text-ink sm:text-[3rem] lg:text-[3.5rem]">
            들은 말씀을,
            <br />
            오래 남는 문장으로.
          </h1>
          <p className="mt-6 max-w-[34rem] text-[1rem] leading-[1.75] text-ink-soft md:text-[1.0625rem]">
            유튜브 영상과 음성을 텍스트로 옮기고, 중요한 구절을 정리하며 나만의 기록으로 남겨보세요.
          </p>
        </div>
        <div className="mt-12 max-w-[56rem] md:mt-14">
          <LinkComposer />
          <div className="mt-6">
            <AlternateInputs />
          </div>
        </div>
      </section>

      <div className="space-y-24 md:space-y-28">
        <RevivalStrip />
        <RecentRecords />
        <section aria-label="새벽기록의 흐름" className="mx-auto max-w-[1320px] px-5 md:px-10">
          <ol className="grid border-t border-ink md:grid-cols-3">
            {PRINCIPLES.map((p, i) => (
              <li
                key={p.en}
                className={`py-9 md:py-10 ${i > 0 ? "border-t hairline md:border-l md:border-t-0 md:pl-10" : ""} md:pr-10`}
              >
                <p className="flex items-baseline gap-3">
                  <span className="numeral text-[0.8125rem] text-gold-deep">{`0${i + 1}`}</span>
                  <span className="eyebrow">{p.en}</span>
                </p>
                <p className="serif mt-4 text-[1.375rem] tracking-[-0.02em]">{p.ko}</p>
                <p className="mt-3 max-w-[22rem] text-[0.9375rem] leading-[1.75] text-muted">{p.body}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </>
  );
}
