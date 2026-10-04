const THEME_COLOR_META = 'meta[name="theme-color"]'
const KEYBOARD_GAP_PX = 80

export const isStandalone = () => {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    (navigator as { standalone?: boolean }).standalone === true
  )
}

export const syncNativeChrome = () => {
  const root = document.documentElement
  const bg = getComputedStyle(root).getPropertyValue('--app-bg').trim() || '#f2f2f7'
  const dark = root.classList.contains('dark') || root.classList.contains('blackPink')

  root.style.colorScheme = dark ? 'dark' : 'light'
  root.classList.toggle('is-standalone', isStandalone())

  const themeMeta = document.querySelector(THEME_COLOR_META)
  if (themeMeta) {
    themeMeta.setAttribute('content', bg)
  }
}

export const bindNativeViewport = () => {
  const viewport = window.visualViewport
  const sync = () => {
    const height = viewport?.height ?? window.innerHeight
    const offset = viewport?.offsetTop ?? 0
    const keyboard = Math.max(0, window.innerHeight - height - offset)
    document.documentElement.style.setProperty('--keyboard-inset', `${keyboard}px`)
    document.documentElement.classList.toggle('is-keyboard', keyboard > KEYBOARD_GAP_PX)
  }

  sync()
  viewport?.addEventListener('resize', sync)
  viewport?.addEventListener('scroll', sync)
  window.addEventListener('orientationchange', sync)

  return () => {
    viewport?.removeEventListener('resize', sync)
    viewport?.removeEventListener('scroll', sync)
    window.removeEventListener('orientationchange', sync)
  }
}

export const hapticTap = () => {
  if (typeof navigator.vibrate === 'function') {
    navigator.vibrate(8)
  }
}
