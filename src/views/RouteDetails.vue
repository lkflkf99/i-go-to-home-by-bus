<template>
  <ul class="settings-group" v-if="isPageLoading">
    <li class="route-row" v-for="index in 8" :key="index">
      <el-skeleton :rows="2" animated />
    </li>
  </ul>
  <div v-else>
    <div class="action-row">
      <el-button round plain type="primary" :icon="Switch" @click="handleSwitchDirection">
        {{ t('details.switch') }}
      </el-button>
      <el-button
        round
        plain
        type="primary"
        :icon="Refresh"
        :loading="isRefreshing"
        @click="handleRefresh"
      >
        {{ t('details.refresh') }}
      </el-button>
    </div>
    <ul class="settings-group">
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
            <p v-if="formatMeters(stop?.distance)" class="route-meta">
              {{ formatMeters(stop?.distance) }}
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
        <div class="eta-stack">
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
import { getCurrentLocationOrNull, isIOS, formatEta, formatMeters, textByLocale } from '@/utils'
import { usePrefsStore } from '@/stores/prefs'
import { loadRouteEtas, loadRouteStops } from '@/services/CommuteService'
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
  camData?: TrafficCam
}

const { t } = useI18n()
const prefs = usePrefsStore()
const displayStops = ref<DisplayStops[]>([])
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
    service_type: String(query.serviceType || 1),
    co: company,
    orig_tc: '',
    dest_tc: '',
  }
}

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
  camData: findCam(stop.lat, stop.long),
})

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
  const busRoute = routeFromQuery()
  if (!busRoute || !displayStops.value.length) {
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

const fetchDetails = async () => {
  const busRoute = routeFromQuery()
  if (!busRoute) {
    return
  }

  isPageLoading.value = true
  try {
    const currLocation = await getCurrentLocationOrNull()
    const stops = await loadRouteStops(busRoute, getDirection(), currLocation)
    displayStops.value = stops.map((stop) => toDisplayStop(stop))
  } finally {
    isPageLoading.value = false
  }
  await refreshEtas(false)
}

const handleSwitchDirection = () => {
  isOutbound.value = !isOutbound.value
  fetchDetails()
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
