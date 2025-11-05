export function formatStable(dateStr: string) {
  // produce a timezone-independent stable format (UTC-based) so server and client
  // render the same string during SSR and hydration
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = d.getUTCFullYear();
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const min = String(d.getUTCMinutes()).padStart(2, '0');
  const ss = String(d.getUTCSeconds()).padStart(2, '0');
  // keep a stable UTC-based representation for SSR but avoid showing the literal 'UTC'
  return `${dd}/${mm}/${yyyy} ${hh}:${min}:${ss}`;
}
