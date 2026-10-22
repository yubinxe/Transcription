import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-[1320px] px-5 py-32 md:px-10">
      <p className="eyebrow">404</p>
      <p className="serif mt-4 text-[2rem] tracking-[-0.02em]">찾는 페이지가 없습니다.</p>
      <Link href="/" className="link-quiet mt-8 inline-block text-[0.875rem]">
        처음으로
      </Link>
    </div>
  );
}
