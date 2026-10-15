import { photoLoader } from '@afilmory/data'
import { ScrollArea, ScrollElementContext } from '@afilmory/ui'
import { clsxm } from '@afilmory/utils'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, Outlet, useLocation, useMatch, useSearchParams } from 'react-router'

import { useMobile } from '~/hooks/useMobile'
import { useTitle } from '~/hooks/useTitle'
import { MasonryView } from '~/modules/gallery/MasonryView'
import { ViewerRouteSync } from '~/modules/viewer/ViewerRouteSync'
import { PhotosProvider } from '~/providers/photos-provider'

import type { FocalLengthBand } from './distribution'
import { getFocalLengthDistribution, getLensOptions, getMostUsedFocalGroup } from './distribution'

const focusRing = 'focus-visible:outline-accent focus-visible:outline-2 focus-visible:outline-offset-2'

export const FocalLengthsPage = () => {
  const { t, i18n } = useTranslation()
  const isMobile = useMobile()
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()
  const isViewingPhoto = !!useMatch('/focal-lengths/photos/:photoId')
  const lens = searchParams.get('lens') || null
  const focal = searchParams.get('focal')
  const photos = photoLoader.getPhotos()
  const lenses = useMemo(() => getLensOptions(photos), [photos])
  const distribution = useMemo(() => getFocalLengthDistribution(photos, lens), [photos, lens])
  const defaultGroup = getMostUsedFocalGroup(distribution.groups)
  const selectedGroup = focal === null ? defaultGroup : distribution.groups.find(group => group.band.id === focal)
  const selectedPhotos = focal === 'unknown' ? distribution.missingPhotos : (selectedGroup?.photos ?? [])
  const number = new Intl.NumberFormat(i18n.language)
  const bandLabel = (band: FocalLengthBand) => {
    if (band.id === 'ultra-wide') {
      return t('focal.band.ultraWide')
    }
    if (band.id === 'super-telephoto') {
      return t('focal.band.superTelephoto')
    }
    return t('focal.band.near', { focal: number.format(Number(band.id)) })
  }
  const bandRange = (band: FocalLengthBand) => {
    if (band.min === 0) {
      return t('focal.range.below', { max: number.format(band.max) })
    }
    if (!Number.isFinite(band.max)) {
      return t('focal.range.from', { min: number.format(band.min) })
    }
    return t('focal.range.between', { min: number.format(band.min), max: number.format(band.max) })
  }
  const selectedLabel
    = focal === 'unknown'
      ? t('focal.unknown')
      : selectedGroup
        ? bandLabel(selectedGroup.band)
        : t('focal.selection.empty')
  const percent = new Intl.NumberFormat(i18n.language, { style: 'percent', maximumFractionDigits: 1 })
  const largestCount = Math.max(1, ...distribution.groups.map(group => group.count))
  const hasLensOption = lenses.some(option => option.lens === lens)

  const gallerySearch = new URLSearchParams(searchParams)
  gallerySearch.delete('lens')
  gallerySearch.delete('focal')
  const galleryUrl = gallerySearch.size ? `/?${gallerySearch}` : '/'

  useTitle(t('focal.title'))

  if (focal === null && defaultGroup) {
    const canonical = new URLSearchParams(searchParams)
    canonical.set('focal', defaultGroup.band.id)
    return <Navigate to={{ pathname: location.pathname, search: `?${canonical}` }} replace />
  }

  const selectFocalLength = (value: string) => {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        next.set('focal', value)
        return next
      },
      { preventScrollReset: true },
    )
  }

  const content = (
    <main className="text-text mx-auto max-w-7xl px-4 pb-safe pt-5 lg:px-8 lg:pt-8" inert={isViewingPhoto}>
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            to={galleryUrl}
            aria-label={t('focal.back')}
            className={clsxm(
              'bg-material-medium border-accent/20 text-text-secondary hover:text-text flex size-8 shrink-0 items-center justify-center rounded-full border backdrop-blur-2xl transition-colors duration-200',
              focusRing,
            )}
          >
            <i className="i-mingcute-arrow-left-line text-lg" aria-hidden="true" />
          </Link>
          <div>
            <h1 className="text-base font-semibold">{t('focal.title')}</h1>
            <p className="text-text-secondary mt-1 text-xs">{t('focal.subtitle')}</p>
          </div>
        </div>
        <div className="flex w-full items-center gap-3 lg:w-auto">
          <label htmlFor="focal-lens" className="text-text-secondary shrink-0 text-xs">
            {t('focal.lens')}
          </label>
          <select
            id="focal-lens"
            value={lens ?? ''}
            onChange={(event) => {
              const value = event.target.value
              const nextGroup = getMostUsedFocalGroup(getFocalLengthDistribution(photos, value || null).groups)
              setSearchParams(
                (previous) => {
                  const next = new URLSearchParams(previous)
                  if (value) {
                    next.set('lens', value)
                  }
                  else {
                    next.delete('lens')
                  }
                  if (nextGroup) {
                    next.set('focal', nextGroup.band.id)
                  }
                  else {
                    next.delete('focal')
                  }
                  return next
                },
                { preventScrollReset: true },
              )
            }}
            className={clsxm(
              'bg-material-medium border-accent/20 min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm backdrop-blur-2xl lg:max-w-sm',
              focusRing,
            )}
          >
            <option value="">{t('focal.allLenses')}</option>
            {lens && !hasLensOption && <option value={lens}>{lens}</option>}
            {lenses.map(option => (
              <option key={option.lens} value={option.lens}>
                {option.lens}
                {' '}
                ·
                {number.format(option.count)}
              </option>
            ))}
          </select>
        </div>
      </header>

      <dl className="mb-6 flex flex-wrap gap-x-8 gap-y-4 text-xs">
        {[
          [t('focal.total'), distribution.totalCount],
          [t('focal.valid'), distribution.validCount],
          [t('focal.missing'), distribution.missingPhotos.length],
        ].map(([label, count]) => (
          <div key={label}>
            <dt className="text-text-secondary">{label}</dt>
            <dd className="mt-1 text-base font-semibold tabular-nums">{number.format(Number(count))}</dd>
          </div>
        ))}
      </dl>

      <div className="grid items-start gap-8 pb-10 lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)]">
        <section
          className="bg-material-medium border-accent/20 overflow-hidden rounded-2xl border backdrop-blur-2xl"
          aria-labelledby="focal-distribution-heading"
        >
          <div className="px-4 pt-4 pb-3">
            <h2 id="focal-distribution-heading" className="text-sm font-semibold">
              {t('focal.distribution')}
            </h2>
            <p className="text-text-secondary mt-2 text-xs leading-relaxed">
              {t('focal.grouping')}
              {' '}
              {t('focal.denominator')}
            </p>
          </div>
          <div className="text-text-tertiary grid grid-cols-[7rem_minmax(0,1fr)_2rem_3rem] gap-2 px-4 pb-2 text-xs">
            <span>{t('focal.length')}</span>
            <span />
            <span className="text-right">{t('focal.count')}</span>
            <span className="text-right">{t('focal.share')}</span>
          </div>
          <div className="px-2 pb-2">
            {distribution.groups.map(group => (
              <button
                key={group.band.id}
                type="button"
                aria-pressed={focal !== 'unknown' && group === selectedGroup}
                onClick={() => selectFocalLength(group.band.id)}
                className={clsxm(
                  'grid min-h-14 w-full grid-cols-[7rem_minmax(0,1fr)_2rem_3rem] items-center gap-2 rounded-xl px-2 py-2 text-xs tabular-nums transition-colors duration-200',
                  focusRing,
                  group === selectedGroup && focal !== 'unknown'
                    ? 'bg-accent/10 text-text'
                    : 'text-text-secondary hover:bg-accent/5 hover:text-text',
                )}
              >
                <span className="text-left">
                  <span className="block font-medium">{bandLabel(group.band)}</span>
                  <span className="text-text-tertiary mt-1 block text-xs">{bandRange(group.band)}</span>
                </span>
                <span className="bg-fill-tertiary h-1.5 overflow-hidden rounded-full" aria-hidden="true">
                  <span
                    className="bg-accent block h-full rounded-full"
                    style={{ width: `${(group.count / largestCount) * 100}%` }}
                  />
                </span>
                <span className="text-right">{number.format(group.count)}</span>
                <span className="text-right">{percent.format(group.share)}</span>
              </button>
            ))}
            {distribution.groups.length === 0 && (
              <p className="text-text-secondary px-2 py-6 text-xs leading-relaxed">{t('focal.noData')}</p>
            )}
            {distribution.missingPhotos.length > 0 && (
              <button
                type="button"
                aria-pressed={focal === 'unknown'}
                onClick={() => selectFocalLength('unknown')}
                className={clsxm(
                  'text-text-secondary hover:bg-accent/5 mt-2 flex min-h-11 w-full items-center justify-between gap-2 rounded-xl px-2 text-xs',
                  focusRing,
                  focal === 'unknown' && 'bg-accent/10 text-text',
                )}
              >
                <span>{t('focal.unknown')}</span>
                <span className="tabular-nums">{t('focal.photos', { count: distribution.missingPhotos.length })}</span>
              </button>
            )}
          </div>
        </section>

        <section className="min-w-0" aria-labelledby="focal-photos-heading">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2" aria-live="polite">
            <div>
              <h2 id="focal-photos-heading" className="text-sm font-semibold">
                {selectedLabel}
              </h2>
              {selectedGroup && focal !== 'unknown' && (
                <p className="text-text-secondary mt-1 text-xs">{bandRange(selectedGroup.band)}</p>
              )}
            </div>
            <span className="text-text-secondary text-xs">{t('focal.photos', { count: selectedPhotos.length })}</span>
          </div>
          {selectedPhotos.length > 0 ? (
            <MasonryView photos={selectedPhotos} />
          ) : (
            <p className="text-text-secondary py-8 text-sm">{t('focal.selection.hint')}</p>
          )}
        </section>
      </div>
    </main>
  )

  return (
    <PhotosProvider photos={selectedPhotos} routeBase="/focal-lengths">
      <ViewerRouteSync />
      {isMobile ? (
        <ScrollElementContext value={document.body}>{content}</ScrollElementContext>
      ) : (
        <ScrollArea rootClassName="h-svh w-full" viewportClassName="size-full">
          {content}
        </ScrollArea>
      )}
      <Outlet />
    </PhotosProvider>
  )
}
