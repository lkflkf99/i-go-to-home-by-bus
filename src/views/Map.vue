<template>
  <p v-if="!prefs.locationEnabled" class="empty-state">{{ t('map.locationOff') }}</p>
  <div v-else-if="isLoading" class="map-canvas" v-loading="true"></div>
  <p v-else-if="!center" class="empty-state">{{ t('location.denied') }}</p>
  <GoogleMap
    v-else
    class="map-canvas"
    api-key="AIzaSyAd3JuKmaDu5q7FnmlvzjDb4bTd06BGAjY"
    style="width: 100%; height: 100%"
    :center="center"
    :zoom="18"
    :styles="mapStyles"
    ref="mapRef"
  >
    <Circle
      :options="{
        center,
        radius: 16,
        strokeColor: accentColor,
        strokeOpacity: 0.8,
        strokeWeight: 3,
        fillColor: accentColor,
        fillOpacity: 0.35,
      }"
    />
    <CustomMarker
      v-for="item in nearbyStops"
      :key="item.id"
      :options="{
        position: { lat: Number(item.lat), lng: Number(item.long) },
        anchorPoint: 'BOTTOM_CENTER',
        zIndex: Math.round(2000 - item.distance),
      }"
    >
      <button class="stop-marker" type="button" @click="openStopDetails(item)">
        <div class="stop-marker-card">
          <div v-if="item.companies.length > 1" class="stop-marker-cos">
            <span v-for="company in item.companies" :key="company" class="stop-marker-co">
              {{ company }}
            </span>
          </div>
          <div v-if="item.routeLabels.length" class="stop-marker-routes">
            <span v-for="route in visibleRoutes(item)" :key="route" class="stop-marker-route">
              {{ route }}
            </span>
            <span v-if="item.routeLabels.length > maxRouteChips" class="stop-marker-more">
              +{{ item.routeLabels.length - maxRouteChips }}
            </span>
          </div>
          <span v-else class="stop-marker-route">{{ item.companies[0] || 'BUS' }}</span>
        </div>
        <span class="stop-marker-arrow"></span>
        <span class="stop-marker-pin"></span>
      </button>
    </CustomMarker>
  </GoogleMap>
  <el-dialog v-model="dialog.visible" :title="dialog.title" width="90%">
    <ul v-if="dialog.routes.length" class="settings-group">
      <li
        class="route-row"
        v-for="item in dialog.routes"
        :key="`${item.co}-${item.route}-${item.dest_tc}-${item.dir}`"
        @click="goToDetails(item)"
      >
        <div class="flex min-w-0 gap-x-3">
          <div class="route-badge">{{ item.co }}</div>
          <div class="min-w-0 flex-auto">
            <p class="route-number">{{ item.route }}</p>
            <p class="route-meta">
              {{ [textByLocale(item.dest_tc, item.dest_en), formatFare(item.fare)].filter(Boolean).join(' · ') }}
            </p>
          </div>
        </div>
        <div class="eta-stack">
          <p
            v-for="(eta, index) in item.etas.length ? item.etas : [null]"
            :key="index"
            :class="index === 0 ? 'eta-primary' : 'eta-secondary'"
          >
            {{ formatEta(eta) }}
          </p>
        </div>
      </li>
    </ul>
    <p v-else class="empty-state">{{ t('map.noRoutes') }}</p>
  </el-dialog>
</template>

<script lang="ts">
export default { name: 'Map' }
</script>

<script lang="ts" setup>
import {
  getCurrentLocation,
  formatEta,
  formatFare,
  textByLocale,
  companyForDetails,
  appTheme,
  buildMapStyles,
} from '@/utils'
import { GoogleMap, CustomMarker, Circle } from 'vue3-google-map'
import { groupStopEtas, loadNearbyMapStops, fetchStopEtas } from '@/services/CommuteService'
import type { MapStop, StopRouteSummary } from '@/services/CommuteService'
import { useRouter } from 'vue-router'
import { usePrefsStore } from '@/stores/prefs'

const { t } = useI18n()
const prefs = usePrefsStore()
const mapRef = ref()
const router = useRouter()
const isLoading = ref(true)
const center = ref<{ lat: number; lng: number } | null>(null)
const nearbyStops = ref<MapStop[]>([])
const accentColor = ref('#409EFF')
const maxRouteChips = 4
const mapStyles = computed(() => buildMapStyles(appTheme.value))
const dialog = ref({
  title: '',
  visible: false,
  routes: [] as StopRouteSummary[],
})

const readAccentColor = () => {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue('--el-color-primary')
    .trim()
  if (value) {
    accentColor.value = value
  }
}

const visibleRoutes = (item: MapStop) => item.routeLabels.slice(0, maxRouteChips)

const applyMapOptions = () => {
  const map = mapRef.value?.map
  if (!mapRef.value?.ready || !map) return

  map.setOptions({
    zoomControl: false,
    streetViewControl: false,
    fullscreenControl: false,
    mapTypeControl: false,
    clickableIcons: false,
    keyboardShortcuts: false,
    styles: mapStyles.value,
    backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--app-bg').trim() || '#f2f2f7',
  })
}

watch([() => mapRef.value?.ready, mapStyles], applyMapOptions)

const loadNearbyStops = async () => {
  if (!prefs.locationEnabled) {
    center.value = null
    nearbyStops.value = []
    isLoading.value = false
    return
  }

  isLoading.value = true

  try {
    const { latitude, longitude } = await getCurrentLocation()
    center.value = { lat: latitude, lng: longitude }
    isLoading.value = false
    try {
      await loadNearbyMapStops({ latitude, longitude }, (stops) => {
        nearbyStops.value = stops
      })
    } catch {
      nearbyStops.value = []
    }
  } catch {
    center.value = null
    nearbyStops.value = []
    isLoading.value = false
  }
}

watch(
  () => prefs.locationEnabled,
  () => {
    loadNearbyStops()
  }
)

watch(appTheme, () => {
  readAccentColor()
})

onMounted(() => {
  readAccentColor()
  loadNearbyStops()
})

const openStopDetails = async (item: MapStop) => {
  dialog.value = {
    title: textByLocale(item.name_tc, item.name_en),
    visible: true,
    routes: groupStopEtas(item.etas, item.stop),
  }

  const fresh = await Promise.all(
    item.members.map((member) => fetchStopEtas(member.stop, { company: member.co, force: true }))
  )
  if (dialog.value.title === textByLocale(item.name_tc, item.name_en)) {
    dialog.value.routes = groupStopEtas(fresh.flat(), item.stop)
  }
}

const goToDetails = (item: StopRouteSummary) => {
  router.push({
    name: 'Bus Stops',
    query: {
      route: item.route,
      serviceType: String(item.service_type || 1),
      company: companyForDetails(item.co),
      direction: item.dir === 'I' ? 'inbound' : 'outbound',
    },
  })
}
</script>
