// Returns an array of ISO date strings for all days in the given month/year
export function getMonthDays(year: number, month: number): string[] {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: string[] = [];
  for (let i = 1; i <= daysInMonth; i++) {
    const date = new Date(year, month, i);
    days.push(date.toISOString().split('T')[0]);
  }
  return days;
}
