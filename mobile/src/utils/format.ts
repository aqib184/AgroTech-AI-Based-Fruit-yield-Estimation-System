import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

export function formatKg(n: number | null | undefined, digits = 0) {
  if (n == null || Number.isNaN(n)) return '—';
  return `${n.toFixed(digits)} kg`;
}

export function formatPct(n: number | null | undefined, digits = 1) {
  if (n == null || Number.isNaN(n)) return '—';
  return `${n.toFixed(digits)}%`;
}

export function formatDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return dayjs(iso).format('MMM D, YYYY');
}

export function formatShortDate(iso: string) {
  return dayjs(iso).format('ddd M/D');
}

export function fromNow(iso: string | null | undefined) {
  if (!iso) return '';
  return dayjs(iso).fromNow();
}
