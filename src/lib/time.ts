export function formatDistanceToNow(date: string, now = Date.now()) {
  const seconds = Math.max(0, Math.floor((now - new Date(date).getTime()) / 1000));
  if (seconds < 60) return "Ahora";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `Hace ${days} d`;
}
