<template>
  <p v-if="!prefs.locationEnabled" class="empty-state">{{ t('map.locationOff') }}</p>
  <div v-else-if="isLoading" class="map-canvas" v-loading="true"></div>
  <p v-else-if="!center" class="empty-state">{{ t('location.denied') }}</p>
  <GoogleMap
    v-else
    class="map-canvas"
    :class="`is-theme-${appTheme}`"
    api-key="AIzaSyAd3JuKmaDu5q7FnmlvzjDb4bTd06BGAjY"
    style="width: 100%; height: 100%"
    :center="center"
    :zoom="18"
    :styles="mapStyles"
    ref="mapRef"
  >
    <CustomMarker
      v-if="isMapReady"
      :options="{
        position: center,
        anchorPoint: 'CENTER',
        zIndex: 5000,
      }"
    >
      <div class="user-location" aria-hidden="true">
        <span class="user-location-pulse"></span>
        <span class="user-location-dot"></span>
      </div>
    </CustomMarker>
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
import { GoogleMap, CustomMarker } from 'vue3-google-map'
import { groupStopEtas, loadNearbyMapStops, fetchStopEtas } from '@/services/CommuteService'
import type { MapStop, StopRouteSummary } from '@/services/CommuteService'
import { useRouter } from 'vue-router'
import { usePrefsStore } from '@/stores/prefs'

const { t } = useI18n()
const prefs = usePrefsStore()
type TrafficLayerHandle = { setMap: (map: unknown) => void }

const mapRef = ref()
const router = useRouter()
const isLoading = ref(true)
const center = ref<{ lat: number; lng: number } | null>(null)
const nearbyStops = ref<MapStop[]>([])
const maxRouteChips = 4
const mapStyles = computed(() => buildMapStyles(appTheme.value))
const isMapReady = computed(() => Boolean(mapRef.value?.ready))
const trafficLayer = shallowRef<TrafficLayerHandle | null>(null)
const trafficTileObserver = shallowRef<MutationObserver | null>(null)
const dialog = ref({
  title: '',
  visible: false,
  routes: [] as StopRouteSummary[],
})

const visibleRoutes = (item: MapStop) => item.routeLabels.slice(0, maxRouteChips)

const isTrafficTileSrc = (src: string) => /traffic|ltraffic|mapslt/i.test(src)

const tagTrafficTile = (img: HTMLImageElement) => {
  if (isTrafficTileSrc(img.currentSrc || img.src || img.getAttribute('src') || '')) {
    img.classList.add('map-traffic-tile')
  }
}

const tagTrafficTiles = (root: ParentNode) => {
  root.querySelectorAll('img').forEach((img) => tagTrafficTile(img))
}

const bindTrafficTiles = () => {
  const root = (mapRef.value?.$el as ParentNode | undefined) || document.querySelector('.map-canvas')
  if (!root) {
    return
  }

  tagTrafficTiles(root)
  trafficTileObserver.value?.disconnect()
  trafficTileObserver.value = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'attributes' && record.target instanceof HTMLImageElement) {
        tagTrafficTile(record.target)
        continue
      }
      record.addedNodes.forEach((node) => {
        if (node instanceof HTMLImageElement) {
          tagTrafficTile(node)
          return
        }
        if (node instanceof Element) {
          tagTrafficTiles(node)
        }
      })
    }
  })
  trafficTileObserver.value.observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src'],
  })
}

const clearTrafficTiles = () => {
  trafficTileObserver.value?.disconnect()
  trafficTileObserver.value = null
}

const applyTrafficLayer = (map: unknown) => {
  const TrafficLayer = (
    window as Window & { google?: { maps?: { TrafficLayer?: new () => TrafficLayerHandle } } }
  ).google?.maps?.TrafficLayer
  if (!TrafficLayer) {
    return
  }

  if (!trafficLayer.value) {
    trafficLayer.value = new TrafficLayer()
  }
  trafficLayer.value.setMap(map)
  bindTrafficTiles()
}

const applyMapOptions = () => {
  const map = mapRef.value?.map
  if (!mapRef.value?.ready || !map) {
    trafficLayer.value?.setMap(null)
    clearTrafficTiles()
    return
  }

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
  applyTrafficLayer(map)
}

watch([() => mapRef.value?.ready, mapStyles], applyMapOptions)

onUnmounted(() => {
  trafficLayer.value?.setMap(null)
  trafficLayer.value = null
  clearTrafficTiles()
})

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

onMounted(() => {
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
