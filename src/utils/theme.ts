import { isDark, toggleDark } from '@/composables'
import { ref } from 'vue'

export type AppTheme = 'default' | 'blackPink'

export const appTheme = ref<AppTheme>(
  localStorage.getItem('theme') === 'blackPink' ? 'blackPink' : 'default'
)

export const applyTheme = (theme: AppTheme) => {
  const root = document.documentElement
  localStorage.setItem('theme', theme)
  appTheme.value = theme

  if (theme === 'blackPink' && !isDark.value) {
    root.classList.remove('default')
    toggleDark()
  } else if (theme === 'default' && isDark.value) {
    root.classList.remove('blackPink')
    toggleDark()
  }

  root.classList.add(theme)
}

export const loadTheme = () => {
  applyTheme(appTheme.value)
}
