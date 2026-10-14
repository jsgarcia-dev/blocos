const time = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });
const day = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });
const full = new Intl.NumberFormat("pt-BR");

export function formatNumber(n: number): string {
  return full.format(n);
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** "hoje, 09:42", "ontem, 18:10" ou "12/10, 08:00". */
export function formatEdited(ts: number, now = Date.now()): string {
  const d = new Date(ts);
  const n = new Date(now);
  const y = new Date(now - 86400e3);
  if (sameDay(d, n)) return `hoje, ${time.format(d)}`;
  if (sameDay(d, y)) return `ontem, ${time.format(d)}`;
  return `${day.format(d)}, ${time.format(d)}`;
}

/** "agora", "há 2 min", "há 3 h", "ontem", "há 5 dias". */
export function formatAgo(ts: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 45) return "agora";
  const m = Math.round(s / 60);
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  if (d === 1) return "ontem";
  return `há ${d} dias`;
}

export function fold(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function countWords(text: string): number {
  const m = text.match(/[\p{L}\p{N}][\p{L}\p{N}'’\-_.@]*/gu);
  return m ? m.length : 0;
}
