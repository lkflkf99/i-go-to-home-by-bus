<template>
  <div>
    <div class="action-row toolbar-row">
      <span v-if="timetableLabel" class="action-window">{{ timetableLabel }}</span>
      <el-button
        class="toolbar-btn"
        circle
        plain
        :icon="Switch"
        :aria-label="t('details.switch')"
        :disabled="isPageLoading || !canSwitchDirection"
        @click="handleSwitchDirection"
      />
      <el-button
        class="toolbar-btn"
        circle
        plain
        :icon="Refresh"
        :aria-label="t('details.refresh')"
        :disabled="isPageLoading || !isServingNow"
        :loading="isRefreshing"
        @click="handleRefresh"
      />
    </div>
    <div class="action-row variant-row" v-if="visibleVariants.length > 1">
      <el-button
        v-for="variant in visibleVariants"
        :key="variantKey(variant)"
        class="variant-chip"
        :class="{ 'is-active-filter': selectedKey === variantKey(variant) }"
        @click="selectVariant(variant)"
      >
        {{ variantLabel(variant) }}
      </el-button>
    </div>
    <ul class="settings-group" v-if="isPageLoading">
      <RouteRowSkeleton v-for="index in 8" :key="index" variant="stop" :lines="1" />
    </ul>
    <ul class="settings-group" v-else>
      <li
        class="route-row"
        v-for="(stop, index) in displayStops"
        :key="index"
        @click="() => handleStopClick(stop)"
      >
        <div class="flex min-w-0 gap-x-3">
          <div class="min-w-0 flex-auto">
            <p
              class="text-sm font-semibold"
              :style="{
                color: stop?.distance <= 200 ? 'var(--el-color-primary)' : 'var(--app-text)',
              }"
            >
              {{ textByLocale(stop.stop_tc, stop.stop_en) }}
            </p>
            <p v-if="stopMeta(stop)" class="route-meta">
              {{ stopMeta(stop) }}
            </p>
            <el-button
              class="mt-2"
              round
              plain
              type="primary"
              size="small"
              v-if="stop.camData"
              @click.stop="handleViewTrafficCamClick(stop.camData)"
            >
              {{ t('details.trafficCam') }}
            </el-button>
          </div>
        </div>
        <div class="eta-stack" v-if="isServingNow">
          <p
            v-for="(stopEta, etaIndex) in stop.eta.length ? stop.eta : [{ eta: null }]"
            :key="etaIndex"
            :class="etaIndex === 0 ? 'eta-primary' : 'eta-secondary'"
          >
            {{ formatEta(stopEta.eta) }}
          </p>
        </div>
      </li>
    </ul>

    <el-dialog v-model="dialog.visible" :title="dialog.title" width="90%">
      <img :src="dialog.imageUrl" style="width: 100%; border-radius: 8px" />
    </el-dialog>
  </div>
</template>

<script lang="ts" setup>
import { useRoute } from 'vue-router'
import haversine from 'haversine-distance'
import { ElLoading } from 'element-plus'
import { Switch, Refresh } from '@element-plus/icons-vue'
import {
  getCurrentLocationOrNull,
  isIOS,
  formatEta,
  formatFare,
  formatMeters,
  getCompany,
  getRouteServiceWindow,
  getRouteVariants,
  getVariantDayKind,
  getVariantServiceWindow,
  isCircularVariant,
  isRouteServingNow,
  isVariantServingNow,
  pickRouteVariant,
  textByLocale,
  toVariantRoute,
  variantKey,
  variantsForDirection,
} from '@/utils'
import type { RouteVariant } from '@/utils/routeVariants'
import { usePrefsStore } from '@/stores/prefs'
import { loadRouteEtas, loadRouteStops, loadStopsByIds } from '@/services/CommuteService'
import { ensureHkbusRouteIndex } from '@/services/BusService'
import type { GeoLocation, ResolvedStop } from '@/services/CommuteService'
import type { BusRoute, Eta } from '@/model'
import trafficCam from '@/assets/traffic_cam.json'

