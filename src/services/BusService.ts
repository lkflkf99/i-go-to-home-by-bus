import API from '@/services/ApiService'
import { CATALOG_TTL_MS, invalidatePrefix } from '@/services/HttpCache'
import {
  getCachedStops,
  getRouteStopMap,
  getStopCompany,
  saveCatalog,
  saveRouteFares,
  saveRouteStops,
} from '@/utils'
import type { Stop } from '@/model'
import type { RouteFareMap } from '@/utils/fare'
import type { RouteStopMap } from '@/utils/routeStops'

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

const indexHkbusDb = (db: HkbusDb) => {
  const stopList = db.stopList || {}
  const ctbIds = new Set<string>()
  const fares: RouteFareMap = {}
  const routeStops: RouteStopMap = {}

  Object.values(db.routeList || {}).forEach((route) => {
    if (!route.route) {
      return
    }

    const serviceType = String(route.serviceType || 1)
    const companies = route.co || []
    const fareList = route.fares || []

    ;(['kmb', 'ctb'] as const).forEach((company) => {
      if (!companies.includes(company)) {
        return
      }

      const stops = route.stops?.[company] || []
      if (!stops.length) {
        return
      }

      if (company === 'ctb') {
        stops.forEach((stopId) => ctbIds.add(stopId))
      }

      const byStop: Record<string, string> = {}
      if (fareList.length) {
        stops.forEach((stopId, index) => {
          const fare = fareList[index]
          if (fare) {
            byStop[stopId] = String(fare)
          }
        })
      }

      boundsFor(route.bound?.[company]).forEach((bound) => {
        const key = `${company.toUpperCase()}-${route.route}-${serviceType}-${bound}`
        routeStops[key] = stops
        if (fareList.length) {
          fares[key] = { ...(fares[key] || {}), ...byStop }
        }
      })
    })
  })

  const ctbStops = Array.from(ctbIds)
    .map((stopId) => {
      const info = stopList[stopId]
      return info ? toCtbStop(stopId, info) : null
    })
    .filter((stop): stop is Stop => !!stop)

  return { ctbStops, fares, routeStops }
}

const persistHkbusIndex = (hkbus: { fares: RouteFareMap; routeStops: RouteStopMap }) => {
  if (Object.keys(hkbus.fares).length) {
    saveRouteFares(hkbus.fares)
  }
  if (Object.keys(hkbus.routeStops).length) {
    saveRouteStops(hkbus.routeStops)
  }
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

    return indexHkbusDb((await response.json()) as HkbusDb)
  } finally {
    window.clearTimeout(timer)
  }
}

export const ensureHkbusRouteIndex = async () => {
  if (Object.keys(getRouteStopMap()).length) {
    return
  }

  persistHkbusIndex(await fetchHkbusCatalog())
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

  if (hkbus) {
    persistHkbusIndex(hkbus)
  }

  saveCatalog({
    stops: kmbStopsTagged.concat(ctbStops),
    routes,
  })
  localStorage.setItem('dbLastUpdateTime', new Date().toISOString())
  invalidatePrefix('route-stop:')
  invalidatePrefix('stop:')
  invalidatePrefix('eta:')

  return new Date().toISOString()
}
