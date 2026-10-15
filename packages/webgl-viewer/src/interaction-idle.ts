export function afterViewerInteraction(isInteracting: () => boolean, apply: () => void) {
  let frame: number | undefined
  let cancelled = false

  const check = () => {
    if (cancelled) {
      return
    }
    if (isInteracting()) {
      frame = requestAnimationFrame(check)
      return
    }
    apply()
  }

  check()
  return () => {
    cancelled = true
    if (frame !== undefined) {
      cancelAnimationFrame(frame)
    }
  }
}