interface TrafficCam {
  description: string
  url: string
  latitude: number
  longitude: number
}

interface DisplayStops {
  stop: string
  seq: number
  stop_tc: string
  stop_en: string
  lat: string
  long: string
  eta: Eta[]
  distance: number
  fare?: string | null
  camData?: TrafficCam
}

const { t } = useI18n()
const prefs = usePrefsStore()
const displayStops = ref<DisplayStops[]>([])
const allVariants = ref<RouteVariant[]>([])
const selectedVariant = ref<RouteVariant | null>(null)
const route = useRoute()
const isPageLoading = ref(false)
const isRefreshing = ref(false)
const isOutbound = ref(route.query.direction !== 'inbound')
const dialog = ref({
  visible: false,
  title: '',
  imageUrl: '',
})

const getDirection = () => {
  return isOutbound.value ? ('outbound' as const) : ('inbound' as const)
}

const routeFromQuery = (): BusRoute | null => {
  const { query } = route
  const company = query.company === 'CTB' ? 'CTB' : query.company === 'KMB' ? 'KMB' : null
  if (!company || !query.route) {
    return null
  }

  return {
    route: String(query.route),
    service_type: String(query.serviceType || selectedVariant.value?.service_type || 1),
    co: company,
    orig_tc: selectedVariant.value?.orig_tc || '',
    dest_tc: selectedVariant.value?.dest_tc || '',
    orig_en: selectedVariant.value?.orig_en || '',
    dest_en: selectedVariant.value?.dest_en || '',
  }
}

const visibleVariants = computed(() => variantsForDirection(allVariants.value, getDirection()))
const selectedKey = computed(() => (selectedVariant.value ? variantKey(selectedVariant.value) : ''))
const canSwitchDirection = computed(() => selectedVariant.value?.bound !== 'OI')
const activeRoute = computed(() =>
  selectedVariant.value ? toVariantRoute(selectedVariant.value) : routeFromQuery()
)
const isServingNow = computed(() => {
  if (selectedVariant.value) {
    return isVariantServingNow(selectedVariant.value)
  }
  const busRoute = activeRoute.value
  return busRoute ? isRouteServingNow(busRoute, getDirection()) : true
})

const shortPlaceName = (name: string) => name.split(',')[0].trim() || name

const dayLabel = (kind: ReturnType<typeof getVariantDayKind>) => {
  if (!kind) {
    return ''
  }
  return t(`details.${kind}`)
}

const placeLabel = (variant: RouteVariant) => {
  const dest = shortPlaceName(textByLocale(variant.dest_tc, variant.dest_en))
  if (isCircularVariant(variant) && dest) {
    return t('details.circular', { name: dest })
  }
  return dest ? t('plan.to', { name: dest }) : ''
}

const origLabel = (variant: RouteVariant) => {
  if (isCircularVariant(variant)) {
    return ''
  }
  const orig = shortPlaceName(textByLocale(variant.orig_tc, variant.orig_en))
  return orig ? t('details.from', { name: orig }) : ''
}

const scheduleLabel = (variant: RouteVariant) => {
  const window = getVariantServiceWindow(variant)
  const days = dayLabel(getVariantDayKind(variant))
  return [days, window ? `${window.first}–${window.last}` : ''].filter(Boolean).join(' · ')
}

const variantLabel = (variant: RouteVariant) => {
  const place = placeLabel(variant)
  const base = [place].filter(Boolean).join(' · ')
  const peers = visibleVariants.value.filter((item) => {
    return [placeLabel(item), scheduleLabel(item)].filter(Boolean).join(' · ') === base
  })
  if (peers.length <= 1) {
    return base || t('details.special')
  }
  console.log([place || t('details.special'), origLabel(variant)].filter(Boolean).join(' · '))
  return [place || t('details.special'), origLabel(variant)].filter(Boolean).join(' · ')
}

