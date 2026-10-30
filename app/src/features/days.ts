// The days rule (Hùng): how many days a lot has left, counted the way the notice counts it.
// It sits apart from the screens so the rule can be read and tested without a UI.
export function daysLeft(useUntil: string, today = new Date()): number | null {
  const until = new Date(`${useUntil}T00:00:00`);
  if (Number.isNaN(until.getTime())) return null;
  // Counted in whole days from midnight today, so the hour of the call does not change the answer.
  const midnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((until.getTime() - midnight.getTime()) / 86400000);
}

// The reading rule (added 2026-10-30): a day on a screen is written the way a person says it,
// DD-MM-YYYY. The value the client sends keeps the shape the server validates (shared/rules.js
// reads ^\d{4}-\d{2}-\d{2}$ and answers 00193 for anything else), so only the reading changes.
// A display form is never a value: readDay answers empty for it.
export function readDay(iso: string): string {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!parts) return '';
  return `${parts[3]}-${parts[2]}-${parts[1]}`;
}

// A day picked from the calendar is kept from the parts the picker answered, in the local
// calendar, so a tap made in the evening does not land on the next day the way a UTC
// timestamp would.
export function isoOfDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
