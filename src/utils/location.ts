import { ElMessage } from 'element-plus'

export const getCurrentLocation = () => {
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
          reject(error)
        }
      )
    } else {
      ElMessage.error({ message: 'Geolocation is not supported by this browser.' })
      reject(new Error('Geolocation is not supported by this browser.'))
    }
  })
}
