import siteConfig from '@config'

import { DbManager } from './db'
import type { HtmlDocument } from './html-document'
import { serializeForInlineScript } from './inline-script'

export const injectConfigToDocument = (document: HtmlDocument) => {
  const $config = document.head.querySelector('#config')
  const injectConfigBase = {
    useApi: DbManager.shared.isEnabled(),
    useNext: true,
  }
  if ($config) {
    $config.textContent = `window.__CONFIG__ = ${serializeForInlineScript(injectConfigBase)};window.__SITE_CONFIG__ = ${serializeForInlineScript(siteConfig)};`
  }
  return document
}
