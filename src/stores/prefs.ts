import { defineStore } from 'pinia'
import { i18n } from '@/modules/i18n'

export type AppLocale = 'en' | 'zh-HK'

const readLocale = (): AppLocale => {
  return localStorage.getItem('locale') === 'zh-HK' ? 'zh-HK' : 'en'
}

export const usePrefsStore = defineStore({
  id: 'prefs',
  state: () => ({
    locationEnabled: localStorage.getItem('locationEnabled') !== 'false',
    locale: readLocale(),
  }),
  actions: {
    setLocationEnabled(enabled: boolean) {
      this.locationEnabled = enabled
      localStorage.setItem('locationEnabled', String(enabled))
    },
    setLocale(locale: AppLocale) {
      this.locale = locale
      localStorage.setItem('locale', locale)
      i18n.global.locale.value = locale
      document.documentElement.lang = locale
    },
  },
})
