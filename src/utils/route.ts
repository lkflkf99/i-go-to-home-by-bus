import type { BusRoute, Company } from '@/model'

export const getCompany = (route: Pick<BusRoute, 'co'>): Company => {
  return route.co === 'CTB' ? 'CTB' : 'KMB'
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
