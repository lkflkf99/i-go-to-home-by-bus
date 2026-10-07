import { CATALOG_TTL_MS, invalidatePrefix } from '@/services/HttpCache'
import {
  getRouteStopMap,
  hasRouteVariants,
  hasTimetableData,
  saveCatalog,
  saveRouteFares,
  saveRouteStops,
  saveRouteTimetable,
  saveRouteVariants,
} from '@/utils'
import { sortRouteNumbers } from '@/utils/route'
import type { RouteVariantMap } from '@/utils/routeVariants'
import type { BusRoute, Stop } from '@/model'
import type { RouteFareMap } from '@/utils/fare'
import type { RouteStopMap } from '@/utils/routeStops'
import type { RouteFreq, RouteTimetableMap, ServiceDayMap } from '@/utils/timetable'

const HKBUS_DB_URL = 'https://data.hkbus.app/routeFareList.min.json'
const HKBUS_TIMEOUT_MS = 45000

interface HkbusStop {
  location?: { lat?: number; lng?: number }
  name?: { en?: string; zh?: string }
}

interface HkbusName {
  en?: string
  zh?: string
}

interface HkbusRoute {
  route?: string
  co?: string[]
  orig?: HkbusName
  dest?: HkbusName
  serviceType?: string | number
  bound?: Record<string, string>
  fares?: string[]
  freq?: RouteFreq
  jt?: string | number | null
  stops?: { kmb?: string[]; ctb?: string[] }
}

interface HkbusDb {
  holidays?: string[]
  serviceDayMap?: ServiceDayMap
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

const CTB_BOUND_RANK: Record<string, number> = { O: 0, OI: 1, IO: 2, I: 3 }

const toStop = (stopId: string, info: HkbusStop, co: 'KMB' | 'CTB'): Stop | null => {
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
    co,
  }
}

const toBusRoute = (
  route: HkbusRoute,
  co: 'KMB' | 'CTB',
  serviceType: string,
  bound: string
): BusRoute => {
  const orig = route.orig || {}
  const dest = route.dest || {}
  return {
    route: route.route || '',
    co,
    service_type: serviceType,
    bound: bound === 'I' ? 'I' : 'O',
    orig_tc: orig.zh || '',
    orig_en: orig.en || '',
    dest_tc: dest.zh || '',
    dest_en: dest.en || '',
  }
}

const ctbRouteRank = (bound: string | undefined, serviceType: string) => {
  const boundRank = bound && bound in CTB_BOUND_RANK ? CTB_BOUND_RANK[bound] : 4
  return boundRank * 2 + (serviceType === '1' ? 0 : 1)
}

