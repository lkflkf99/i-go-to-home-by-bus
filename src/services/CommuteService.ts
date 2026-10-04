import haversine from 'haversine-distance'
import API from '@/services/ApiService'
import { CATALOG_TTL_MS, ETA_TTL_MS, cachedGet, invalidatePrefix } from '@/services/HttpCache'
import type {
  BusRoute,
  Company,
  Eta,
  EtaResp,
  LiveFavorite,
  PlannedRoute,
  RouteStop,
  RouteStopResp,
  SavedPlace,
  Stop,
  StopResp,
} from '@/model'
import {
  addCachedStop,
  expandStopIds,
  getCachedCtbRoute,
  getCachedRoutes,
  getCachedStops,
  getCatalogRevision,
  getCompany,
  getRouteJt,
  getRouteStopFare,
  getRouteStopMap,
  getRoutesThroughStop,
  getStopCompany,
  includesQuery,
  isRouteServingNow,
  parseRouteCatalogKey,
  resetCatalogCache,
  resetFareCache,
  resetRouteStopCache,
  resetStopAliasCache,
  resetTimetableCache,
  routeKey,
  scaleJourneyMinutes,
  sortRouteNumbers,
  stopMatchesQuery,
  stopsSharePole,
} from '@/utils'

export interface GeoLocation {
  latitude: number
  longitude: number
}

export interface ResolvedStop {
  stop: string
  name_tc: string
  name_en: string
  lat: string
  long: string
  seq: number
  distance: number
  fare?: string | null
}

interface DirectionLeg {
  direction: 'inbound' | 'outbound'
  dirCode: 'I' | 'O'
  stops: ResolvedStop[]
  nearest: ResolvedStop | null
  placeStop: ResolvedStop | null
}

const PLACE_RADIUS_M = 400
const NEARBY_STOP_M = 800
const MAP_RADIUS_M = 1000
const MAP_CLUSTER_M = 30
const MAX_NEARBY_STOPS = 8
const MAX_MAP_STOPS = 28
const MAX_CTB_MAP_ROUTES = 8
const MAX_PLAN_VIA = 12

const stopDetailCache = new Map<string, Stop>()
const ctbRoutesAtStop = new Map<string, Set<string>>()
const CTB_COMPANY = 'CTB'
let seededRevision = -1

const directionMeta = {
  outbound: { name: 'outbound' as const, code: 'O' as const },
  inbound: { name: 'inbound' as const, code: 'I' as const },
}

const rememberCtbRouteAtStop = (stopId: string, route: string) => {
  const routes = ctbRoutesAtStop.get(stopId) || new Set<string>()
  routes.add(route)
  ctbRoutesAtStop.set(stopId, routes)
}

export { getCachedRoutes, getCachedStops }

const persistDiscoveredStop = (stop: Stop, company: Company) => {
  if (company !== 'CTB') {
    return
  }

  addCachedStop({ ...stop, co: 'CTB' })
  stopDetailCache.set(stop.stop, stop)
}

const seedStopCache = () => {
  const revision = getCatalogRevision()
  if (stopDetailCache.size && seededRevision === revision) {
    return
  }

  stopDetailCache.clear()
  ctbRoutesAtStop.clear()
  getCachedStops().forEach((stop) => {
    stopDetailCache.set(stop.stop, stop)
  })
  seededRevision = revision
}

export const resetCommuteCaches = () => {
  stopDetailCache.clear()
  ctbRoutesAtStop.clear()
  seededRevision = -1
  resetCatalogCache()
  resetFareCache()
  resetRouteStopCache()
  resetTimetableCache()
  resetStopAliasCache()
  invalidatePrefix('route-stop:')
  invalidatePrefix('stop:')
  invalidatePrefix('eta:')
}

const toPlace = (stop: Stop): SavedPlace => ({
  stop: stop.stop,
  name_tc: stop.name_tc,
  name_en: stop.name_en,
  lat: stop.lat,
  long: stop.long,
})

export const searchStops = (query: string, limit = 30): SavedPlace[] => {
  const q = query.trim().toLowerCase()
  if (!q) {
    return []
  }

  return getCachedStops()
    .filter((stop) => stopMatchesQuery(stop, q))
    .slice(0, limit)
    .map(toPlace)
}

