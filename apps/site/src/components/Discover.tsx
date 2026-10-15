import { useEffect, useState } from 'react'

import type { Locale } from '../i18n'
import { t as translate } from '../i18n'
import type { FeaturedGallery } from '../lib/api'
import { fetchFeaturedGalleries, galleryPublicUrl } from '../lib/api'

export function Discover({ locale }: { locale: Locale }) {
  const copy = translate(locale).discover
  const [galleries, setGalleries] = useState<FeaturedGallery[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)
    fetchFeaturedGalleries()
      .then((list) => {
        if (!cancelled) {
          setGalleries(list)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true)
          setGalleries([])
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section id="discover" className="border-t border-line px-5 py-20 md:px-8">
      <div className="mx-auto max-w-6xl">
        <p className="font-mono text-xs tracking-widest uppercase text-dim">{copy.label}</p>
        <h2 className="mt-3 font-serif text-3xl md:text-4xl">{copy.title}</h2>
        <p className="mt-3 max-w-xl text-sm text-muted">{copy.description}</p>

        <div className="mt-10">
          {loading ? (
            <p className="text-sm text-dim">{copy.loading}</p>
          ) : error ? (
            <p className="text-sm text-dim">{copy.error}</p>
          ) : galleries.length === 0 ? (
            <p className="text-sm text-dim">{copy.empty}</p>
          ) : (
            <div className="discover-rail flex gap-4 overflow-x-auto pb-2">
              {galleries.map(g => (
                <a
                  key={g.id}
                  href={galleryPublicUrl(g)}
                  target="_blank"
                  rel="noreferrer"
                  className="discover-card shrink-0 border border-line bg-card p-4 transition-colors hover:border-accent"
                >
                  <p className="font-serif text-lg leading-snug">{g.name}</p>
                  <p className="mt-1 font-mono text-xs text-dim">
                    {g.slug}
                    .afilmory.art
                  </p>
                  {g.description ? (
                    <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-muted">{g.description}</p>
                  ) : null}
                  <p className="mt-4 font-mono text-xs tracking-wide text-accent">
                    {g.photoCount}
                    {' '}
                    {copy.photos}
                  </p>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
