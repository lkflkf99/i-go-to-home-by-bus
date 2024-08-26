import { isDark, toggleDark } from '@/composables'

export const loadTheme = () => {
  const theme = localStorage.getItem('theme')
  if (theme) {
    document.documentElement.classList.add(theme)
  }

  if (theme === 'blackPink' && !isDark.value) {
    toggleDark()
  } else if (theme === 'default' && isDark.value) {
    toggleDark()
  }
}