export const findNearestStop = (location: GeoLocation): SavedPlace | null => {
  const stops = getCachedStops()
  if (!stops.length) {
    return null
  }

  let nearest = stops[0]
  let nearestDistance = Infinity

  stops.forEach((stop) => {
    const distance = haversine(location, {
      latitude: Number(stop.lat),
      longitude: Number(stop.long),
    })
    if (distance < nearestDistance) {
      nearest = stop
      nearestDistance = distance
    }
  })

  return toPlace(nearest)
}

const routeStopUrl = (route: BusRoute, direction: 'inbound' | 'outbound') => {
  const company = getCompany(route)
  const serviceType = route.service_type || 1
  return company === 'KMB'
    ? `/kmb/route-stop/${route.route}/${direction}/${serviceType}`
    : `/ctb/route-stop/${CTB_COMPANY}/${route.route}/${direction}`
}

const stopDetailsUrl = (company: Company, stopId: string) => {
  return company === 'KMB' ? `/kmb/stop/${stopId}` : `/ctb/stop/${stopId}`
}

const etaUrl = (route: Pick<BusRoute, 'route' | 'co' | 'service_type'>, stopId: string) => {
  const company = getCompany(route)
  return company === 'KMB'
    ? `/kmb/eta/${stopId}/${route.route}/${route.service_type || 1}`
    : `/ctb/eta/${CTB_COMPANY}/${stopId}/${route.route}`
}

const toStop = (stop: Stop, company?: Company): Stop => ({
  ...stop,
  lat: String(stop.lat ?? ''),
  long: String(stop.long ?? ''),
  name_sc: stop.name_sc || '',
  co: company || stop.co,
})

const cacheKey = (route: BusRoute, direction: 'inbound' | 'outbound') => {
  return `${routeKey(route)}-${direction}`
}

const toResolvedStop = (stop: Stop, seq: number): ResolvedStop => ({
  stop: stop.stop,
  name_tc: stop.name_tc,
  name_en: stop.name_en,
  lat: stop.lat,
  long: stop.long,
  seq,
  distance: Infinity,
})

const resolveStop = async (
  company: Company,
  routeStop: RouteStop
): Promise<ResolvedStop | null> => {
  seedStopCache()
  const cached = stopDetailCache.get(routeStop.stop)
  if (cached) {
    return toResolvedStop(cached, Number(routeStop.seq))
  }

  try {
    const stop = await cachedGet(
      `stop:${routeStop.stop}`,
      async () => {
        const { data } = await API.get<StopResp>(stopDetailsUrl(company, routeStop.stop))
        return toStop(data.data, company)
      },
      { ttlMs: CATALOG_TTL_MS, persist: true }
    )
    stopDetailCache.set(routeStop.stop, stop)
    persistDiscoveredStop(stop, company)
    return toResolvedStop(stop, Number(routeStop.seq))
  } catch {
    return null
  }
}

const withDistance = (stops: ResolvedStop[], location: GeoLocation | null) => {
  return stops.map((stop) => ({
    ...stop,
    distance: location
      ? haversine(location, {
          latitude: Number(stop.lat),
          longitude: Number(stop.long),
        })
      : Infinity,
  }))
}

const fetchDirectionStops = async (
  route: BusRoute,
  direction: 'inbound' | 'outbound',
  location: GeoLocation | null
): Promise<ResolvedStop[]> => {
  const key = cacheKey(route, direction)
  try {
    const resolved = await cachedGet(
      `route-stop:${key}`,
      async () => {
        const { data } = await API.get<RouteStopResp>(routeStopUrl(route, direction))
        const company = getCompany(route)
        const routeStops = data.data || []
        if (company === 'CTB') {
          routeStops.forEach((item) => rememberCtbRouteAtStop(item.stop, route.route))
        }
        return (
          await Promise.all(routeStops.map((item) => resolveStop(company, item)))
        ).filter((item): item is ResolvedStop => !!item)
      },
      { ttlMs: CATALOG_TTL_MS, persist: true }
    )

    return withFares(route, direction, withDistance(resolved, location))
  } catch {
    return []
  }
}

const withFares = (
  route: BusRoute,
  direction: 'inbound' | 'outbound',
  stops: ResolvedStop[]
): ResolvedStop[] => {
  return stops.map((stop) => ({
    ...stop,
    fare: getRouteStopFare(route, direction, stop.stop),
  }))
}