const timetableLabel = computed(() => {
  const busRoute = activeRoute.value
  if (!busRoute) {
    return ''
  }
  const window = selectedVariant.value
    ? getVariantServiceWindow(selectedVariant.value)
    : getRouteServiceWindow(busRoute, getDirection())
  const days = selectedVariant.value ? dayLabel(getVariantDayKind(selectedVariant.value)) : ''
  if (!window && !days) {
    return ''
  }
  let headway = ''
  if (window?.headwayMin) {
    headway =
      window.headwayMax && window.headwayMin !== window.headwayMax
        ? t('details.everyMinRange', { min: window.headwayMin, max: window.headwayMax })
        : t('details.everyMin', { n: window.headwayMin })
  }

  return [
    days,
    window && !window.serving ? t('details.notRunning') : '',
    window ? t('details.firstLast', { first: window.first, last: window.last }) : '',
    headway,
  ]
    .filter(Boolean)
    .join(' · ')
})

const findCam = (lat: string, long: string) => {
  return (trafficCam as TrafficCam[]).find(
    (cam) =>
      haversine(
        { latitude: Number(cam.latitude), longitude: Number(cam.longitude) },
        { latitude: Number(lat), longitude: Number(long) }
      ) <= 50
  )
}

const toDisplayStop = (stop: ResolvedStop, eta: Eta[] = []): DisplayStops => ({
  stop: stop.stop,
  seq: stop.seq,
  stop_tc: stop.name_tc,
  stop_en: stop.name_en,
  lat: stop.lat,
  long: stop.long,
  eta,
  distance: Number.isFinite(stop.distance) ? stop.distance : Number.NaN,
  fare: stop.fare || null,
  camData: findCam(stop.lat, stop.long),
})

const stopMeta = (stop: DisplayStops) => {
  return [formatMeters(stop.distance), formatFare(stop.fare)].filter(Boolean).join(' · ')
}

const applyDistances = (stops: DisplayStops[], location: GeoLocation | null) => {
  return stops.map((stop) => ({
    ...stop,
    distance: location
      ? haversine(location, {
          latitude: Number(stop.lat),
          longitude: Number(stop.long),
        })
      : Number.NaN,
  }))
}

const applyEtas = (stops: DisplayStops[], etaBySeq: Map<number, Eta[]>) => {
  return stops.map((stop) => ({
    ...stop,
    eta: etaBySeq.get(stop.seq) || [],
  }))
}

const handleStopClick = async (stop: DisplayStops) => {
  const loading = ElLoading.service({
    lock: true,
    text: t('details.openingMaps'),
    background: 'rgba(0, 0, 0, 0.7)',
  })
  const currLocation = await getCurrentLocationOrNull()
  const destination = `${stop.lat},${stop.long}`
  const url = currLocation
    ? `https://www.google.com/maps/dir/?api=1&origin=${currLocation.latitude},${currLocation.longitude}&destination=${destination}`
    : `https://www.google.com/maps/search/?api=1&query=${destination}`
  const iosUrl = currLocation
    ? `comgooglemaps://?saddr=${currLocation.latitude},${currLocation.longitude}&daddr=${destination}&directionsmode=walking`
    : `comgooglemaps://?q=${destination}`

  window.location.href = isIOS() ? iosUrl : url
  loading.close()
}

const handleViewTrafficCamClick = (camData?: TrafficCam) => {
  if (!camData) {
    return
  }
  dialog.value = {
    visible: true,
    title: camData.description,
    imageUrl: camData.url,
  }
}

const refreshEtas = async (force = false) => {
  const busRoute = activeRoute.value
  if (!busRoute || !displayStops.value.length || !isServingNow.value) {
    return
  }

  isRefreshing.value = force
  try {
    const etaBySeq = await loadRouteEtas(
      busRoute,
      getDirection(),
      displayStops.value.map((stop) => ({
        stop: stop.stop,
        name_tc: stop.stop_tc,
        name_en: stop.stop_en,
        lat: stop.lat,
        long: stop.long,
        seq: stop.seq,
        distance: stop.distance,
      })),
      { force }
    )
    displayStops.value = applyEtas(displayStops.value, etaBySeq)
  } finally {
    isRefreshing.value = false
  }
}

