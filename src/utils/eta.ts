import { i18n } from '@/modules/i18n'

export const formatEta = (eta: string | Date | null | undefined) => {
  if (!eta) {
    return '-'
  }

  const time = new Date(eta).getTime()
  if (Number.isNaN(time)) {
    return '-'
  }

  const mins = Math.round((time - Date.now()) / 60000)
  if (mins <= 0) {
    return i18n.global.t('eta.due')
  }
  return i18n.global.t('eta.min', { n: mins })
}

export const formatMeters = (meters: number | null | undefined) => {
  if (meters === null || meters === undefined || !Number.isFinite(meters)) {
    return ''
  }
  if (meters < 1000) {
    return i18n.global.t('distance.m', { n: Math.round(meters) })
  }
  return i18n.global.t('distance.km', { n: (meters / 1000).toFixed(1) })
}
