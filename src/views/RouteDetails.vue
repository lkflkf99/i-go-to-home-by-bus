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
      <el-button round plain type="primary" :icon="Refresh" @click="handleRefresh">{{ t('details.refresh') }}</el-button>
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
              :style="{ color: stop?.distance <= 200 ? 'var(--el-color-primary)' : 'var(--app-text)' }"
            >
              {{ textByLocale(stop.stop_tc, stop.stop_en) }}
            </p>
            <p v-if="formatMeters(stop?.distance)" class="route-meta">{{ formatMeters(stop?.distance) }}</p>
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
            v-for="(stopEta, etaIndex) in stop.eta"
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
import API from '@/services/ApiService'
import { getCurrentLocationOrNull, isIOS, formatEta, formatMeters, textByLocale } from '@/utils'
import { usePrefsStore } from '@/stores/prefs'
import type { RouteStopResp, StopResp, EtaResp, RouteStop, Eta } from '@/model'
import trafficCam from '@/assets/traffic_cam.json'

interface DisplayStops extends RouteStop {
  stop_tc: string
  stop_en: string
  lat: string
  long: string
  eta: Eta[]
  distance: number
  camData?: object
}

const { t } = useI18n()
const prefs = usePrefsStore()
const displayStops = ref<DisplayStops[]>([])
const route = useRoute()
const isPageLoading = ref(false)
const isOutbound = ref(route.query.direction !== 'inbound')
const dialog = ref({
  visible: false,
  title: '',
  imageUrl: '',
})

const getDirection = () => {
  return isOutbound.value ? { name: 'outbound', code: 'O' } : { name: 'inbound', code: 'I' }
}

const handleStopClick = async (stop) => {
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

const handleViewTrafficCamClick = (camData) => {
  dialog.value = {
    visible: true,
    title: camData.description,
    imageUrl: camData.url,
  }
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
  const { query } = route
  const company = query.company === 'CTB' ? 'CTB' : query.company === 'KMB' ? 'KMB' : null

  if (!company) {
    return
  }

  isPageLoading.value = true
  const currLocation = await getCurrentLocationOrNull()

  const routeStopUrl = {
    KMB: `/kmb/route-stop/${query.route}/${getDirection().name}/${query.serviceType}`,
    CTB: `/ctb/route-stop/CTB/${query.route}/${getDirection().name}`,
  }

  const { data } = await API.get<RouteStopResp>(routeStopUrl[company])
  const stops = data.data

  const promises = stops.map(async (item) => {
    const { data: stopData } = await API.get<StopResp>(stopDetailsUrl(item.stop)[company])
    const { data: etaData } = await API.get<EtaResp>(etaUrl(item.stop)[company])

    const cam = trafficCam.find(
      (c) =>
        haversine(
          {
            latitude: Number(c.latitude),
            longitude: Number(c.longitude),
          },
          {
            latitude: Number(stopData.data.lat),
            longitude: Number(stopData.data.long),
          }
        ) <= 50
    )

    return {
      ...item,
      stop_tc: stopData.data.name_tc,
      stop_en: stopData.data.name_en,
      lat: stopData.data.lat,
      long: stopData.data.long,
      eta: etaData.data.filter((item) => item.dir === getDirection().code),
      distance: currLocation
        ? haversine(currLocation, {
            latitude: Number(stopData.data.lat),
            longitude: Number(stopData.data.long),
          })
        : Number.NaN,
      camData: cam,
    }
  })

  Promise.all(promises).then((values) => {
    displayStops.value = values
    isPageLoading.value = false
  })
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

watch(
  () => prefs.locationEnabled,
  () => {
    fetchDetails()
  }
)
</script>
