<template>
  <GoogleMap
    v-loading="isLoading"
    api-key="AIzaSyAd3JuKmaDu5q7FnmlvzjDb4bTd06BGAjY"
    style="height: 100%; margin: -20px"
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
    <ul class="divide-y divide-gray-100 mt-8">
      <li
        class="flex justify-between gap-x-6 py-5"
        v-for="(item, index) in dialog.routes"
        v-bind:key="index"
        @click="() => goToDetails(item, item.co || 'KMB')"
      >
        <div class="flex min-w-0 gap-x-4">
          <div class="rounded-ful">
            <IconTablerBus class="h-6 w-6" />
            <p class="text-sm font-semibold text-gray-900">{{ item.co || 'KMB' }}</p>
          </div>
          <div class="min-w-0 flex-auto">
            <p class="text-sm font-semibold text-gray-900">{{ item.route }}</p>
            <p class="mt-1 truncate text-xs text-gray-500">
              {{ item.dest_tc }}
            </p>
          </div>
        </div>
        <div class="shrink-0 flex flex-col items-end">
          <p class="mt-1 text-xs leading-5 text-gray-500">
            {{ item.eta ? formatDistanceToNow(item.eta) : '-' }}
          </p>
        </div>
      </li>
    </ul>
  </el-dialog>
</template>

<script setup>
import { getCurrentLocation } from '@/utils'
import haversine from 'haversine-distance'
import { GoogleMap, Marker, Circle } from 'vue3-google-map'
import API from '@/services/ApiService'
import { useRouter } from 'vue-router'
import { formatDistanceToNow } from 'date-fns'

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

onMounted(async () => {
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

  isLoading.value = false
})

const openStopDetails = async (item) => {
  const { data } = await API.get(`/kmb/stop-eta/${item.stop}`)

  dialog.value = {
    title: item.name_tc,
    visible: true,
    routes: data.data,
  }
}

const goToDetails = (routeItem, company) => {
  router.push({
    name: 'Bus Stops',
    query: { route: routeItem.route, serviceType: routeItem.service_type, company },
  })
}
</script>
