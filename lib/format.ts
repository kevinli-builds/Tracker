// Display formatting shared across tracker UIs.

// Round to at most 2 decimals and stringify — drops float cruft that can come
// back from a numeric column (e.g. 175.40000001 → "175.4", 175 → "175").
export function fmtNum(n: number): string {
  return String(Math.round(n * 100) / 100)
}
