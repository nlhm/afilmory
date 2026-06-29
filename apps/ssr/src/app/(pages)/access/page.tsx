import { getSafeGalleryRedirect } from '~/lib/gallery-access/redirect'

import styles from './page.module.css'

interface AccessPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function AccessPage({ searchParams }: AccessPageProps) {
  const params = await searchParams
  const nextValue = Array.isArray(params.next) ? params.next[0] : params.next
  const next = getSafeGalleryRedirect(nextValue, '')

  return (
    <main className={styles.page}>
      <div className={styles.grain} aria-hidden="true" />
      <div className={styles.frame} aria-hidden="true">
        <span>36</span>
        <span>A</span>
      </div>

      <section className={styles.content} aria-labelledby="access-title">
        <div className={styles.brandRow}>
          <span className={styles.aperture} aria-hidden="true" />
          <p className={styles.brand}>Afilmory</p>
        </div>

        <div className={styles.intro}>
          <p className={styles.eyebrow}>Private collection</p>
          <h1 id="access-title">Enter the gallery</h1>
          <p className={styles.description}>
            This personal archive is protected. Enter the shared password to continue.
          </p>
        </div>

        <form className={styles.form} action="/api/gallery-access/unlock" method="post">
          <label htmlFor="gallery-password">Gallery password</label>
          <div className={styles.fieldRow}>
            <input
              id="gallery-password"
              name="password"
              type="password"
              autoComplete="current-password"
              autoFocus
              required
            />
            <button type="submit">
              <span>Unlock</span>
              <span aria-hidden="true">↗</span>
            </button>
          </div>
          {next ? <input name="next" type="hidden" value={next} /> : null}
        </form>

        <p className={styles.privacy}>Access is remembered on this device for 30 days.</p>
      </section>

      <p className={styles.footer}>A private photographic archive</p>
    </main>
  )
}