export const loadRouteStops = fetchDirectionStops

const nearestStop = (stops: ResolvedStop[]) => {
  if (!stops.length) {
    return null
  }
  return stops.reduce((closest, stop) => (stop.distance < closest.distance ? stop : closest))
}

const stopNearPlace = (stops: ResolvedStop[], place: SavedPlace | null) => {
  if (!place) {
    return null
  }

  let match: ResolvedStop | null = null
  let matchDistance = Infinity

  stops.forEach((stop) => {
    const distance = haversine(
      { latitude: Number(place.lat), longitude: Number(place.long) },
      { latitude: Number(stop.lat), longitude: Number(stop.long) }
    )
    if (distance <= PLACE_RADIUS_M && distance < matchDistance) {
      match = stop
      matchDistance = distance
    }
  })

  return match
}

const buildLeg = async (
  route: BusRoute,
  direction: 'inbound' | 'outbound',
  location: GeoLocation | null,
  place: SavedPlace | null
): Promise<DirectionLeg> => {
  const stops = await fetchDirectionStops(route, direction, location)
  return {
    direction,
    dirCode: directionMeta[direction].code,
    stops,
    nearest: nearestStop(stops),
    placeStop: stopNearPlace(stops, place),
  }
}

const pickLeg = (legs: DirectionLeg[], place: SavedPlace | null): DirectionLeg | null => {
  const usable = legs.filter((leg) => leg.nearest)
  if (!usable.length) {
    return null
  }

  if (place) {
    const towardPlace = usable.filter((leg) => {
      return leg.placeStop && leg.nearest && leg.nearest.seq < leg.placeStop.seq
    })
    if (towardPlace.length) {
      return towardPlace.reduce((closest, leg) => {
        const closestDist = closest.nearest?.distance ?? Infinity
        const dist = leg.nearest?.distance ?? Infinity
        return dist < closestDist ? leg : closest
      })
    }

    const serving = usable.filter((leg) => leg.placeStop)
    if (serving.length) {
      return serving[0]
    }

    return null
  }

  return usable.reduce((closest, leg) => {
    const closestDist = closest.nearest?.distance ?? Infinity
    const dist = leg.nearest?.distance ?? Infinity
    return dist < closestDist ? leg : closest
  })
}

const upcomingEtas = (etas: Eta[], dirCode: 'I' | 'O') => {
  return etas
    .filter((item) => item.dir === dirCode && item.eta)
    .sort((a, b) => String(a.eta).localeCompare(String(b.eta)))
    .slice(0, 2)
    .map((item) => item.eta)
}

const sortEtas = (etas: Eta[]) => {
  return [...etas].sort((a, b) => String(a.eta || '').localeCompare(String(b.eta || '')))
}

const etaCacheKey = (route: Pick<BusRoute, 'route' | 'co' | 'service_type'>, stopId: string) => {
  return `eta:stop:${routeKey(route)}:${stopId}`
}

const fetchEtaList = async (
  route: Pick<BusRoute, 'route' | 'co' | 'service_type'>,
  stopId: string,
  options?: { force?: boolean }
): Promise<Eta[]> => {
  try {
    return await cachedGet(
      etaCacheKey(route, stopId),
      async () => {
        const { data } = await API.get<EtaResp>(etaUrl(route, stopId))
        return (data.data || []).map((item) => normalizeEta(item, getCompany(route)))
      },
      { ttlMs: ETA_TTL_MS, persist: false, force: options?.force }
    )
  } catch {
    return []
  }
}

const fetchKmbRouteEtas = async (
  route: BusRoute,
  options?: { force?: boolean }
): Promise<Eta[]> => {
  try {
    return await cachedGet(
      `eta:route:${routeKey(route)}`,
      async () => {
        const { data } = await API.get<EtaResp>(
          `/kmb/route-eta/${route.route}/${route.service_type || 1}`
        )
        return data.data || []
      },
      { ttlMs: ETA_TTL_MS, persist: false, force: options?.force }
    )
  } catch {
    return []
  }
}

const fetchEtas = async (
  route: BusRoute,
  stopId: string,
  dirCode: 'I' | 'O',
  options?: { force?: boolean }
) => {
  const etas = await fetchEtaList(route, stopId, options)
  return upcomingEtas(etas, dirCode)
}

