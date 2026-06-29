import type { DOMParser } from 'linkedom'

type ParsedDocument = ReturnType<DOMParser['parseFromString']>

export type HtmlDocument = Extract<ParsedDocument, { head: object }>
