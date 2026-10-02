<template>
  <p v-if="!prefs.locationEnabled" class="empty-state">{{ t('map.locationOff') }}</p>
  <div v-else-if="isLoading" class="map-canvas" v-loading="true"></div>
  <p v-else-if="!center" class="empty-state">{{ t('location.denied') }}</p>
  <GoogleMap
    v-else
    class="map-canvas"
    v-loading="isLoading"
    api-key="AIzaSyAd3JuKmaDu5q7FnmlvzjDb4bTd06BGAjY"
    style="width: 100%; height: 100%"
    :center="center"
    :zoom="17"
    ref="mapRef"
  >
    <Circle
      :options="{
        center,
        radius: 16,
        strokeColor: '#409EFF',
        strokeOpacity: 0.8,
        strokeWeight: 3,
        fillColor: '#409EFF',
        fillOpacity: 0.35,
      }"
    />
    <Marker
      v-for="item in nearbyStops"
      v-bind:key="item.stop"
      :options="{ position: { lat: Number(item.lat), lng: Number(item.long) }, label: 'KMB' }"
      @click="() => openStopDetails(item)"
    >
    </Marker>
  </GoogleMap>
  <el-dialog v-model="dialog.visible" :title="dialog.title" width="90%">
    <ul>
      <li
        class="route-row"
        v-for="(item, index) in dialog.routes"
        :key="index"
        @click="() => goToDetails(item, item.co || 'KMB')"
      >
        <div class="flex min-w-0 gap-x-3">
          <div class="route-badge">{{ item.co || 'KMB' }}</div>
          <div class="min-w-0 flex-auto">
            <p class="route-number">{{ item.route }}</p>
            <p class="route-meta">{{ textByLocale(item.dest_tc, item.dest_en) }}</p>
          </div>
        </div>
        <div class="eta-stack">
          <p class="eta-primary">{{ formatEta(item.eta) }}</p>
        </div>
      </li>
    </ul>
  </el-dialog>
</template>

<script setup>
import { getCurrentLocation, formatEta, textByLocale } from '@/utils'
import haversine from 'haversine-distance'
import { GoogleMap, Marker, Circle } from 'vue3-google-map'
import { fetchStopEtas } from '@/services/CommuteService'
import { useRouter } from 'vue-router'
import { usePrefsStore } from '@/stores/prefs'

const { t } = useI18n()
const prefs = usePrefsStore()
const mapRef = ref()
const router = useRouter()
const isLoading = ref(true)
const center = ref(null)
const nearbyStops = ref([])
const dialog = ref({
  title: '',
  visible: false,
  routes: null,
})

watch(
  () => mapRef.value?.ready,
  (ready) => {
    if (!ready) return

    mapRef.value.map.setOptions({
      zoomControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      mapTypeControl: false,
    })
  }
)

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

    nearbyStops.value = JSON.parse(localStorage.getItem('stops') || '[]').filter((stop) => {
      return (
        haversine(
          { latitude, longitude },
          {
            latitude: stop.lat,
            longitude: stop.long,
          }
        ) <= 1000
      )
    })
  } catch {
    center.value = null
    nearbyStops.value = []
  }

  isLoading.value = false
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

const openStopDetails = async (item) => {
  const routes = await fetchStopEtas(item.stop)

  dialog.value = {
    title: textByLocale(item.name_tc, item.name_en),
    visible: true,
    routes,
  }
}

const goToDetails = (routeItem, company) => {
  router.push({
    name: 'Bus Stops',
    query: { route: routeItem.route, serviceType: routeItem.service_type, company },
  })
}
</script>