export const loadRouteEtas = async (
  route: BusRoute,
  direction: 'inbound' | 'outbound',
  stops: ResolvedStop[],
  options?: { force?: boolean }
): Promise<Map<number, Eta[]>> => {
  const dirCode = direction === 'inbound' ? 'I' : 'O'
  const grouped = new Map<number, Eta[]>()

  if (getCompany(route) === 'KMB') {
    const etas = await fetchKmbRouteEtas(route, options)
    etas.forEach((eta) => {
      if (eta.dir !== dirCode) {
        return
      }
      const list = grouped.get(eta.seq) || []
      list.push(eta)
      grouped.set(eta.seq, list)
    })
    grouped.forEach((list, seq) => {
      grouped.set(seq, sortEtas(list))
    })
    return grouped
  }

  const entries = await Promise.all(
    stops.map(async (stop) => {
      const etas = await fetchEtaList(route, stop.stop, options)
      return [stop.seq, sortEtas(etas.filter((item) => item.dir === dirCode))] as const
    })
  )

  entries.forEach(([seq, etas]) => {
    grouped.set(seq, etas)
  })
  return grouped
}

interface BatchStopEta {
  co?: string
  route?: string
  dir?: string
  seq?: number
  stop?: string
  dest?: string
  dest_tc?: string
  dest_en?: string
  dest_sc?: string
  eta_seq?: number
  eta?: string | null
  rmk?: string
  rmk_tc?: string
  rmk_sc?: string
  rmk_en?: string
  data_timestamp?: string
}

export interface StopRouteSummary {
  co: string
  route: string
  service_type: number
  dest_tc: string
  dest_en: string
  dir: string
  etas: Array<string | null>
  fare?: string | null
}

export interface MapStop {
  id: string
  stop: string
  name_tc: string
  name_en: string
  lat: string
  long: string
  distance: number
  companies: string[]
  routeLabels: string[]
  members: Array<{ stop: string; co: Company }>
  etas: Eta[]
}

const ctbDestFromCatalog = (route: string, dir?: string) => {
  const item = getCachedCtbRoute(route)
  if (!item) {
    return { dest_tc: '', dest_en: '' }
  }
  if (dir === 'I') {
    return { dest_tc: item.orig_tc, dest_en: item.orig_en || '' }
  }
  return { dest_tc: item.dest_tc, dest_en: item.dest_en || '' }
}

const normalizeEta = (item: BatchStopEta, fallbackCo: string): Eta => {
  const company = item.co || fallbackCo
  const dest = company === 'CTB' ? ctbDestFromCatalog(item.route || '', item.dir) : { dest_tc: '', dest_en: '' }
  return {
    co: item.co || fallbackCo,
    route: item.route || '',
    dir: item.dir || '',
    service_type: 1,
    seq: Number(item.seq || 0),
    stop: item.stop,
    dest_tc: item.dest_tc || dest.dest_tc || item.dest || '',
    dest_sc: item.dest_sc || '',
    dest_en: item.dest_en || dest.dest_en || item.dest || '',
    eta_seq: Number(item.eta_seq || 0),
    eta: item.eta || null,
    rmk_tc: item.rmk_tc || item.rmk || '',
    rmk_sc: item.rmk_sc || '',
    rmk_en: item.rmk_en || item.rmk || '',
    data_timestamp: item.data_timestamp || '',
  }
}

export const fetchStopEtas = async (
  stopId: string,
  options?: { force?: boolean; company?: Company }
): Promise<Eta[]> => {
  const company = options?.company || getStopCompany(stopId)

  try {
    return await cachedGet(
      `eta:stop-eta:${company}:${stopId}`,
      async () => {
        if (company === 'CTB') {
          const routes = Array.from(ctbRoutesAtStop.get(stopId) || [])
          if (routes.length) {
            const lists = await Promise.all(
              routes.map((routeNo) => fetchEtaList({ route: routeNo, co: 'CTB' }, stopId, options))
            )
            return lists.flat()
          }

          const { data } = await API.get<EtaResp>(`/batch/stop-eta/${CTB_COMPANY}/${stopId}`)
          return (data.data || []).map((item) => normalizeEta(item, 'CTB'))
        }

        const { data } = await API.get<EtaResp>(`/kmb/stop-eta/${stopId}`)
        return data.data || []
      },
      { ttlMs: ETA_TTL_MS, persist: false, force: options?.force }
    )
  } catch {
    return []
  }
}

