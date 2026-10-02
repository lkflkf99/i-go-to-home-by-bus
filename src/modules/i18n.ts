import { createI18n } from 'vue-i18n'

const messages = Object.fromEntries(
  Object.entries(import.meta.globEager('../../locales/*.y(a)?ml')).map(([key, value]) => {
    const yaml = key.endsWith('.yaml')
    return [key.slice(14, yaml ? -5 : -4), value.default]
  })
)

const savedLocale = typeof localStorage !== 'undefined' && localStorage.getItem('locale') === 'zh-HK' ? 'zh-HK' : 'en'

if (typeof document !== 'undefined') {
  document.documentElement.lang = savedLocale
}

export const i18n = createI18n({
  locale: savedLocale,
  fallbackLocale: 'en',
  legacy: false,
  messages,
})