const compareRoutes = (a: BusRoute, b: BusRoute) => {
  const byNumber = sortRouteNumbers(a.route, b.route)
  if (byNumber !== 0) {
    return byNumber
  }
  return String(a.service_type || 1).localeCompare(String(b.service_type || 1), undefined, {
    numeric: true,
  })
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
  const timetable: RouteTimetableMap = {}
  const variants: RouteVariantMap = {}
  const kmbSeen = new Set<string>()
  const kmbRoutes: BusRoute[] = []
  const ctbBest = new Map<string, { rank: number; route: BusRoute }>()

  Object.values(db.routeList || {}).forEach((route) => {
    if (!route.route) {
      return
    }

    const routeNo = route.route
    const serviceType = String(route.serviceType || 1)
    const companies = route.co || []
    const fareList = route.fares || []

    if (companies.includes('kmb')) {
      const bound = route.bound?.kmb
      if ((bound === 'O' || bound === 'OI') && !kmbSeen.has(`${routeNo}-${serviceType}`)) {
        kmbSeen.add(`${routeNo}-${serviceType}`)
        kmbRoutes.push(toBusRoute(route, 'KMB', serviceType, 'O'))
      }
    }

    if (companies.includes('ctb')) {
      const bound = route.bound?.ctb
      const rank = ctbRouteRank(bound, serviceType)
      const current = ctbBest.get(routeNo)
      if (!current || rank < current.rank) {
        ctbBest.set(routeNo, {
          rank,
          route: toBusRoute(route, 'CTB', serviceType, bound || ''),
        })
      }
    }

    const jt = route.jt != null && route.jt !== '' ? Number(route.jt) : null
    const freq = route.freq && Object.keys(route.freq).length ? route.freq : undefined
    const orig = route.orig || {}
    const dest = route.dest || {}

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

      const companyCode = company.toUpperCase() as 'KMB' | 'CTB'
      const rawBound = route.bound?.[company]
      const variantBound =
        rawBound === 'I' || rawBound === 'O' || rawBound === 'OI' ? rawBound : null
      if (variantBound) {
        const group = `${companyCode}-${routeNo}`
        variants[group] = (variants[group] || []).concat({
          co: companyCode,
          route: routeNo,
          service_type: serviceType,
          bound: variantBound,
          orig_tc: orig.zh || '',
          orig_en: orig.en || '',
          dest_tc: dest.zh || '',
          dest_en: dest.en || '',
          stopIds: stops,
          ...(freq ? { freq } : {}),
          ...(jt != null && Number.isFinite(jt) ? { jt } : {}),
        })
      }

      boundsFor(rawBound).forEach((bound) => {
        const key = `${companyCode}-${routeNo}-${serviceType}-${bound}`
        const existing = routeStops[key] || []
        routeStops[key] = existing.concat(stops.filter((stopId) => !existing.includes(stopId)))
        if (fareList.length) {
          fares[key] = { ...(fares[key] || {}), ...byStop }
        }
        if (freq || (jt != null && Number.isFinite(jt))) {
          timetable[key] = {
            ...(timetable[key] || {}),
            ...(freq ? { freq } : {}),
            ...(jt != null && Number.isFinite(jt) ? { jt } : {}),
          }
        }
      })
    })
  })

  const ctbStops = Array.from(ctbIds)
    .map((stopId) => {
      const info = stopList[stopId]
      return info ? toStop(stopId, info, 'CTB') : null
    })
    .filter((stop): stop is Stop => !!stop)

  const kmbStops = Object.entries(stopList)
    .filter(([stopId]) => stopId.length === 16)
    .map(([stopId, info]) => toStop(stopId, info, 'KMB'))
    .filter((stop): stop is Stop => !!stop)

  const ctbRoutes = Array.from(ctbBest.values(), (item) => item.route)

  return {
    ctbStops,
    kmbStops,
    routes: kmbRoutes.sort(compareRoutes).concat(ctbRoutes.sort(compareRoutes)),
    fares,
    routeStops,
    variants,
    timetable: {
      holidays: db.holidays || [],
      serviceDayMap: db.serviceDayMap || {},
      routes: timetable,
    },
  }
}

const persistHkbusIndex = (hkbus: {
  fares: RouteFareMap
  routeStops: RouteStopMap
  variants?: RouteVariantMap
  timetable: { holidays: string[]; serviceDayMap: ServiceDayMap; routes: RouteTimetableMap }
}) => {
  if (Object.keys(hkbus.routeStops).length) {
    saveRouteStops(hkbus.routeStops)
  }
  if (Object.keys(hkbus.fares).length) {
    saveRouteFares(hkbus.fares)
  }
  if (hkbus.variants && Object.keys(hkbus.variants).length) {
    saveRouteVariants(hkbus.variants)
  }
  if (Object.keys(hkbus.timetable.routes).length) {
    saveRouteTimetable(hkbus.timetable)
  }
  localStorage.removeItem('stopAliases')
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
  localStorage.removeItem('stopAliases')
  if (Object.keys(getRouteStopMap()).length && hasTimetableData() && hasRouteVariants()) {
    return
  }

  persistHkbusIndex(await fetchHkbusCatalog())
}

export const fetchBusData = async () => {
  const hkbus = await fetchHkbusCatalog()

  persistHkbusIndex(hkbus)
  saveCatalog({
    stops: hkbus.kmbStops.concat(hkbus.ctbStops),
    routes: hkbus.routes,
  })
  localStorage.setItem('dbLastUpdateTime', new Date().toISOString())
  invalidatePrefix('route-stop:')
  invalidatePrefix('stop:')
  invalidatePrefix('eta:')

  return new Date().toISOString()
}
