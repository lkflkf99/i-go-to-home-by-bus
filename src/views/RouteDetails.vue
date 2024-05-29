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
  <div v-else>
    <div class="flex">
      <el-button round plain :icon="Switch" @click="handleSwitchDirection">
        Switch Direction
      </el-button>
      <el-button round plain :icon="Refresh" @click="handleRefresh"> Refresh </el-button>
    </div>
    <ul class="divide-y divide-gray-100">
      <li
        class="flex justify-between gap-x-6 py-5"
        v-for="(stop, index) in stops"
        v-bind:key="index"
        @click="() => handleStopClick(stop)"
      >
        <div class="flex min-w-0 gap-x-4">
          <div class="rounded-ful">
            <IconTablerBusStop class="h-6 w-6" />
          </div>
          <div class="min-w-0 flex-auto">
            <p class="text-sm font-semibold leading-6 text-gray-900">{{ stop.stop_tc }}</p>
            <p class="mt-1 truncate text-xs leading-5 text-gray-500">
              Distance: {{ stop?.distance?.toFixed(2) }}M
            </p>
          </div>
        </div>
        <div class="shrink-0 flex flex-col items-end">
          <p
            class="mt-1 text-xs leading-5 text-gray-500"
            v-for="(stopEta, index) in stop.eta"
            v-bind:key="index"
          >
            {{ stopEta.eta ? formatDistanceToNow(stopEta.eta) : '-' }}
          </p>
        </div>
      </li>
    </ul>
  </div>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import haversine from 'haversine-distance'
import { ElLoading, ElMessage } from 'element-plus'
import { Switch, Refresh } from '@element-plus/icons-vue'
import API from '@/services/ApiService'
import { getCurrentLocation } from '@/utils'
import { formatDistanceToNow } from 'date-fns'

const stops = ref([])
const route = useRoute()
const isPageLoading = ref(false)
const isOutbound = ref(true)

const getDirection = () => {
  return isOutbound.value ? { name: 'outbound', code: 'O' } : { name: 'inbound', code: 'I' }
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

const stopDetailsUrl = (stopId) => ({
  KMB: `/kmb/stop/${stopId}`,
  CTB: `/ctb/stop/${stopId}`,
})

const etaUrl = (stopId) => {
  const { query } = route
  return {
    KMB: `/kmb/eta/${stopId}/${query.route}/${query.serviceType}`,
    CTB: `/ctb/eta/CTB/${stopId}/${query.route}`,
  }
}

const fetchDetails = async () => {
  isPageLoading.value = true

  const { query } = route
  const currLocation = await getCurrentLocation()

  const routeStopUrl = {
    KMB: `/kmb/route-stop/${query.route}/${getDirection().name}/${query.serviceType}`,
    CTB: `/ctb/route-stop/CTB/${query.route}/${getDirection().name}`,
  }

  const { data } = await API.get(routeStopUrl[query.company])
  stops.value = data.data

  stops.value.forEach(async (item) => {
    const { data: stopData } = await API.get(stopDetailsUrl(item.stop)[query.company])
    const { data: etaData } = await API.get(etaUrl(item.stop)[query.company])

    item.stop_tc = stopData.data.name_tc
    item.lat = stopData.data.lat
    item.long = stopData.data.long
    item.eta = etaData.data.filter((item) => item.dir === getDirection().code)
    item.distance = haversine(currLocation, {
      latitude: stopData.data.lat,
      longitude: stopData.data.long,
    })
  })

  isPageLoading.value = false
}

const handleSwitchDirection = () => {
  isOutbound.value = !isOutbound.value
  fetchDetails()
}

const handleRefresh = () => {
  fetchDetails()
}

onMounted(() => {
  fetchDetails()
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
