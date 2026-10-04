import type { BusRoute, Company, Stop } from '@/model'

export const getCompany = (route: Pick<BusRoute, 'co'>): Company => {
  return route.co === 'CTB' ? 'CTB' : 'KMB'
}

export const getStopCompany = (stop: Pick<Stop, 'stop' | 'co'> | string): Company => {
  if (typeof stop === 'string') {
    return /^\d{6}$/.test(stop) ? 'CTB' : 'KMB'
  }
  if (stop.co === 'CTB' || stop.co === 'KMB') {
    return stop.co
  }
  return /^\d{6}$/.test(stop.stop) ? 'CTB' : 'KMB'
}

export const companyForDetails = (co?: string): Company => {
  return co === 'CTB' ? 'CTB' : 'KMB'
}

export const sortRouteNumbers = (a: string, b: string) => {
  const aNum = parseInt(a, 10)
  const bNum = parseInt(b, 10)
  if (!Number.isNaN(aNum) && !Number.isNaN(bNum) && aNum !== bNum) {
    return aNum - bNum
  }
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
}

export const routeKey = (route: Pick<BusRoute, 'route' | 'service_type' | 'co'>) => {
  return `${getCompany(route)}-${route.route}-${route.service_type || '1'}`
}

export const isSameRoute = (
  a: Pick<BusRoute, 'route' | 'service_type' | 'co'>,
  b: Pick<BusRoute, 'route' | 'service_type' | 'co'>
) => {
  return routeKey(a) === routeKey(b)
}

export const withCompany = (route: BusRoute): BusRoute => {
  return { ...route, co: getCompany(route) }
}

export const includesQuery = (value: string | undefined, query: string) => {
  return !!value && value.toLowerCase().includes(query)
}

const STOP_BAY_CODE = /\s*\([A-Za-z]{1,3}\d{2,4}\)\s*$/
const STOP_ALIGHTING = /\s*\(\s*(?:ALIGHTING(?:\s+STOP)?|落客站)\s*\)\s*$/i

export const normalizeStopName = (name = '') => {
  let next = name.trim()
  let prev = ''
  while (next && next !== prev) {
    prev = next
    next = next.replace(STOP_ALIGHTING, '').replace(STOP_BAY_CODE, '').trim()
  }
  return next
}

export const stopMatchesQuery = (
  stop: Pick<Stop, 'name_tc' | 'name_en'> & { name_sc?: string },
  query: string
) => {
  return (
    includesQuery(stop.name_tc, query) ||
    includesQuery(stop.name_en, query) ||
    includesQuery(stop.name_sc, query)
  )
}
