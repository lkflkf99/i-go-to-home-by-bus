<template>
  <div>
    <div class="action-row toolbar-row">
      <el-button
        class="toolbar-chip"
        round
        plain
        :class="{ 'is-active-filter': commuteFilter === 'home' }"
        @click="toggleFilter('home')"
      >
        {{ t('fav.goHome') }}
      </el-button>
      <el-button
        class="toolbar-chip"
        round
        plain
        :class="{ 'is-active-filter': commuteFilter === 'work' }"
        @click="toggleFilter('work')"
      >
        {{ t('fav.goWork') }}
      </el-button>
      <el-button
        class="toolbar-btn"
        circle
        plain
        :icon="Refresh"
        :aria-label="t('fav.refresh')"
        :loading="isRefreshing"
        @click="handleRefresh"
      />
    </div>

    <p v-if="filterBanner" class="filter-banner">{{ filterBanner }}</p>

    <p v-if="!store.favRoutes.length" class="empty-state">
      {{ t('fav.empty') }}
    </p>

    <ul class="settings-group" v-else>
      <li
        class="route-row"
        v-for="item in visibleFavorites"
        :key="routeKey(item)"
        @click="goToDetails(item)"
      >
        <div class="listing-route">
          <div class="listing-title-row">
            <div class="route-badge">{{ item.co }}</div>
            <p class="route-number">{{ item.route }}</p>
            <button class="star-hit" type="button" :aria-label="t('fav.remove')" @click.stop="store.removeFav(item)">
              <el-icon :size="20" color="#ffcc00">
                <StarFilled />
              </el-icon>
            </button>
          </div>
          <div class="listing-detail-row">
            <div class="min-w-0 flex-auto">
              <p class="route-meta">
                {{ textByLocale(item.orig_tc, item.orig_en) }} - {{ textByLocale(item.dest_tc, item.dest_en) }}
              </p>
              <p v-if="stopMeta(item)" class="route-meta">{{ stopMeta(item) }}</p>
              <el-skeleton v-else-if="item.etasLoading" animated>
                <template #template>
                  <el-skeleton-item variant="text" class="route-skel-meta" />
                </template>
              </el-skeleton>
            </div>
            <div class="eta-stack">
              <el-skeleton v-if="item.etasLoading" animated class="eta-skeleton">
                <template #template>
                  <el-skeleton-item variant="text" class="eta-skeleton-primary" />
                  <el-skeleton-item variant="text" class="eta-skeleton-secondary" />
                </template>
              </el-skeleton>
              <template v-else>
                <p
                  v-for="(eta, index) in displayEtas(item.etas)"
                  :key="index"
                  :class="index === 0 ? 'eta-primary' : 'eta-secondary'"
                >
                  {{ formatEta(eta) }}
                </p>
              </template>
            </div>
          </div>
        </div>
      </li>
      <li v-if="commuteFilter && !visibleFavorites.length" class="route-row">
        <p class="route-meta">
          {{ t('fav.noneToward', { name: textByLocale(targetPlace?.name_tc, targetPlace?.name_en) }) }}
        </p>
      </li>
    </ul>
  </div>
</template>

<script lang="ts">
export default { name: 'Favorites' }
</script>

<script lang="ts" setup>
import { ElMessage } from 'element-plus'
import { Refresh, StarFilled } from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'
import type { BusRoute, LiveFavorite, SavedPlace } from '@/model'
import { useCommuteStore } from '@/stores/commute'
import { usePrefsStore } from '@/stores/prefs'
import {
  formatEta,
  formatFare,
  formatMeters,
  getCompany,
  getCurrentLocationOrNull,
  routeKey,
  textByLocale,
  withCompany,
} from '@/utils'
import { loadLiveFavorite, refreshFavoriteEtas } from '@/services/CommuteService'

type CommuteFilter = 'home' | 'work' | null
type DisplayFavorite = LiveFavorite & { etasLoading: boolean }

function toPlaceholder(route: BusRoute): DisplayFavorite {
  return {
    ...withCompany(route),
    co: getCompany(route),
    nearestStopName: '',
    nearestStopNameEn: '',
    nearestStopId: '',
    nearestDistance: null,
    direction: route.bound === 'I' ? 'inbound' : 'outbound',
    etas: [],
    servesPlace: true,
    fare: null,
    etasLoading: true,
  }
}

const { t } = useI18n()
const router = useRouter()
const store = useCommuteStore()
const prefs = usePrefsStore()
const isRefreshing = ref(false)
const commuteFilter = ref<CommuteFilter>(null)
const liveFavorites = ref<DisplayFavorite[]>(store.favRoutes.map(toPlaceholder))
let loadGen = 0

const targetPlace = computed<SavedPlace | null>(() => {
  if (commuteFilter.value === 'home') {
    return store.homePlace
  }
  if (commuteFilter.value === 'work') {
    return store.workPlace
  }
  return null
})

