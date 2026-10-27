// The days rule (Hùng): how many days a lot has left, counted the way the notice counts it.
// It sits apart from the screens so the rule can be read and tested without a UI.
export function daysLeft(useUntil: string, today = new Date()): number | null {
  const until = new Date(`${useUntil}T00:00:00`);
  if (Number.isNaN(until.getTime())) return null;
  // Counted in whole days from midnight today, so the hour of the call does not change the answer.
  const midnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((until.getTime() - midnight.getTime()) / 86400000);
}
