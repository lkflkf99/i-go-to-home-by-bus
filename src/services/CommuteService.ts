import haversine from 'haversine-distance'
import API from '@/services/ApiService'
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
import { getCompany } from '@/utils'

export interface GeoLocation {
  latitude: number
  longitude: number
}

interface ResolvedStop {
  stop: string
  name_tc: string
  lat: string
  long: string
  seq: number
  distance: number
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
const MAX_NEARBY_STOPS = 8
const MAX_CTB_PLAN = 10

const routeStopCache = new Map<string, ResolvedStop[]>()
const stopDetailCache = new Map<string, Stop>()

const directionMeta = {
  outbound: { name: 'outbound' as const, code: 'O' as const },
  inbound: { name: 'inbound' as const, code: 'I' as const },
}

export const getCachedStops = (): Stop[] => {
  try {
    return JSON.parse(localStorage.getItem('stops') || '[]')
  } catch {
    return []
  }
}

const seedStopCache = () => {
  if (stopDetailCache.size) {
    return
  }
  getCachedStops().forEach((stop) => {
    stopDetailCache.set(stop.stop, stop)
  })
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
    .filter((stop) => {
      return (
        stop.name_tc.toLowerCase().includes(q) ||
        stop.name_en.toLowerCase().includes(q) ||
        (stop.name_sc && stop.name_sc.toLowerCase().includes(q))
      )
    })
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
    : `/ctb/route-stop/CTB/${route.route}/${direction}`
}

const stopDetailsUrl = (company: Company, stopId: string) => {
  return company === 'KMB' ? `/kmb/stop/${stopId}` : `/ctb/stop/${stopId}`
}

const etaUrl = (route: BusRoute, stopId: string) => {
  const company = getCompany(route)
  return company === 'KMB'
    ? `/kmb/eta/${stopId}/${route.route}/${route.service_type || 1}`
    : `/ctb/eta/CTB/${stopId}/${route.route}`
}

const cacheKey = (route: BusRoute, direction: 'inbound' | 'outbound') => {
  return `${routeKeySafe(route)}-${direction}`
}

const routeKeySafe = (route: BusRoute) => {
  return `${getCompany(route)}-${route.route}-${route.service_type || '1'}`
}

const resolveStop = async (company: Company, routeStop: RouteStop): Promise<ResolvedStop | null> => {
  seedStopCache()
  const cached = stopDetailCache.get(routeStop.stop)
  if (cached) {
    return {
      stop: cached.stop,
      name_tc: cached.name_tc,
      lat: cached.lat,
      long: cached.long,
      seq: Number(routeStop.seq),
      distance: Infinity,
    }
  }

  try {
    const { data } = await API.get<StopResp>(stopDetailsUrl(company, routeStop.stop))
    stopDetailCache.set(routeStop.stop, data.data)
    return {
      stop: data.data.stop,
      name_tc: data.data.name_tc,
      lat: data.data.lat,
      long: data.data.long,
      seq: Number(routeStop.seq),
      distance: Infinity,
    }
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
  const cached = routeStopCache.get(key)
  if (cached) {
    return withDistance(cached, location)
  }

  try {
    const { data } = await API.get<RouteStopResp>(routeStopUrl(route, direction))
    const company = getCompany(route)
    const resolved = (
      await Promise.all((data.data || []).map((item) => resolveStop(company, item)))
    ).filter((item): item is ResolvedStop => !!item)

    routeStopCache.set(key, resolved)
    return withDistance(resolved, location)
  } catch {
    return []
  }
}

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

const fetchEtas = async (route: BusRoute, stopId: string, dirCode: 'I' | 'O') => {
  try {
    const { data } = await API.get<EtaResp>(etaUrl(route, stopId))
    return upcomingEtas(data.data || [], dirCode)
  } catch {
    return []
  }
}

const toLiveFavorite = (
  route: BusRoute,
  leg: DirectionLeg | null,
  etas: Array<string | null>,
  servesPlace: boolean
): LiveFavorite => {
  const nearest = leg?.nearest
  const dest =
    leg?.direction === 'inbound' ? route.orig_tc : route.dest_tc
  const orig =
    leg?.direction === 'inbound' ? route.dest_tc : route.orig_tc

  return {
    ...route,
    co: getCompany(route),
    orig_tc: orig,
    dest_tc: dest,
    nearestStopName: nearest?.name_tc || '-',
    nearestStopId: nearest?.stop || '',
    nearestDistance: nearest && Number.isFinite(nearest.distance) ? nearest.distance : null,
    direction: leg?.direction || 'outbound',
    etas,
    servesPlace,
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
  const etas =
    leg?.nearest ? await fetchEtas(route, leg.nearest.stop, leg.dirCode) : []

  return toLiveFavorite(route, leg, etas, servesPlace)
}

export const refreshFavoriteEtas = async (item: LiveFavorite): Promise<LiveFavorite> => {
  if (!item.nearestStopId) {
    return item
  }
  const dirCode = item.direction === 'inbound' ? 'I' : 'O'
  const etas = await fetchEtas(item, item.nearestStopId, dirCode)
  return { ...item, etas }
}

const includesQuery = (value: string | undefined, query: string) => {
  return !!value && value.toLowerCase().includes(query)
}

const namesOverlap = (a: string, b: string) => {
  return a.includes(b) || b.includes(a)
}

export const planRoutes = async (
  location: GeoLocation,
  destQuery: string
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
    .filter((stop) => stop.distance <= NEARBY_STOP_M)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, MAX_NEARBY_STOPS)

  const nearbyNames = nearbyStops.map((stop) => stop.name_tc)
  const kmbResults = await Promise.all(
    nearbyStops.map(async (stop) => {
      try {
        const { data } = await API.get<EtaResp>(`/kmb/stop-eta/${stop.stop}`)
        return (data.data || [])
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
      } catch {
        return []
      }
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
    planned.set(key, {
      route: eta.route,
      service_type: eta.service_type || 1,
      co: 'KMB',
      dest_tc: eta.dest_tc,
      orig_tc: stop.name_tc,
      boardStopName: stop.name_tc,
      boardStopId: stop.stop,
      walkDistance: stop.distance,
      direction: dirCode === 'I' ? 'inbound' : 'outbound',
      etas: [],
    })
  })

  planned.forEach((item) => {
    const dirCode = item.direction === 'inbound' ? 'I' : 'O'
    item.etas = upcomingEtas(etasByBoard.get(`${item.boardStopId}-${item.route}-${dirCode}`) || [], dirCode)
  })

  let ctbRoutes: BusRoute[] = []
  try {
    ctbRoutes = JSON.parse(localStorage.getItem('routes') || '[]').filter(
      (route: BusRoute) => getCompany(route) === 'CTB'
    )
  } catch {
    ctbRoutes = []
  }

  const ctbMatches = ctbRoutes
    .filter((route) => {
      const destMatch =
        includesQuery(route.dest_tc, query) ||
        includesQuery(route.dest_en, query) ||
        includesQuery(route.orig_tc, query) ||
        includesQuery(route.orig_en, query)
      const origNear = nearbyNames.some((name) => namesOverlap(name, route.orig_tc || ''))
      return destMatch && origNear
    })
    .slice(0, MAX_CTB_PLAN)

  await Promise.all(
    ctbMatches.map(async (route) => {
      const destIsOrig =
        includesQuery(route.orig_tc, query) || includesQuery(route.orig_en, query)
      const direction = destIsOrig ? 'inbound' : 'outbound'
      const stops = await fetchDirectionStops(route, direction, location)
      const board = nearestStop(stops)
      if (!board || board.distance > NEARBY_STOP_M) {
        return
      }

      const dest = direction === 'inbound' ? route.orig_tc : route.dest_tc
      const key = `CTB-${route.route}-${dest}`
      if (planned.has(key)) {
        return
      }

      const etas = await fetchEtas(route, board.stop, direction === 'inbound' ? 'I' : 'O')
      planned.set(key, {
        route: route.route,
        service_type: route.service_type || 1,
        co: 'CTB',
        dest_tc: dest,
        orig_tc: direction === 'inbound' ? route.dest_tc : route.orig_tc,
        boardStopName: board.name_tc,
        boardStopId: board.stop,
        walkDistance: Number.isFinite(board.distance) ? board.distance : null,
        direction,
        etas,
      })
    })
  )

  return Array.from(planned.values()).sort((a, b) => {
    const aEta = a.etas[0] || '9999'
    const bEta = b.etas[0] || '9999'
    if (aEta !== bEta) {
      return aEta.localeCompare(bEta)
    }
    return (a.walkDistance ?? Infinity) - (b.walkDistance ?? Infinity)
  })
}
