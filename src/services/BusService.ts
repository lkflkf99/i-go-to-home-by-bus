import API from '@/services/ApiService'

export const fetchBusData = async () => {
  const { data: kmbRoute } = await API.get('/kmb/route')
  const { data: ctbRoute } = await API.get('/ctb/route/CTB')
  const { data: kmbStops } = await API.get('/kmb/stop')

  const routes = kmbRoute.data.filter((item) => item.bound === 'O').concat(ctbRoute.data)

  localStorage.setItem('stops', JSON.stringify(kmbStops.data))
  localStorage.setItem('routes', JSON.stringify(routes))
  localStorage.setItem('dbLastUpdateTime', new Date().toISOString())

  return new Date().toISOString()
}