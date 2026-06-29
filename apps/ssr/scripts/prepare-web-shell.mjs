import { readFileSync, writeFileSync } from 'node:fs'

const html = readFileSync('./public/index.html', 'utf8')

if (!/<script id=["']manifest["']><\/script>/.test(html)) {
  throw new Error('SSR web shell must contain an empty script#manifest placeholder')
}

if (/window\.__MANIFEST__\s*=/.test(html)) {
  throw new Error('SSR web shell must not contain an embedded manifest')
}

const escapedHtml = html.replaceAll('`', '\\`').replaceAll('${', '\\${')
writeFileSync('./src/index.html.ts', `export default \`${escapedHtml}\`;`)
