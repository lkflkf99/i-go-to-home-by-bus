import { i18n } from '@/modules/i18n'

export const isEnglish = () => String(i18n.global.locale.value).startsWith('en')

export const textByLocale = (tc?: string | null, en?: string | null) => {
  if (isEnglish()) {
    return en || tc || ''
  }
  return tc || en || ''
}
