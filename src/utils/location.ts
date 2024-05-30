import { ElMessage } from 'element-plus'

interface GeoLocation {
  latitude: number
  longitude: number
}

export const getCurrentLocation = (): Promise<GeoLocation> => {
  return new Promise((resolve, reject) => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          })
        },
        (error) => {
          if (error.code === 1) {
            ElMessage.error({ message: 'Please enable location permission' })
          }
          reject(error)
        }
      )
    } else {
      ElMessage.error({ message: 'Geolocation is not supported by this browser.' })
      reject(new Error('Geolocation is not supported by this browser.'))
    }
  })
}