export const groupStopEtas = (etas: Eta[], stopId?: string): StopRouteSummary[] => {
  const grouped = new Map<string, StopRouteSummary>()

  sortEtas(etas).forEach((eta) => {
    if (!eta.route) {
      return
    }

    const co = eta.co || 'KMB'
    const key = `${co}-${eta.route}-${eta.dest_tc || eta.dest_en}-${eta.service_type || 1}`
    const existing = grouped.get(key)
    if (existing) {
      if (eta.eta && existing.etas.length < 3) {
        existing.etas.push(eta.eta)
      }
      return
    }

    grouped.set(key, {
      co,
      route: eta.route,
      service_type: eta.service_type || 1,
      dest_tc: eta.dest_tc,
      dest_en: eta.dest_en,
      dir: eta.dir,
      etas: eta.eta ? [eta.eta] : [],
      fare: getRouteStopFare(
        { route: eta.route, service_type: eta.service_type || 1, co },
        eta.dir === 'I' ? 'inbound' : 'outbound',
        eta.stop || stopId
      ),
    })
  })

  return Array.from(grouped.values()).sort((a, b) => {
    const routeOrder = sortRouteNumbers(a.route, b.route)
    if (routeOrder !== 0) {
      return routeOrder
    }
    return a.co.localeCompare(b.co)
  })
}

const toMapStop = (stop: Stop, distance: number, etas: Eta[]): MapStop => {
  const grouped = groupStopEtas(etas)
  const companies = Array.from(new Set(grouped.map((item) => item.co).filter(Boolean)))
  const routeLabels = Array.from(new Set(grouped.map((item) => item.route))).sort(sortRouteNumbers)
  const company = getStopCompany(stop)

  return {
    id: `${company}-${stop.stop}`,
    stop: stop.stop,
    name_tc: stop.name_tc,
    name_en: stop.name_en,
    lat: stop.lat,
    long: stop.long,
    distance,
    companies: companies.length ? companies : [company],
    routeLabels,
    members: [{ stop: stop.stop, co: company }],
    etas,
  }
}

const mergeMapStops = (items: MapStop[]): MapStop => {
  const [primary] = items
  const etas = items.flatMap((item) => item.etas)
  const grouped = groupStopEtas(etas)
  const companies = Array.from(new Set(grouped.map((item) => item.co).filter(Boolean)))

  return {
    ...primary,
    id: items.map((item) => item.id).join('|'),
    companies: companies.length ? companies : primary.companies,
    routeLabels: Array.from(new Set(grouped.map((item) => item.route))).sort(sortRouteNumbers),
    members: items.flatMap((item) => item.members),
    etas,
  }
}

const clusterMapStops = (stops: MapStop[]): MapStop[] => {
  const remaining = [...stops].sort((a, b) => a.distance - b.distance)
  const clusters: MapStop[] = []

  while (remaining.length) {
    const seed = remaining.shift()
    if (!seed) {
      break
    }

    const members = [seed]
    for (let index = remaining.length - 1; index >= 0; index -= 1) {
      const candidate = remaining[index]
      const distance = haversine(
        { latitude: Number(seed.lat), longitude: Number(seed.long) },
        { latitude: Number(candidate.lat), longitude: Number(candidate.long) }
      )
      if (distance <= MAP_CLUSTER_M || stopsSharePole(seed.stop, candidate.stop)) {
        members.push(candidate)
        remaining.splice(index, 1)
      }
    }

    clusters.push(members.length === 1 ? seed : mergeMapStops(members))
  }

  return clusters.slice(0, MAX_MAP_STOPS)
}

const stopsNearLocation = (location: GeoLocation, radius = MAP_RADIUS_M) => {
  return getCachedStops()
    .map((stop) => ({
      stop,
      distance: haversine(location, {
        latitude: Number(stop.lat),
        longitude: Number(stop.long),
      }),
    }))
    .filter((item) => Number.isFinite(item.distance) && item.distance <= radius)
    .sort((a, b) => a.distance - b.distance)
}

