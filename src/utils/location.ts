import { ElMessage } from 'element-plus'
import { i18n } from '@/modules/i18n'

interface GeoLocation {
  latitude: number
  longitude: number
}

export const isLocationEnabled = () => localStorage.getItem('locationEnabled') !== 'false'

export const getCurrentLocation = (): Promise<GeoLocation> => {
  return new Promise((resolve, reject) => {
    if (!isLocationEnabled()) {
      reject(new Error('Location disabled'))
      return
    }

    if (!navigator.geolocation) {
      ElMessage.error({ message: i18n.global.t('location.unsupported') })
      reject(new Error('Geolocation is not supported by this browser.'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        })
      },
      (error) => {
        if (error.code === 1) {
          ElMessage.error({ message: i18n.global.t('location.denied') })
        }
        reject(error)
      }
    )
  })
}

export const getCurrentLocationOrNull = async (timeoutMs = 4000): Promise<GeoLocation | null> => {
  if (!isLocationEnabled()) {
    return null
  }

  try {
    return await Promise.race([
      getCurrentLocation(),
      new Promise<GeoLocation>((_, reject) => {
        setTimeout(() => reject(new Error('Location timeout')), timeoutMs)
      }),
    ])
  } catch {
    return null
  }
}
