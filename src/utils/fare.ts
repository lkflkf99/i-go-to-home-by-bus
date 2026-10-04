import type { BusRoute, Company } from '@/model'
import { getCompany } from '@/utils/route'

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

const readFares = (): RouteFareMap => {
  if (memory) {
    return memory
  }

  try {
    memory = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as RouteFareMap
  } catch {
    memory = {}
  }

  return memory
}

export const saveRouteFares = (fares: RouteFareMap) => {
  memory = fares
  localStorage.setItem(STORAGE_KEY, JSON.stringify(fares))
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
