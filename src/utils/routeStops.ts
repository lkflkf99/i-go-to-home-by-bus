import type { BusRoute, Company } from '@/model'
import { getCompany } from '@/utils/route'

export type RouteStopMap = Record<string, string[]>
export type StopRouteRef = { key: string; index: number }

const STORAGE_KEY = 'routeStops'

let memory: RouteStopMap | null = null
let invert: Map<string, StopRouteRef[]> | null = null

export const routeCatalogKey = (
  company: Company,
  route: string,
  serviceType: string | number | undefined,
  bound: 'I' | 'O'
) => {
  return `${company}-${route}-${serviceType || 1}-${bound}`
}

const buildInvert = (table: RouteStopMap) => {
  invert = new Map()
  Object.entries(table).forEach(([key, stopIds]) => {
    stopIds.forEach((stopId, index) => {
      const list = invert?.get(stopId) || []
      list.push({ key, index })
      invert?.set(stopId, list)
    })
  })
}

const readStops = (): RouteStopMap => {
  if (!memory) {
    try {
      memory = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as RouteStopMap
    } catch {
      memory = {}
    }
  }

  if (!invert) {
    buildInvert(memory)
  }

  return memory
}

export const saveRouteStops = (stops: RouteStopMap) => {
  memory = stops
  buildInvert(stops)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stops))
}

export const resetRouteStopCache = () => {
  memory = null
  invert = null
}

export const getRoutesThroughStop = (stopId: string): StopRouteRef[] => {
  readStops()
  return invert?.get(stopId) || []
}

export const getRouteStopMap = () => {
  return readStops()
}

export const parseRouteCatalogKey = (key: string) => {
  const [company, route, serviceType, bound] = key.split('-')
  if ((company !== 'KMB' && company !== 'CTB') || !route || (bound !== 'I' && bound !== 'O')) {
    return null
  }

  return {
    co: company as Company,
    route,
    service_type: serviceType || '1',
    bound: bound as 'I' | 'O',
  }
}

export const getStopsOnRoute = (
  route: Pick<BusRoute, 'route' | 'service_type' | 'co'>,
  direction: 'inbound' | 'outbound' | 'I' | 'O'
) => {
  const bound = direction === 'inbound' || direction === 'I' ? 'I' : 'O'
  return readStops()[routeCatalogKey(getCompany(route), route.route, route.service_type, bound)] || []
}
