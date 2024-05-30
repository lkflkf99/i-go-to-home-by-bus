interface BusResponseBase<T> {
  type: string
  version: string
  generated_timestamp: string
  data: T
}

export interface RouteStop {
  route: string
  bound: string
  service_type: string
  seq: string
  stop: string
}

export interface Stop {
  stop: string
  name_en: string
  name_tc: string
  name_sc: string
  lat: string
  long: string
}

export interface Eta {
  co: string
  route: string
  dir: string
  service_type: number
  seq: number
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

export type RouteStopResp = BusResponseBase<RouteStop[]>
export type StopResp = BusResponseBase<Stop>
export type EtaResp = BusResponseBase<Eta[]>
