import API from '@/services/ApiService'
import { CATALOG_TTL_MS } from '@/services/HttpCache'
import { resetCommuteCaches } from '@/services/CommuteService'

export const isCatalogStale = () => {
  const last = localStorage.getItem('dbLastUpdateTime')
  if (!last) {
    return true
  }
  const updatedAt = Date.parse(last)
  if (Number.isNaN(updatedAt)) {
    return true
  }
  return Date.now() - updatedAt > CATALOG_TTL_MS
}

export const fetchBusData = async () => {
  const [{ data: kmbRoute }, { data: ctbRoute }, { data: kmbStops }] = await Promise.all([
    API.get('/kmb/route'),
    API.get('/ctb/route/CTB'),
    API.get('/kmb/stop'),
  ])

  const routes = kmbRoute.data.filter((item) => item.bound === 'O').concat(ctbRoute.data)

  localStorage.setItem('stops', JSON.stringify(kmbStops.data))
  localStorage.setItem('routes', JSON.stringify(routes))
  localStorage.setItem('dbLastUpdateTime', new Date().toISOString())
  resetCommuteCaches()

  return new Date().toISOString()
}
