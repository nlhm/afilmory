import type { Plugin } from 'vite'
import type { SiteConfig } from '../../../../site.config'

export function createFeedSitemapPlugin(siteConfig: SiteConfig): Plugin {
  return {
    name: 'feed-sitemap-generator',
    apply: 'build',
    generateBundle() {
      console.info(`Skipping feed.xml and sitemap.xml generation for private gallery: ${siteConfig.url || 'site URL unavailable'}`)
    },
  }
}
