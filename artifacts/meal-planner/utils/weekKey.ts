export function getCurrentWeekKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const yearStart = new Date(year, 0, 1);
  const dayOfYear = Math.floor(
    (now.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24)
  );
  const week = Math.ceil((dayOfYear + yearStart.getDay() + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}
