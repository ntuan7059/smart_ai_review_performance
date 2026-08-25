export function toDateInput(date) {
  return date.toISOString().slice(0, 10);
}

export function defaultFrom(daysAgo = 7) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return toDateInput(d);
}

export function defaultTo() {
  return toDateInput(new Date());
}
