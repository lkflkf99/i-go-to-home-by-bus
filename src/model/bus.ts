interface BusResponseBase<T> {
  type: string
  version: string
  generated_timestamp: string
  data: T
}

export interface RouteStop {
  route: string
  bound?: string
  dir?: string
  service_type?: string
  seq: string | number
  stop: string
  co?: string
}

export interface Stop {
  stop: string
  name_en: string
  name_tc: string
  name_sc: string
  lat: string
  long: string
  co?: Company
}

export interface Eta {
  co: string
  route: string
  dir: string
  service_type: number
  seq: number
  stop?: string
  dest_tc: string
  dest_sc: string
  dest_en: string
  eta_seq: number
  eta: string | null
  rmk_tc: string
  rmk_sc: string
  rmk_en: string
  data_timestamp: string
}

export type Company = 'KMB' | 'CTB'

export interface BusRoute {
  route: string
  orig_tc: string
  dest_tc: string
  orig_en?: string
  dest_en?: string
  service_type?: string | number
  bound?: string
  co?: Company | string
}

export interface SavedPlace {
  stop: string
  name_tc: string
  name_en: string
  lat: string
  long: string
}

export interface LiveFavorite extends BusRoute {
  co: Company
  nearestStopName: string
  nearestStopNameEn?: string
  nearestStopId: string
  nearestDistance: number | null
  direction: 'inbound' | 'outbound'
  etas: Array<string | null>
  servesPlace: boolean
  fare?: string | null
}

export interface PlannedRoute {
  route: string
  service_type: string | number
  co: Company
  dest_tc: string
  dest_en?: string
  orig_tc: string
  orig_en?: string
  boardStopName: string
  boardStopNameEn?: string
  boardStopId: string
  walkDistance: number | null
  direction: 'inbound' | 'outbound'
  etas: Array<string | null>
  fare?: string | null
}

export type RouteStopResp = BusResponseBase<RouteStop[]>
export type StopResp = BusResponseBase<Stop>
export type EtaResp = BusResponseBase<Eta[]>
