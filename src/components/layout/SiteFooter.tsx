import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="relative z-10 mt-32 border-t hairline">
      <div className="mx-auto grid max-w-[1320px] gap-8 px-5 py-12 text-[0.8125rem] text-muted md:grid-cols-[1fr_auto] md:px-10">
        <div className="space-y-2">
          <p className="serif text-[0.9375rem] text-ink">
            새벽기록 <span className="text-faint">·</span> DAWN ARCHIVE
          </p>
          <p>
            개인 말씀 학습을 위해 제작된 비공식 기록 도구입니다. 특정 교회나 단체의 공식 서비스가 아닙니다.
          </p>
          <p>
            기록과 메모는 이 브라우저 안에만 저장됩니다. 전사 결과를 외부에 공유할 때는 원저작자의 권리를
            확인해 주세요.
          </p>
        </div>
        <div className="flex gap-5 md:items-end">
          <Link className="link-quiet" href="/guide#privacy">
            개인정보와 저작권
          </Link>
          <Link className="link-quiet" href="/settings#backup">
            백업
          </Link>
        </div>
      </div>
    </footer>
  );
}
