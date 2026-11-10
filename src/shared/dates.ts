// DATETIME2 del OLTP representa hora local de Lima, sin sufijo UTC.
export function formatDate(value: string) {
  const instant = /Z$|[+-]\d{2}:\d{2}$/.test(value) ? value : value + '-05:00';
  return new Date(instant).toLocaleString('es-PE', { timeZone: 'America/Lima' });
}
