import API from '@/services/ApiService'
import { CATALOG_TTL_MS } from '@/services/HttpCache'
import { getCachedStops, resetCommuteCaches } from '@/services/CommuteService'
import { getStopCompany, saveRouteFares } from '@/utils'
import type { Stop } from '@/model'
import type { RouteFareMap } from '@/utils/fare'

const HKBUS_DB_URL = 'https://data.hkbus.app/routeFareList.min.json'
const HKBUS_TIMEOUT_MS = 45000

interface HkbusStop {
  location?: { lat?: number; lng?: number }
  name?: { en?: string; zh?: string }
}

interface HkbusRoute {
  route?: string
  co?: string[]
  serviceType?: string | number
  bound?: Record<string, string>
  fares?: string[]
  stops?: { kmb?: string[]; ctb?: string[] }
}

interface HkbusDb {
  routeList?: Record<string, HkbusRoute>
  stopList?: Record<string, HkbusStop>
}

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

const cachedCtbStops = () => {
  return getCachedStops().filter((stop) => getStopCompany(stop) === 'CTB')
}

const toCtbStop = (stopId: string, info: HkbusStop): Stop | null => {
  const name = info.name || {}
  const location = info.location || {}
  if (location.lat == null || location.lng == null) {
    return null
  }

  const zh = name.zh || ''
  return {
    stop: stopId,
    name_en: name.en || '',
    name_tc: zh,
    name_sc: zh,
    lat: String(location.lat),
    long: String(location.lng),
    co: 'CTB',
  }
}

const boundsFor = (bound?: string) => {
  if (bound === 'OI' || bound === 'IO') {
    return ['O', 'I'] as const
  }
  if (bound === 'O' || bound === 'I') {
    return [bound] as const
  }
  return []
}

const toCtbStops = (db: HkbusDb): Stop[] => {
  const stopList = db.stopList || {}
  const ids = new Set<string>()

  Object.values(db.routeList || {}).forEach((route) => {
    if (!(route.co || []).includes('ctb')) {
      return
    }
    ;(route.stops?.ctb || []).forEach((stopId) => ids.add(stopId))
  })

  return Array.from(ids)
    .map((stopId) => {
      const info = stopList[stopId]
      return info ? toCtbStop(stopId, info) : null
    })
    .filter((stop): stop is Stop => !!stop)
}

const toRouteFares = (db: HkbusDb): RouteFareMap => {
  const table: RouteFareMap = {}

  Object.values(db.routeList || {}).forEach((route) => {
    const fares = route.fares || []
    if (!route.route || !fares.length) {
      return
    }

    const serviceType = String(route.serviceType || 1)
    ;(['kmb', 'ctb'] as const).forEach((company) => {
      if (!(route.co || []).includes(company)) {
        return
      }

      const stops = route.stops?.[company] || []
      if (!stops.length) {
        return
      }

      const byStop: Record<string, string> = {}
      stops.forEach((stopId, index) => {
        const fare = fares[index]
        if (fare) {
          byStop[stopId] = String(fare)
        }
      })

      boundsFor(route.bound?.[company]).forEach((bound) => {
        const key = `${company.toUpperCase()}-${route.route}-${serviceType}-${bound}`
        table[key] = { ...(table[key] || {}), ...byStop }
      })
    })
  })

  return table
}

const fetchHkbusCatalog = async () => {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), HKBUS_TIMEOUT_MS)

  try {
    const response = await fetch(HKBUS_DB_URL, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
    if (!response.ok) {
      throw new Error(`hkbus ${response.status}`)
    }

    const db = (await response.json()) as HkbusDb
    return {
      ctbStops: toCtbStops(db),
      fares: toRouteFares(db),
    }
  } finally {
    window.clearTimeout(timer)
  }
}

export const fetchBusData = async () => {
  const [{ data: kmbRoute }, { data: ctbRoute }, { data: kmbStops }, hkbus] = await Promise.all([
    API.get('/kmb/route'),
    API.get('/ctb/route/CTB'),
    API.get('/kmb/stop'),
    fetchHkbusCatalog().catch(() => null),
  ])

  const ctbRoutes = (ctbRoute.data || []).map((item) => ({ ...item, co: 'CTB' as const }))
  const routes = kmbRoute.data.filter((item) => item.bound === 'O').concat(ctbRoutes)
  const kmbStopsTagged = (kmbStops.data || []).map((stop) => ({ ...stop, co: 'KMB' as const }))
  const ctbStops = hkbus?.ctbStops.length ? hkbus.ctbStops : cachedCtbStops()

  if (hkbus?.fares && Object.keys(hkbus.fares).length) {
    saveRouteFares(hkbus.fares)
  }

  localStorage.setItem('stops', JSON.stringify(kmbStopsTagged.concat(ctbStops)))
  localStorage.setItem('routes', JSON.stringify(routes))
  localStorage.setItem('dbLastUpdateTime', new Date().toISOString())
  resetCommuteCaches()

  return new Date().toISOString()
}
