import type { BusRoute, Stop } from '@/model'
import { getCompany } from '@/utils/route'

const STOPS_KEY = 'stops'
const ROUTES_KEY = 'routes'

let stopsMemory: Stop[] | null = null
let routesMemory: BusRoute[] | null = null
let ctbByRoute: Map<string, BusRoute> | null = null
let revision = 0

type StoredStop = [string, string, string, string, string]

const isStoredStop = (value: StoredStop | Stop): value is StoredStop => Array.isArray(value)

const packStop = (stop: Stop): StoredStop => [stop.stop, stop.name_en, stop.name_tc, stop.lat, stop.long]

const unpackStop = (value: StoredStop | Stop): Stop => {
  if (!isStoredStop(value)) {
    return { ...value, name_sc: value.name_sc || value.name_tc }
  }
  const [stop, name_en, name_tc, lat, long] = value
  return {
    stop,
    name_en,
    name_tc,
    name_sc: name_tc,
    lat,
    long,
    co: /^\d{6}$/.test(stop) ? 'CTB' : 'KMB',
  }
}

const readJson = <T>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

const bumpRevision = () => {
  revision += 1
  ctbByRoute = null
}

export const getCatalogRevision = () => revision

export const getCachedStops = (): Stop[] => {
  if (!stopsMemory) {
    stopsMemory = readJson<Array<StoredStop | Stop>>(STOPS_KEY, []).map(unpackStop)
  }
  return stopsMemory
}

export const getCachedRoutes = (): BusRoute[] => {
  if (!routesMemory) {
    routesMemory = readJson<BusRoute[]>(ROUTES_KEY, [])
  }
  return routesMemory
}

const getCtbRoutesByNumber = () => {
  if (!ctbByRoute) {
    ctbByRoute = new Map()
    getCachedRoutes().forEach((route) => {
      if (getCompany(route) === 'CTB') {
        ctbByRoute?.set(route.route, route)
      }
    })
  }
  return ctbByRoute
}

export const getCachedCtbRoute = (route: string) => {
  return getCtbRoutesByNumber().get(route)
}

export const saveCatalog = (catalog: { stops: Stop[]; routes: BusRoute[] }) => {
  stopsMemory = catalog.stops
  routesMemory = catalog.routes
  bumpRevision()
  localStorage.setItem(STOPS_KEY, JSON.stringify(catalog.stops.map(packStop)))
  localStorage.setItem(ROUTES_KEY, JSON.stringify(catalog.routes))
}

export const addCachedStop = (stop: Stop) => {
  const stops = getCachedStops()
  if (stops.some((item) => item.stop === stop.stop)) {
    return false
  }

  const next = stops.concat(stop)
  stopsMemory = next
  localStorage.setItem(STOPS_KEY, JSON.stringify(next.map(packStop)))
  return true
}

export const resetCatalogCache = () => {
  stopsMemory = null
  routesMemory = null
  bumpRevision()
}
