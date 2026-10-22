import { LinkTranscriber } from "@/components/home/LinkTranscriber";
import { AlternateInputs } from "@/components/home/AlternateInputs";
import { RevivalStrip } from "@/components/home/RevivalStrip";
import { RecentRecords } from "@/components/home/RecentRecords";

export default function HomePage() {
  return (
    <>
      <section className="mx-auto max-w-[1320px] px-5 pb-20 pt-14 md:px-10 md:pb-24 md:pt-24">
        <div className="max-w-[52rem]">
          <p className="eyebrow">YouTube to text</p>
          <h1 className="serif mt-5 text-[2.25rem] font-semibold leading-[1.24] tracking-[-0.035em] text-ink sm:text-[2.875rem] lg:text-[3.25rem]">
            링크를 붙여넣으면,
            <br />
            말씀이 글이 됩니다.
          </h1>
          <p className="mt-5 max-w-[34rem] text-[1rem] leading-[1.75] text-ink-soft md:text-[1.0625rem]">
            YouTube 영상의 스크립트를 바로 텍스트로 펼쳐 드립니다. 복사하고, 내려받고, 저장해 다시 읽으세요.
          </p>
        </div>
        <div className="mt-10 max-w-[56rem] md:mt-12">
          <LinkTranscriber />
          <div className="mt-6">
            <AlternateInputs />
          </div>
        </div>
      </section>

      <div className="space-y-24 md:space-y-28">
        <RecentRecords />
        <RevivalStrip />
      </div>
    </>
  );
}
