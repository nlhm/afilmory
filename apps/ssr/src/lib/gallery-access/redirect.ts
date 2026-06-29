const LOCAL_ORIGIN = 'https://gallery.local'

export const getSafeGalleryRedirect = (value: string | null | undefined, fallback = '/') => {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return fallback
  }

  try {
    const url = new URL(value, LOCAL_ORIGIN)
    if (url.origin !== LOCAL_ORIGIN) {
      return fallback
    }

    return `${url.pathname}${url.search}${url.hash}`
  }
  catch {
    return fallback
  }
}
