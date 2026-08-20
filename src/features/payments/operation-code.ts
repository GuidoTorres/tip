const OPERATION_CODE_PATTERN = /^TM[0-9A-F]{16}$/;

export function normalizeOperationCode(value: string) {
  const compact = value.trim().toUpperCase().replace(/[\s-]+/g, "");
  if (!OPERATION_CODE_PATTERN.test(compact)) return null;
  const payload = compact.slice(2);
  return `TM-${payload.slice(0, 4)}-${payload.slice(4, 8)}-${payload.slice(8, 12)}-${payload.slice(12, 16)}`;
}
