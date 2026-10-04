import type { BusRoute, Stop } from '@/model'
import { getCompany } from '@/utils/route'

const STOPS_KEY = 'stops'
const ROUTES_KEY = 'routes'

let stopsMemory: Stop[] | null = null
let routesMemory: BusRoute[] | null = null
let ctbByRoute: Map<string, BusRoute> | null = null
let revision = 0

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
    stopsMemory = readJson<Stop[]>(STOPS_KEY, [])
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
  localStorage.setItem(STOPS_KEY, JSON.stringify(catalog.stops))
  localStorage.setItem(ROUTES_KEY, JSON.stringify(catalog.routes))
}

export const addCachedStop = (stop: Stop) => {
  const stops = getCachedStops()
  if (stops.some((item) => item.stop === stop.stop)) {
    return false
  }

  const next = stops.concat(stop)
  stopsMemory = next
  localStorage.setItem(STOPS_KEY, JSON.stringify(next))
  return true
}

export const resetCatalogCache = () => {
  stopsMemory = null
  routesMemory = null
  bumpRevision()
}
