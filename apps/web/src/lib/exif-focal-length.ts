export function parseFocalLength(value: unknown): number | null {
  if (
    typeof value !== 'number'
    && (typeof value !== 'string' || !/^\s*(?:\d+(?:\.\d*)?|\.\d+)\s*(?:mm\s*)?$/i.test(value))
  ) {
    return null
  }
  const number = typeof value === 'number' ? value : Number(value.trim().replace(/\s*mm$/i, ''))
  return Number.isFinite(number) && number > 0 ? number : null
}
