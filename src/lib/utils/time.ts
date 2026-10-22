/** 75_300 → "01:15", 3_725_000 → "1:02:05" */
export function formatClock(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return "--:--";
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Always hh:mm:ss — used for exported markers. */
export function formatClockLong(ms: number): string {
  const total = Math.floor(Math.max(0, ms) / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

function pad(n: number, w: number) {
  return String(n).padStart(w, "0");
}

export function formatSrtTime(ms: number): string {
  const v = Math.max(0, Math.round(ms));
  return `${pad(Math.floor(v / 3_600_000), 2)}:${pad(Math.floor(v / 60_000) % 60, 2)}:${pad(Math.floor(v / 1000) % 60, 2)},${pad(v % 1000, 3)}`;
}

export function formatVttTime(ms: number): string {
  return formatSrtTime(ms).replace(",", ".");
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms <= 0) return "";
  const totalMin = Math.round(ms / 60000);
  if (totalMin < 1) return "1분 미만";
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}시간 ${m}분` : `${m}분`;
}

const dateFmt = new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("ko-KR", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDate(ts: number | string): string {
  return dateFmt.format(new Date(ts));
}
export function formatDateTime(ts: number): string {
  return dateTimeFmt.format(new Date(ts));
}
