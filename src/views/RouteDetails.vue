<template>
  <ul class="divide-y divide-gray-100" v-if="isPageLoading">
    <li
      class="flex justify-between gap-x-6 py-5"
      v-for="index in [1, 2, 3, 4, 5, 6, 7, 8, 9]"
      v-bind:key="index"
    >
      <el-skeleton :rows="2" animated />
    </li>
  </ul>
  <ul class="divide-y divide-gray-100" v-else>
    <li
      class="flex justify-between gap-x-6 py-5"
      v-for="(stop, index) in stops"
      v-bind:key="index"
      @click="() => handleStopClick(stop)"
    >
      <div class="flex min-w-0 gap-x-4">
        <div class="rounded-ful">
          <IconBxBus class="h-6 w-6" />
        </div>
        <div class="min-w-0 flex-auto">
          <p class="text-sm font-semibold leading-6 text-gray-900">{{ stop.stop_tc }}</p>
          <p class="mt-1 truncate text-xs leading-5 text-gray-500">
            Distance: {{ stop?.distance?.toFixed(2) }}M
          </p>
        </div>
      </div>
      <div class="shrink-0 flex flex-col items-end">
        <p class="mt-1 text-xs leading-5 text-gray-500" v-for="(stopEta, index) in stop.eta">
          {{ stopEta.eta ? formatDistanceToNow(stopEta.eta) : '-' }}
        </p>
      </div>
    </li>
  </ul>
  <template>
    <el-skeleton :rows="5" animated />
  </template>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import haversine from 'haversine-distance'
import { ElLoading, ElMessage } from 'element-plus'
import API from '@/services/ApiService'
import { formatDistanceToNow } from 'date-fns'

const stops = ref([])
const router = useRouter()
const route = useRoute()
const isPageLoading = ref(false)
const isOpeningMap = ref(false)

const getCurrentLocation = () => {
  return new Promise((resolve, reject) => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          })
        },
        (error) => {
          reject(error)
        }
      )
    } else {
      ElMessage.error({ message: 'Geolocation is not supported by this browser.' })
      reject(new Error('Geolocation is not supported by this browser.'))
    }
  })
}

const handleStopClick = async (stop) => {
  const loading = ElLoading.service({
    lock: true,
    text: 'Opening in Google Maps...',
    background: 'rgba(0, 0, 0, 0.7)',
  })
  const currLocation = await getCurrentLocation()
  const url = `https://www.google.com/maps/dir/?api=1&origin=${currLocation.latitude},${currLocation.longitude}&destination=${stop.lat},${stop.long}`
  loading.close()
  window.open(url, '_blank')
}

onMounted(async () => {
  isPageLoading.value = true

  const { query } = route
  const currLocation = await getCurrentLocation()
  const { data } = await API.get(`/kmb/route-stop/${query.route}/outbound/${query.serviceType}`)
  stops.value = data.data

  stops.value.forEach(async (item) => {
    const { data: stopData } = await API.get(`/kmb/stop/${item.stop}`)
    const { data: etaData } = await API.get(
      `/kmb/eta/${item.stop}/${query.route}/${query.serviceType}`
    )
    item.stop_tc = stopData.data.name_tc
    item.lat = stopData.data.lat
    item.long = stopData.data.long
    item.eta = etaData.data.filter((item) => item.dir === 'O')
    item.distance = haversine(currLocation, {
      latitude: stopData.data.lat,
      longitude: stopData.data.long,
    })
  })

  isPageLoading.value = false
})
</script>

<style scoped>
.search-input {
  top: 60px;
  position: fixed;
  width: calc(100% - 38px);
  background-color: #fff;
}
</style>
