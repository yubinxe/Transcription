"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";

const NAV = [
  { href: "/", label: "새 기록", match: (p: string) => p === "/" },
  { href: "/archive", label: "내 아카이브", match: (p: string) => p.startsWith("/archive") || p.startsWith("/record") || p.startsWith("/collections") },
  { href: "/guide", label: "사용 안내", match: (p: string) => p.startsWith("/guide") },
  { href: "/settings", label: "설정", match: (p: string) => p.startsWith("/settings") },
];

export function SiteHeader() {
  const pathname = usePathname() ?? "/";
  return (
    <header className="sticky top-0 z-40 border-b hairline bg-canvas/90 backdrop-blur-[6px] supports-[backdrop-filter]:bg-canvas/80">
      <div className="mx-auto flex h-16 max-w-[1320px] items-center justify-between gap-6 px-5 md:px-10">
        <Link href="/" className="group flex items-baseline gap-3" aria-label="새벽기록 홈">
          <span className="serif text-[1.1875rem] font-semibold tracking-[-0.02em] text-ink">새벽기록</span>
          <span className="hidden text-[0.625rem] font-medium tracking-[0.28em] text-muted sm:inline">DAWN ARCHIVE</span>
        </Link>
        <nav aria-label="주요 메뉴" className="-mr-2 flex items-center overflow-x-auto">
          {NAV.map((item) => {
            const active = item.match(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative whitespace-nowrap px-2.5 py-2 text-[0.8125rem] transition-colors duration-150 sm:px-3.5 sm:text-[0.875rem]",
                  active ? "text-ink" : "text-muted hover:text-ink",
                )}
              >
                {item.label}
                <span
                  aria-hidden
                  className={cn(
                    "absolute inset-x-2.5 -bottom-[13px] h-px bg-ink transition-opacity duration-200 sm:inset-x-3.5",
                    active ? "opacity-100" : "opacity-0",
                  )}
                />
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