const visibleFavorites = computed(() => {
  if (!commuteFilter.value || liveFavorites.value.some((item) => item.etasLoading)) {
    return liveFavorites.value
  }
  return liveFavorites.value.filter((item) => item.servesPlace)
})

const stopMeta = (item: DisplayFavorite) => {
  if (item.etasLoading) {
    return ''
  }
  return [
    textByLocale(item.nearestStopName, item.nearestStopNameEn),
    item.nearestDistance !== null ? formatMeters(item.nearestDistance) : '',
    formatFare(item.fare),
  ]
    .filter(Boolean)
    .join(' · ')
}

const filterBanner = computed(() => {
  if (commuteFilter.value === 'home' && store.homePlace) {
    return t('fav.goingHome', { name: textByLocale(store.homePlace.name_tc, store.homePlace.name_en) })
  }
  if (commuteFilter.value === 'work' && store.workPlace) {
    return t('fav.goingWork', { name: textByLocale(store.workPlace.name_tc, store.workPlace.name_en) })
  }
  return ''
})

const displayEtas = (etas: Array<string | null>) => {
  return etas.length ? etas : [null]
}

const goToDetails = (item: LiveFavorite) => {
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

const loadLive = async (resetEtas = false) => {
  const gen = ++loadGen
  if (!store.favRoutes.length) {
    liveFavorites.value = []
    return
  }

  const existing = new Map(liveFavorites.value.map((item) => [routeKey(item), item]))
  liveFavorites.value = store.favRoutes.map((route) => {
    const current = existing.get(routeKey(route))
    if (!current) {
      return toPlaceholder(route)
    }
    return resetEtas ? { ...current, etasLoading: true } : current
  })

  const location = await getCurrentLocationOrNull()
  if (gen !== loadGen) {
    return
  }

  const results = await Promise.all(
    store.favRoutes.map(async (route) => {
      const live = {
        ...(await loadLiveFavorite(route, location, targetPlace.value)),
        etasLoading: false,
      }
      if (gen !== loadGen) {
        return live
      }
      liveFavorites.value = liveFavorites.value.map((item) =>
        routeKey(item) === routeKey(route) ? live : item
      )
      return live
    })
  )
  if (gen !== loadGen) {
    return
  }
  liveFavorites.value = results
}

const handleRefresh = async () => {
  if (!liveFavorites.value.length || liveFavorites.value.some((item) => item.etasLoading)) {
    await loadLive()
    return
  }

  isRefreshing.value = true
  liveFavorites.value = await Promise.all(
    liveFavorites.value.map(async (item) => ({
      ...(await refreshFavoriteEtas(item)),
      etasLoading: false,
    }))
  )
  isRefreshing.value = false
}

const toggleFilter = async (next: 'home' | 'work') => {
  const place = next === 'home' ? store.homePlace : store.workPlace
  if (!place) {
    ElMessage.info({
      message: next === 'home' ? t('fav.setHomeFirst') : t('fav.setWorkFirst'),
    })
    return
  }

  commuteFilter.value = commuteFilter.value === next ? null : next
  await loadLive(true)
}

watch(
  () => store.favRoutes.length,
  () => {
    loadLive()
  }
)

watch(
  () => prefs.locationEnabled,
  () => {
    loadLive(true)
  }
)

const visibility = useDocumentVisibility()

useIntervalFn(() => {
  if (
    visibility.value !== 'visible' ||
    !store.favRoutes.length ||
    liveFavorites.value.some((item) => item.etasLoading)
  ) {
    return
  }
  handleRefresh()
}, 30000)

onMounted(() => {
  loadLive()
})
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
  margin-left: auto;
  --el-button-text-color: var(--el-color-primary);
  --el-button-bg-color: var(--app-surface);
  --el-button-border-color: var(--app-separator);
  --el-button-hover-text-color: var(--el-color-primary);
  --el-button-hover-bg-color: var(--row-active);
  --el-button-hover-border-color: var(--app-separator);
}

.toolbar-row.action-row .toolbar-chip {
  --el-button-bg-color: var(--app-surface);
  --el-button-text-color: var(--app-text);
  --el-button-border-color: var(--app-separator);
  --el-button-hover-bg-color: var(--row-active);
  --el-button-hover-text-color: var(--app-text);
  --el-button-hover-border-color: var(--app-separator);
}

.toolbar-row.action-row .toolbar-chip.is-active-filter {
  --el-button-bg-color: var(--el-color-primary);
  --el-button-text-color: #fff;
  --el-button-border-color: var(--el-color-primary);
  --el-button-hover-bg-color: var(--el-color-primary);
  --el-button-hover-text-color: #fff;
  --el-button-hover-border-color: var(--el-color-primary);
}
</style>
