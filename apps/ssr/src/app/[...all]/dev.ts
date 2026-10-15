import { extname } from 'node:path'
import process from 'node:process'

import { DOMParser } from 'linkedom'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { getGalleryCacheControl } from '~/lib/gallery-access/cache'
import { injectGalleryDataToDocument } from '~/lib/gallery-access/gallery-html'

const host = 'http://localhost:13333'
export const handler = async (req: NextRequest) => {
  if (process.env.NODE_ENV !== 'development') {
    return new NextResponse(null, { status: 404 })
  }

  const { pathname } = req.nextUrl
  const wantsHtml = req.headers.get('accept')?.includes('text/html')
  const hasExtension = Boolean(extname(pathname))

  if (pathname.startsWith('/thumbnails')) {
    return proxyAssets(req)
  }

  if (pathname.startsWith('/photos')) {
    if (!hasExtension && wantsHtml) {
      return proxyIndexHtml()
    }

    return proxyAssets(req)
  }

  if (hasExtension || pathname.startsWith('/@') || pathname.startsWith('/node_modules')) {
    return proxyAssets(req)
  }

  return proxyIndexHtml()
}

async function proxyAssets(req: NextRequest) {
  const url = new URL(req.url)
  const assetPath = `${url.pathname}${url.search}`
  const response = await fetch(host + assetPath)
  const headers = new Headers(response.headers)
  headers.set('Cache-Control', getGalleryCacheControl(url.pathname))
  return new NextResponse(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  })
}

async function proxyIndexHtml() {
  const htmlText = await fetch(host).then(res => res.text())

  const parser = new DOMParser()
  const document = parser.parseFromString(htmlText, 'text/html')

  const scripts = document.querySelectorAll('script') as NodeListOf<HTMLScriptElement>

  scripts.forEach((script) => {
    if (script.src.startsWith('/')) {
      script.src = replaceUrl(script.src, host)
    }
  })

  const links = document.head.querySelectorAll('link')
  links.forEach((link) => {
    if (link.href.startsWith('/')) {
      link.href = replaceUrl(link.href, host)
    }
  })

  const injectScripts = document.querySelectorAll('script[type="module"]')
  injectScripts.forEach((script) => {
    script.innerHTML = script.innerHTML
      .replace('/@vite-plugin-checker-runtime', `${host}/@vite-plugin-checker-runtime`)
      .replace('/@react-refresh', `${host}/@react-refresh`)
  })

  injectGalleryDataToDocument(document)

  return new NextResponse(document.documentElement.outerHTML, {
    headers: {
      'Cache-Control': 'private, no-store',
      'Content-Type': 'text/html; charset=utf-8',
      'X-SSR': '1',
    },
  })
}
const replaceUrl = (url: string, host: string) => {
  return new URL(url.startsWith('http') ? new URL(url).pathname : url, new URL(host)).toString()
}
