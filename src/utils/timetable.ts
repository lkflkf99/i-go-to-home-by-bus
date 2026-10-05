import type { BusRoute } from '@/model'
import { getCompany } from '@/utils/route'
import { routeCatalogKey } from '@/utils/routeStops'

export type FreqSlot = [string, string] | null
export type RouteFreq = Record<string, Record<string, FreqSlot>>
export type ServiceDayMap = Record<string, Array<'0' | '1' | string>>

export interface RouteTimetableMeta {
  freq?: RouteFreq
  jt?: number
}

export type RouteTimetableMap = Record<string, RouteTimetableMeta>

export interface ServiceWindow {
  first: string
  last: string
  serving: boolean
  headwayMin: number | null
  headwayMax: number | null
}

export interface StoredTimetable {
  holidays: string[]
  serviceDayMap: ServiceDayMap
  routes: RouteTimetableMap
}

const STORAGE_KEY = 'routeTimetable'

let memory: StoredTimetable | null = null

const emptyStore = (): StoredTimetable => ({
  holidays: [],
  serviceDayMap: {},
  routes: {},
})

const readStore = (): StoredTimetable => {
  if (memory) {
    return memory
  }

  try {
    memory = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') as StoredTimetable | null
  } catch {
    memory = null
  }

  if (!memory || !memory.routes) {
    memory = emptyStore()
  }

  return memory
}

export const saveRouteTimetable = (data: StoredTimetable) => {
  memory = data
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export const resetTimetableCache = () => {
  memory = null
}

export const hasTimetableData = () => {
  return Object.keys(readStore().routes).length > 0
}

const metaKey = (
  route: Pick<BusRoute, 'route' | 'service_type' | 'co'>,
  direction: 'inbound' | 'outbound' | 'I' | 'O'
) => {
  const bound = direction === 'inbound' || direction === 'I' ? 'I' : 'O'
  return routeCatalogKey(getCompany(route), route.route, route.service_type, bound)
}

export const getRouteJt = (
  route: Pick<BusRoute, 'route' | 'service_type' | 'co'>,
  direction: 'inbound' | 'outbound' | 'I' | 'O'
) => {
  return readStore().routes[metaKey(route, direction)]?.jt ?? null
}

export const scaleJourneyMinutes = (
  jt: number | null,
  boardIdx: number,
  destIdx: number,
  stopCount: number
) => {
  if (!jt || destIdx <= boardIdx) {
    return null
  }
  return Math.max(1, Math.round((jt * (destIdx - boardIdx)) / Math.max(stopCount - 1, 1)))
}

const parseHm = (value: string) => {
  const digits = value.replace(':', '')
  if (digits.length < 3) {
    return null
  }
  const hours = Number(digits.slice(0, digits.length - 2))
  const minutes = Number(digits.slice(-2))
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null
  }
  return hours * 60 + minutes
}

const formatHm = (mins: number) => {
  const wrapped = ((mins % 1440) + 1440) % 1440
  const hours = Math.floor(wrapped / 60)
  const minutes = wrapped % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

const hongKongNow = (date = new Date()) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Hong_Kong',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value])
  )
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return {
    ymd: `${parts.year}${parts.month}${parts.day}`,
    day: Math.max(0, weekdays.indexOf(parts.weekday)),
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  }
}

const isHoliday = (holidays: string[], now: ReturnType<typeof hongKongNow>) => {
  return now.day === 0 || holidays.includes(now.ymd)
}

const allSlots = (freq: RouteFreq) => {
  const merged: Record<string, FreqSlot> = {}
  Object.values(freq).forEach((slots) => {
    Object.assign(merged, slots)
  })
  return merged
}

const todaysSlots = (freq: RouteFreq, serviceDayMap: ServiceDayMap, holidays: string[]) => {
  const now = hongKongNow()
  const holiday = isHoliday(holidays, now)
  const merged: Record<string, FreqSlot> = {}

  Object.entries(freq).forEach(([key, slots]) => {
    const flags = serviceDayMap[key]
    const active = !flags ? true : holiday ? flags[0] === '1' : flags[now.day] === '1'
    if (active) {
      Object.assign(merged, slots)
    }
  })

  return { now, merged }
}