const loadStopsFor = async (
  variant: RouteVariant | null,
  busRoute: BusRoute,
  location: GeoLocation | null
) => {
  const direction = getDirection()
  const stops = variant?.stopIds.length
    ? await loadStopsByIds(toVariantRoute(variant), direction, variant.stopIds, location)
    : await loadRouteStops(busRoute, direction, location)
  displayStops.value = stops.map((stop) => toDisplayStop(stop))
}

const fetchDetails = async (keepVariant = false) => {
  const busRoute = routeFromQuery()
  if (!busRoute) {
    return
  }

  isPageLoading.value = true
  try {
    await ensureHkbusRouteIndex().catch(() => undefined)
    const currLocation = await getCurrentLocationOrNull()
    allVariants.value = getRouteVariants(getCompany(busRoute), busRoute.route)
    const directional = variantsForDirection(allVariants.value, getDirection())
    const currentKey = selectedVariant.value ? variantKey(selectedVariant.value) : ''
    const next = keepVariant
      ? directional.find((item) => variantKey(item) === currentKey) ||
        pickRouteVariant(directional, selectedVariant.value?.service_type || busRoute.service_type)
      : pickRouteVariant(directional, busRoute.service_type)
    selectedVariant.value = next
    await loadStopsFor(next, busRoute, currLocation)
  } finally {
    isPageLoading.value = false
  }
  await refreshEtas(false)
}

const selectVariant = async (variant: RouteVariant) => {
  if (selectedKey.value === variantKey(variant) || isPageLoading.value) {
    return
  }

  selectedVariant.value = variant
  const busRoute = toVariantRoute(variant)
  isPageLoading.value = true
  try {
    const currLocation = await getCurrentLocationOrNull()
    await loadStopsFor(variant, busRoute, currLocation)
  } finally {
    isPageLoading.value = false
  }
  await refreshEtas(false)
}

const handleSwitchDirection = () => {
  if (!canSwitchDirection.value || isPageLoading.value) {
    return
  }
  isOutbound.value = !isOutbound.value
  fetchDetails(true)
}

const handleRefresh = () => {
  refreshEtas(true)
}

onMounted(() => {
  fetchDetails()
})

watch(
  () => prefs.locationEnabled,
  async () => {
    if (!displayStops.value.length) {
      return
    }
    const currLocation = await getCurrentLocationOrNull()
    displayStops.value = applyDistances(displayStops.value, currLocation)
  }
)
</script>

<style scoped>
.toolbar-row {
  align-items: center;
}

.toolbar-row.action-row .toolbar-btn {
  width: 36px;
  height: 36px;
  min-height: 36px;
  padding: 0;
  --el-button-text-color: var(--el-color-primary);
  --el-button-bg-color: var(--app-surface);
  --el-button-border-color: var(--app-separator);
  --el-button-hover-text-color: var(--el-color-primary);
  --el-button-hover-bg-color: var(--row-active);
  --el-button-hover-border-color: var(--app-separator);
}

.action-window {
  flex: 1;
  min-width: 0;
  align-self: center;
  font-size: 13px;
  line-height: 1.35;
  color: var(--app-muted);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.variant-row {
  margin-top: 8px;
  align-items: center;
}

.variant-row.action-row .variant-chip {
  --el-button-bg-color: var(--app-surface);
  --el-button-text-color: var(--app-text);
  --el-button-border-color: var(--app-separator);
  --el-button-hover-bg-color: var(--row-active);
  --el-button-hover-text-color: var(--app-text);
  --el-button-hover-border-color: var(--app-separator);
  height: auto;
  min-height: 28px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 500;
  border-radius: 999px;
}

.variant-chip :deep(span) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.variant-row.action-row .variant-chip.is-active-filter {
  --el-button-bg-color: var(--el-color-primary);
  --el-button-text-color: #fff;
  --el-button-border-color: var(--el-color-primary);
  --el-button-hover-bg-color: var(--el-color-primary);
  --el-button-hover-text-color: #fff;
  --el-button-hover-border-color: var(--el-color-primary);
}
</style>
