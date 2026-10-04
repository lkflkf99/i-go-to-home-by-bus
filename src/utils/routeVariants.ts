import type { BusRoute, Company } from '@/model'
import { getCompany } from '@/utils/route'
import type { RouteFreq } from '@/utils/timetable'
import { describeServiceDays, serviceWindowFromFreq } from '@/utils/timetable'
import { getCachedRoutes } from '@/utils/catalog'
import { getRouteStopMap } from '@/utils/routeStops'

export interface RouteVariant {
  co: Company
  route: string
  service_type: string
  bound: 'O' | 'I' | 'OI'
  orig_tc: string
  orig_en: string
  dest_tc: string
  dest_en: string
  stopIds: string[]
  freq?: RouteFreq
  jt?: number | null
}

export type RouteVariantMap = Record<string, RouteVariant[]>

const STORAGE_KEY = 'routeVariants'

let memory: RouteVariantMap | null = null

const readVariants = (): RouteVariantMap => {
  if (!memory) {
    try {
      memory = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as RouteVariantMap
    } catch {
      memory = {}
    }
  }
  return memory
}

export const saveRouteVariants = (variants: RouteVariantMap) => {
  memory = variants
  localStorage.setItem(STORAGE_KEY, JSON.stringify(variants))
}

export const resetRouteVariants = () => {
  memory = null
}

export const hasRouteVariants = () => {
  return Object.keys(readVariants()).length > 0
}

export const variantGroupKey = (company: Company, route: string) => {
  return `${company}-${route}`
}

export const boundMatchesDirection = (bound: RouteVariant['bound'], direction: 'inbound' | 'outbound') => {
  if (bound === 'OI') {
    return true
  }
  return direction === 'inbound' ? bound === 'I' : bound === 'O'
}

const sameName = (a?: string, b?: string) => {
  return (a || '').replace(/[\s／/]/g, '').toLowerCase() === (b || '').replace(/[\s／/]/g, '').toLowerCase()
}

export const isCircularVariant = (variant: Pick<RouteVariant, 'orig_tc' | 'orig_en' | 'dest_tc' | 'dest_en'>) => {
  return sameName(variant.orig_tc, variant.dest_tc) || sameName(variant.orig_en, variant.dest_en)
}

export const getVariantServiceWindow = (variant: RouteVariant) => {
  return serviceWindowFromFreq(variant.freq)
}

export const getVariantDayKind = (variant: RouteVariant) => {
  return describeServiceDays(variant.freq)
}

export const isVariantServingNow = (variant: RouteVariant) => {
  const window = getVariantServiceWindow(variant)
  return window ? window.serving : true
}

const fromCatalog = (company: Company, route: string): RouteVariant[] => {
  const map = getRouteStopMap()
  const prefix = `${company}-${route}-`
  const variants: RouteVariant[] = []

  Object.entries(map).forEach(([key, stopIds]) => {
    if (!key.startsWith(prefix) || !stopIds.length) {
      return
    }
    const parts = key.split('-')
    const serviceType = parts[2]
    const bound = parts[3]
    if ((bound !== 'O' && bound !== 'I') || !serviceType) {
      return
    }
    const match = getCachedRoutes().find((item) => {
      return getCompany(item) === company && item.route === route && String(item.service_type || 1) === serviceType
    })
    variants.push({
      co: company,
      route,
      service_type: serviceType,
      bound,
      orig_tc: match?.orig_tc || '',
      orig_en: match?.orig_en || '',
      dest_tc: match?.dest_tc || '',
      dest_en: match?.dest_en || '',
      stopIds,
    })
  })

  return variants
}

export const getRouteVariants = (company: Company, route: string): RouteVariant[] => {
  const stored = readVariants()[variantGroupKey(company, route)]
  if (stored?.length) {
    return stored
  }
  return fromCatalog(company, route)
}

export const variantsForDirection = (
  variants: RouteVariant[],
  direction: 'inbound' | 'outbound'
) => {
  return variants.filter((variant) => boundMatchesDirection(variant.bound, direction))
}

export const pickRouteVariant = (
  variants: RouteVariant[],
  preferredService?: string | number | null
): RouteVariant | null => {
  if (!variants.length) {
    return null
  }

  const preferred = preferredService
    ? variants.find((variant) => String(variant.service_type) === String(preferredService))
    : null
  const serving = variants.find((variant) => isVariantServingNow(variant))
  if (preferred && isVariantServingNow(preferred)) {
    return preferred
  }
  return serving || preferred || variants[0]
}

export const toVariantRoute = (variant: RouteVariant): BusRoute => {
  return {
    route: variant.route,
    service_type: variant.service_type,
    co: variant.co,
    orig_tc: variant.orig_tc,
    dest_tc: variant.dest_tc,
    orig_en: variant.orig_en,
    dest_en: variant.dest_en,
  }
}

export const variantKey = (variant: RouteVariant) => {
  return `${variant.co}-${variant.route}-${variant.service_type}-${variant.bound}-${variant.stopIds[0] || ''}-${variant.stopIds.length}`
}