const discoverNearbyCtbStops = async (location: GeoLocation, nearbyNames: string[]): Promise<Stop[]> => {
  const cached = getCachedStops().filter((stop) => getStopCompany(stop) === 'CTB')
  const found = new Map<string, Stop>(cached.map((stop) => [stop.stop, stop]))

  const candidates = getCachedRoutes()
    .filter((item) => getCompany(item) === 'CTB')
    .filter((item) => {
      return nearbyNames.some((name) => {
        return namesOverlap(name, item.orig_tc || '') || namesOverlap(name, item.dest_tc || '')
      })
    })
    .slice(0, MAX_CTB_MAP_ROUTES)

  await Promise.all(
    candidates.map(async (item) => {
      const destIsNearby = nearbyNames.some((name) => namesOverlap(name, item.dest_tc || ''))
      const direction = destIsNearby && !nearbyNames.some((name) => namesOverlap(name, item.orig_tc || ''))
        ? 'inbound'
        : 'outbound'
      const stops = await fetchDirectionStops(item, direction, location)
      stops
        .filter((stop) => Number.isFinite(stop.distance) && stop.distance <= MAP_RADIUS_M)
        .forEach((stop) => {
          const next: Stop = {
            stop: stop.stop,
            name_tc: stop.name_tc,
            name_en: stop.name_en,
            name_sc: '',
            lat: stop.lat,
            long: stop.long,
            co: 'CTB',
          }
          found.set(stop.stop, next)
          persistDiscoveredStop(next, 'CTB')
        })
    })
  )

  return Array.from(found.values())
}

const hydrateMapStops = async (
  stops: Array<{ stop: Stop; distance: number }>
): Promise<MapStop[]> => {
  return Promise.all(
    stops.map(async ({ stop, distance }) => {
      const etas = await fetchStopEtas(stop.stop, { company: getStopCompany(stop) })
      return toMapStop(stop, distance, etas)
    })
  )
}

export const loadNearbyMapStops = async (
  location: GeoLocation,
  onUpdate?: (stops: MapStop[]) => void
): Promise<MapStop[]> => {
  seedStopCache()
  const nearby = stopsNearLocation(location)
  const kmbNearby = nearby.filter((item) => getStopCompany(item.stop) === 'KMB').slice(0, MAX_MAP_STOPS)
  const cachedCtbNearby = nearby
    .filter((item) => getStopCompany(item.stop) === 'CTB')
    .slice(0, MAX_MAP_STOPS)
  const kmbStops = await hydrateMapStops(kmbNearby)
  let clustered = clusterMapStops(kmbStops)
  onUpdate?.(clustered)

  const seen = new Set(kmbStops.flatMap((item) => item.members.map((member) => `${member.co}-${member.stop}`)))
  let extraCtb = cachedCtbNearby.filter((item) => !seen.has(`CTB-${item.stop.stop}`))

  if (!extraCtb.length && !cachedCtbNearby.length) {
    const hasCtbCatalog = getCachedStops().some((stop) => getStopCompany(stop) === 'CTB')
    if (!hasCtbCatalog) {
      const discovered = await discoverNearbyCtbStops(
        location,
        nearby.slice(0, MAX_NEARBY_STOPS).map((item) => item.stop.name_tc)
      )
      extraCtb = discovered
        .map((stop) => ({
          stop,
          distance: haversine(location, {
            latitude: Number(stop.lat),
            longitude: Number(stop.long),
          }),
        }))
        .filter((item) => {
          return (
            Number.isFinite(item.distance) &&
            item.distance <= MAP_RADIUS_M &&
            !seen.has(`CTB-${item.stop.stop}`)
          )
        })
    }
  }

  if (extraCtb.length) {
    clustered = clusterMapStops(kmbStops.concat(await hydrateMapStops(extraCtb)))
    onUpdate?.(clustered)
  }

  return clustered
}

const toLiveFavorite = (
  route: BusRoute,
  leg: DirectionLeg | null,
  etas: Array<string | null>,
  servesPlace: boolean
): LiveFavorite => {
  const nearest = leg?.nearest
  const inbound = leg?.direction === 'inbound'

  return {
    ...route,
    co: getCompany(route),
    orig_tc: inbound ? route.dest_tc : route.orig_tc,
    dest_tc: inbound ? route.orig_tc : route.dest_tc,
    orig_en: inbound ? route.dest_en : route.orig_en,
    dest_en: inbound ? route.orig_en : route.dest_en,
    nearestStopName: nearest?.name_tc || '-',
    nearestStopNameEn: nearest?.name_en || nearest?.name_tc || '-',
    nearestStopId: nearest?.stop || '',
    nearestDistance: nearest && Number.isFinite(nearest.distance) ? nearest.distance : null,
    direction: leg?.direction || 'outbound',
    etas,
    servesPlace,
    fare: nearest?.fare || null,
  }
}

