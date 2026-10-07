import type { BusRoute, Company } from '@/model'
import { getCompany } from '@/utils/route'
import { getRouteStopMap } from '@/utils/routeStops'

export type RouteFareMap = Record<string, Record<string, string>>

const STORAGE_KEY = 'routeFares'

let memory: RouteFareMap | null = null

const fareKey = (
  company: Company,
  route: string,
  serviceType: string | number | undefined,
  bound: 'I' | 'O'
) => {
  return `${company}-${route}-${serviceType || 1}-${bound}`
}

const expandFares = (stored: Record<string, string[] | Record<string, string>>): RouteFareMap => {
  const stops = getRouteStopMap()
  const fares: RouteFareMap = {}
  Object.entries(stored).forEach(([key, value]) => {
    if (!Array.isArray(value)) {
      fares[key] = value
      return
    }
    const ids = stops[key] || []
    const byStop: Record<string, string> = {}
    value.forEach((fare, index) => {
      const stopId = ids[index]
      if (stopId && fare) {
        byStop[stopId] = fare
      }
    })
    fares[key] = byStop
  })
  return fares
}

const readFares = (): RouteFareMap => {
  if (memory) {
    return memory
  }

  try {
    memory = expandFares(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'))
  } catch {
    memory = {}
  }

  return memory
}

export const saveRouteFares = (fares: RouteFareMap) => {
  memory = fares
  const stops = getRouteStopMap()
  const packed: Record<string, string[]> = {}
  Object.entries(fares).forEach(([key, byStop]) => {
    const ids = stops[key] || []
    packed[key] = (ids.length ? ids : Object.keys(byStop)).map((stopId) => byStop[stopId] || '')
  })
  localStorage.setItem(STORAGE_KEY, JSON.stringify(packed))
}

export const resetFareCache = () => {
  memory = null
}

export const formatFare = (fare?: string | null) => {
  if (!fare) {
    return ''
  }
  return `$${fare}`
}

export const getRouteStopFare = (
  route: Pick<BusRoute, 'route' | 'service_type' | 'co'>,
  direction: 'inbound' | 'outbound' | 'I' | 'O',
  stopId?: string | null
) => {
  if (!stopId) {
    return null
  }

  const table = readFares()
  const bound = direction === 'inbound' || direction === 'I' ? 'I' : 'O'
  const key = fareKey(getCompany(route), route.route, route.service_type, bound)
  return table[key]?.[stopId] || null
}