const slotWindows = (merged: Record<string, FreqSlot>) => {
  return Object.entries(merged)
    .map(([startRaw, slot]) => {
      const start = parseHm(startRaw)
      if (start == null) {
        return null
      }
      if (!slot) {
        return { start, end: start, interval: null as number | null }
      }
      const endRaw = parseHm(slot[0])
      const interval = Number(slot[1])
      const end = endRaw == null ? start : endRaw < start ? endRaw + 1440 : endRaw
      const span = Math.max(end - start, 0)
      const usable =
        Number.isFinite(interval) && interval > 0 && interval <= 90 && (span === 0 || interval <= span)
      return {
        start,
        end,
        interval: usable ? interval : null,
      }
    })
    .filter((item): item is { start: number; end: number; interval: number | null } => !!item)
}

const containsNow = (window: { start: number; end: number }, minutes: number) => {
  return (
    (minutes >= window.start && minutes <= window.end) ||
    (minutes + 1440 >= window.start && minutes + 1440 <= window.end)
  )
}

export const serviceWindowFromFreq = (freq?: RouteFreq | null): ServiceWindow | null => {
  if (!freq || !Object.keys(freq).length) {
    return null
  }

  const store = readStore()
  const { now, merged } = todaysSlots(freq, store.serviceDayMap, store.holidays)
  let windows = slotWindows(merged)
  const runsToday = windows.length > 0
  if (!runsToday) {
    windows = slotWindows(allSlots(freq))
  }
  if (!windows.length) {
    return null
  }

  const first = Math.min(...windows.map((item) => item.start))
  const last = Math.max(...windows.map((item) => item.end))
  const current = windows.filter((item) => containsNow(item, now.minutes) && item.interval)
  const intervals = (current.length ? current : windows)
    .map((item) => item.interval)
    .filter((item): item is number => item != null)
    .sort((a, b) => a - b)

  const serving =
    runsToday &&
    (windows.some((item) => containsNow(item, now.minutes)) ||
      (last > 1440 && (now.minutes >= first || now.minutes <= last - 1440)))

  return {
    first: formatHm(first),
    last: formatHm(last),
    serving,
    headwayMin: intervals[0] ?? null,
    headwayMax: intervals.length ? intervals[intervals.length - 1] : null,
  }
}

export type ServiceDayKind = 'weekdays' | 'weekend' | 'saturday' | 'sundayHoliday' | 'daily' | ''

export const describeServiceDays = (freq?: RouteFreq | null): ServiceDayKind => {
  if (!freq || !Object.keys(freq).length) {
    return ''
  }

  const dayMap = readStore().serviceDayMap
  let weekday = false
  let saturday = false
  let sundayHoliday = false

  Object.keys(freq).forEach((key) => {
    const flags = dayMap[key]
    if (!flags) {
      weekday = true
      saturday = true
      sundayHoliday = true
      return
    }
    if (flags[0] === '1') {
      sundayHoliday = true
    }
    if (flags.slice(1, 6).some((flag) => flag === '1')) {
      weekday = true
    }
    if (flags[6] === '1') {
      saturday = true
    }
  })

  if (weekday && (saturday || sundayHoliday)) {
    return 'daily'
  }
  if (weekday) {
    return 'weekdays'
  }
  if (saturday && sundayHoliday) {
    return 'weekend'
  }
  if (saturday) {
    return 'saturday'
  }
  if (sundayHoliday) {
    return 'sundayHoliday'
  }
  return ''
}

export const getRouteServiceWindow = (
  route: Pick<BusRoute, 'route' | 'service_type' | 'co'>,
  direction: 'inbound' | 'outbound' | 'I' | 'O'
): ServiceWindow | null => {
  return serviceWindowFromFreq(readStore().routes[metaKey(route, direction)]?.freq)
}

export const isRouteServingNow = (
  route: Pick<BusRoute, 'route' | 'service_type' | 'co'>,
  direction: 'inbound' | 'outbound' | 'I' | 'O'
) => {
  const window = getRouteServiceWindow(route, direction)
  return window ? window.serving : true
}
