<template>
  <div>
    <div class="sticky-search">
      <el-input
        v-model="destQuery"
        size="large"
        clearable
        :placeholder="t('plan.placeholder')"
      />
      <p class="filter-banner">{{ originLabel }}</p>
      <p v-if="destBanner" class="filter-banner">{{ destBanner }}</p>
    </div>

    <ul class="settings-group" v-if="isLoading">
      <li class="route-row" v-for="index in 4" :key="index">
        <el-skeleton :rows="2" animated />
      </li>
    </ul>

    <p v-else-if="errorMessage" class="empty-state">{{ errorMessage }}</p>

    <p v-else-if="destQuery && !results.length" class="empty-state">
      {{ t('plan.noMatch') }}
    </p>

    <ul class="settings-group" v-else-if="results.length">
      <li
        class="route-row"
        v-for="item in results"
        :key="`${item.co}-${item.route}-${item.dest_tc}-${item.boardStopId}`"
        @click="goToDetails(item)"
      >
        <div class="flex min-w-0 gap-x-3">
          <div class="route-badge">{{ item.co }}</div>
          <div class="min-w-0 flex-auto">
            <p class="route-number">{{ item.route }}</p>
            <p class="route-meta">{{ t('plan.to', { name: textByLocale(item.dest_tc, item.dest_en) }) }}</p>
            <p class="route-meta">
              {{
                [
                  t('plan.boardAt', { name: textByLocale(item.boardStopName, item.boardStopNameEn) }),
                  item.walkDistance !== null ? formatMeters(item.walkDistance) : '',
                  item.journeyMin ? t('plan.rideMin', { n: item.journeyMin }) : '',
                  formatFare(item.fare),
                ]
                  .filter(Boolean)
                  .join(' · ')
              }}
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
          <p v-if="!item.etas[0] && item.serving === false" class="eta-secondary">
            {{ t('details.notRunning') }}
          </p>
        </div>
      </li>
    </ul>
  </div>
</template>

<script lang="ts">
export default { name: 'Plan' }
</script>

<script lang="ts" setup>
import { ElMessage } from 'element-plus'
import { useRouter } from 'vue-router'
import type { PlannedRoute, SavedPlace } from '@/model'
import { formatEta, formatFare, formatMeters, getCurrentLocationOrNull, textByLocale } from '@/utils'
import { useCommuteStore } from '@/stores/commute'
import { usePrefsStore } from '@/stores/prefs'
import { planRoutes } from '@/services/CommuteService'
import { ensureHkbusRouteIndex } from '@/services/BusService'

type QuickDest = 'home' | 'work' | null

const { t } = useI18n()
const router = useRouter()
const store = useCommuteStore()
const prefs = usePrefsStore()
const destQuery = ref('')
const quickDest = ref<QuickDest>(null)
const isLoading = ref(false)
const errorMessage = ref('')
const results = ref<PlannedRoute[]>([])
let searchGen = 0

const originLabel = computed(() =>
  prefs.locationEnabled ? t('plan.usingLocation') : t('plan.locationOff')
)

const destPlace = computed<SavedPlace | null>(() => {
  if (quickDest.value === 'home') {
    return store.homePlace
  }
  if (quickDest.value === 'work') {
    return store.workPlace
  }
  return null
})

const destBanner = computed(() => {
  if (quickDest.value === 'home' && store.homePlace) {
    return t('fav.goingHome', { name: textByLocale(store.homePlace.name_tc, store.homePlace.name_en) })
  }
  if (quickDest.value === 'work' && store.workPlace) {
    return t('fav.goingWork', { name: textByLocale(store.workPlace.name_tc, store.workPlace.name_en) })
  }
  return ''
})

const placeName = (place: SavedPlace) => textByLocale(place.name_tc, place.name_en)

const goToDetails = (item: PlannedRoute) => {
  router.push({
    name: 'Bus Stops',
    query: {
      route: item.route,
      serviceType: String(item.service_type || 1),
      company: item.co,
      direction: item.direction,
    },
  })
}

const search = async (query: string) => {
  const dest = query.trim()
  const gen = ++searchGen
  if (!dest) {
    results.value = []
    errorMessage.value = ''
    isLoading.value = false
    return
  }

  isLoading.value = true
  errorMessage.value = ''

  const location = await getCurrentLocationOrNull()
  if (gen !== searchGen) {
    return
  }
  if (!location) {
    errorMessage.value = t('plan.locationOff')
    results.value = []
    isLoading.value = false
    return
  }

  await ensureHkbusRouteIndex().catch(() => undefined)
  if (gen !== searchGen) {
    return
  }

  const nextResults = await planRoutes(location, dest, destPlace.value)
  if (gen !== searchGen) {
    return
  }

  results.value = nextResults
  isLoading.value = false
}

debouncedWatch(
  destQuery,
  (value) => {
    const trimmed = value.trim()
    if (!trimmed) {
      quickDest.value = null
    } else if (quickDest.value === 'home' && store.homePlace && trimmed !== placeName(store.homePlace)) {
      quickDest.value = null
    } else if (quickDest.value === 'work' && store.workPlace && trimmed !== placeName(store.workPlace)) {
      quickDest.value = null
    }
    search(value)
  },
  { debounce: 400 }
)

watch(
  () => prefs.locationEnabled,
  () => {
    if (destQuery.value) {
      search(destQuery.value)
    }
  }
)
</script>

<style scoped>
.plan-quick {
  margin-top: 8px;
}

.is-active-filter {
  --el-button-bg-color: var(--el-color-primary);
  --el-button-text-color: #fff;
  --el-button-border-color: var(--el-color-primary);
}
</style>
