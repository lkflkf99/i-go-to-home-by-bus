import type { BusRoute, Company } from '@/model'
import { getCompany } from '@/utils/route'

export type RouteStopMap = Record<string, string[]>

const STORAGE_KEY = 'routeStops'

let memory: RouteStopMap | null = null

export const routeCatalogKey = (
  company: Company,
  route: string,
  serviceType: string | number | undefined,
  bound: 'I' | 'O'
) => {
  return `${company}-${route}-${serviceType || 1}-${bound}`
}

const readStops = (): RouteStopMap => {
  if (memory) {
    return memory
  }

  try {
    memory = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as RouteStopMap
  } catch {
    memory = {}
  }

  return memory
}

export const saveRouteStops = (stops: RouteStopMap) => {
  memory = stops
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stops))
}

export const resetRouteStopCache = () => {
  memory = null
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
