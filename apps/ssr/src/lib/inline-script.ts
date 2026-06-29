const INLINE_SCRIPT_ESCAPE_PATTERN = /[<>&\u2028\u2029]/g

const INLINE_SCRIPT_ESCAPES: Record<string, string> = {
  '<': '\\u003c',
  '>': '\\u003e',
  '&': '\\u0026',
  '\u2028': '\\u2028',
  '\u2029': '\\u2029',
}

export const serializeForInlineScript = (value: unknown) =>
  JSON.stringify(value).replace(INLINE_SCRIPT_ESCAPE_PATTERN, character => INLINE_SCRIPT_ESCAPES[character])