export const loadLiveFavorite = async (
  route: BusRoute,
  location: GeoLocation | null,
  place: SavedPlace | null = null
): Promise<LiveFavorite> => {
  const [outbound, inbound] = await Promise.all([
    buildLeg(route, 'outbound', location, place),
    buildLeg(route, 'inbound', location, place),
  ])
  const servesPlace = !!(outbound.placeStop || inbound.placeStop)
  const leg = pickLeg([outbound, inbound], place)
  const etas = leg?.nearest ? await fetchEtas(route, leg.nearest.stop, leg.dirCode) : []

  return toLiveFavorite(route, leg, etas, servesPlace)
}

export const refreshFavoriteEtas = async (item: LiveFavorite): Promise<LiveFavorite> => {
  if (!item.nearestStopId) {
    return item
  }
  const dirCode = item.direction === 'inbound' ? 'I' : 'O'
  const etas = await fetchEtas(item, item.nearestStopId, dirCode, { force: true })
  return { ...item, etas }
}

const namesOverlap = (a: string, b: string) => {
  return a.includes(b) || b.includes(a)
}

export const planRoutes = async (
  location: GeoLocation,
  destQuery: string,
  destPlace?: SavedPlace | null
): Promise<PlannedRoute[]> => {
  const query = destQuery.trim().toLowerCase()
  if (!query) {
    return []
  }

  seedStopCache()
  const nearbyStops = getCachedStops()
    .map((stop) => ({
      ...stop,
      distance: haversine(location, {
        latitude: Number(stop.lat),
        longitude: Number(stop.long),
      }),
    }))
    .filter((stop) => Number.isFinite(stop.distance) && stop.distance <= NEARBY_STOP_M)
    .sort((a, b) => a.distance - b.distance)

  const nearbyKmb = nearbyStops
    .filter((stop) => getStopCompany(stop) === 'KMB')
    .slice(0, MAX_NEARBY_STOPS)
  const kmbResults = await Promise.all(
    nearbyKmb.map(async (stop) => {
      const etas = await fetchStopEtas(stop.stop)
      return etas
        .filter((eta) => {
          return (
            includesQuery(eta.dest_tc, query) ||
            includesQuery(eta.dest_en, query) ||
            includesQuery(eta.dest_sc, query)
          )
        })
        .map((eta) => ({
          eta,
          stop,
        }))
    })
  )

  const planned = new Map<string, PlannedRoute>()
  const etasByBoard = new Map<string, Eta[]>()

  kmbResults.flat().forEach(({ eta, stop }) => {
    if (!eta.route) {
      return
    }
    const boardKey = `${stop.stop}-${eta.route}-${eta.dir}`
    const list = etasByBoard.get(boardKey) || []
    list.push(eta)
    etasByBoard.set(boardKey, list)

    const key = `KMB-${eta.route}-${eta.dest_tc}`
    const existing = planned.get(key)
    if (existing && (existing.walkDistance ?? Infinity) <= stop.distance) {
      return
    }

    const dirCode = eta.dir === 'I' ? 'I' : 'O'
    const direction = dirCode === 'I' ? 'inbound' : 'outbound'
    const planRoute = { route: eta.route, service_type: eta.service_type || 1, co: 'KMB' as const }
    planned.set(key, {
      route: eta.route,
      service_type: eta.service_type || 1,
      co: 'KMB',
      dest_tc: eta.dest_tc,
      dest_en: eta.dest_en,
      orig_tc: stop.name_tc,
      orig_en: stop.name_en,
      boardStopName: stop.name_tc,
      boardStopNameEn: stop.name_en,
      boardStopId: stop.stop,
      walkDistance: stop.distance,
      direction,
      etas: [],
      fare: getRouteStopFare(planRoute, direction, stop.stop),
      journeyMin: getRouteJt(planRoute, direction),
      serving: isRouteServingNow(planRoute, direction),
    })
  })

  planned.forEach((item) => {
    const dirCode = item.direction === 'inbound' ? 'I' : 'O'
    item.etas = upcomingEtas(
      etasByBoard.get(`${item.boardStopId}-${item.route}-${dirCode}`) || [],
      dirCode
    )
  })

  const destIds = expandStopIds(
    getCachedStops()
      .filter((stop) => stopMatchesQuery(stop, query))
      .map((stop) => stop.stop)
      .concat(destPlace?.stop ? [destPlace.stop] : [])
  )
  const nearbyById = new Map(nearbyStops.map((stop) => [stop.stop, stop]))
  const viaMatches: PlannedRoute[] = []
  const routeStops = getRouteStopMap()
  const seenRoutes = new Set<string>()

  if (destIds.size && nearbyById.size) {
    nearbyStops.forEach((nearby) => {
      getRoutesThroughStop(nearby.stop).forEach(({ key }) => {
        if (seenRoutes.has(key)) {
          return
        }
        seenRoutes.add(key)

        const parsed = parseRouteCatalogKey(key)
        const stopIds = routeStops[key]
        if (!parsed || !stopIds) {
          return
        }

        let boardIdx = -1
        let destIdx = -1
        for (let index = 0; index < stopIds.length; index += 1) {
          const stopId = stopIds[index]
          if (boardIdx < 0 && nearbyById.has(stopId)) {
            boardIdx = index
          }
          if (boardIdx >= 0 && index > boardIdx && destIds.has(stopId)) {
            destIdx = index
            break
          }
        }
        if (boardIdx < 0 || destIdx < 0) {
          return
        }

        const board = nearbyById.get(stopIds[boardIdx])
        const destStop =
          stopDetailCache.get(stopIds[destIdx]) ||
          (destPlace && expandStopIds([destPlace.stop]).has(stopIds[destIdx]) ? destPlace : undefined)
        if (!board || !destStop) {
          return
        }

        const direction = parsed.bound === 'I' ? 'inbound' : 'outbound'
        const planRoute = {
          route: parsed.route,
          service_type: parsed.service_type,
          co: parsed.co,
        }
        viaMatches.push({
          route: parsed.route,
          service_type: parsed.service_type,
          co: parsed.co,
          dest_tc: destStop.name_tc,
          dest_en: destStop.name_en,
          orig_tc: board.name_tc,
          orig_en: board.name_en,
          boardStopName: board.name_tc,
          boardStopNameEn: board.name_en,
          boardStopId: board.stop,
          walkDistance: board.distance,
          direction,
          etas: [],
          fare: getRouteStopFare(planRoute, direction, board.stop),
          journeyMin: scaleJourneyMinutes(
            getRouteJt(planRoute, direction),
            boardIdx,
            destIdx,
            stopIds.length
          ),
          serving: isRouteServingNow(planRoute, direction),
        })
      })
    })
  }

  const viaToFetch = viaMatches
    .sort((a, b) => (a.walkDistance ?? Infinity) - (b.walkDistance ?? Infinity))
    .slice(0, MAX_PLAN_VIA)

  await Promise.all(
    viaToFetch.map(async (item) => {
      const key = `${item.co}-${item.route}-${item.dest_tc}`
      const existing = planned.get(key)
      if (existing && (existing.walkDistance ?? Infinity) <= (item.walkDistance ?? Infinity)) {
        return
      }

      const etas = await fetchEtas(
        {
          route: item.route,
          service_type: item.service_type,
          co: item.co,
          orig_tc: '',
          dest_tc: '',
        },
        item.boardStopId,
        item.direction === 'inbound' ? 'I' : 'O'
      )
      planned.set(key, { ...item, etas })
    })
  )

  return Array.from(planned.values()).sort((a, b) => {
    const rank = (item: PlannedRoute) => {
      if (item.etas[0]) {
        return 0
      }
      return item.serving === false ? 2 : 1
    }
    const aRank = rank(a)
    const bRank = rank(b)
    if (aRank !== bRank) {
      return aRank - bRank
    }
    const aEta = a.etas[0] || '9999'
    const bEta = b.etas[0] || '9999'
    if (aEta !== bEta) {
      return aEta.localeCompare(bEta)
    }
    return (a.walkDistance ?? Infinity) - (b.walkDistance ?? Infinity)
  })
}
