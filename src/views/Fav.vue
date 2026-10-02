<template>
  <div>
    <div class="action-row">
      <el-button
        round
        plain
        type="primary"
        :class="{ 'is-active-filter': commuteFilter === 'home' }"
        @click="toggleFilter('home')"
      >
        Go Home
      </el-button>
      <el-button
        round
        plain
        type="primary"
        :class="{ 'is-active-filter': commuteFilter === 'work' }"
        @click="toggleFilter('work')"
      >
        Go Work
      </el-button>
      <el-button round plain type="primary" :icon="Refresh" :loading="isRefreshing" @click="handleRefresh">
        Refresh
      </el-button>
    </div>

    <p v-if="filterBanner" class="filter-banner">{{ filterBanner }}</p>

    <p v-if="!store.favRoutes.length" class="empty-state">
      Star routes from Search to see live arrivals here.
    </p>

    <ul class="settings-group" v-else-if="isPageLoading">
      <li class="route-row" v-for="index in store.favRoutes.length || 3" :key="index">
        <el-skeleton :rows="2" animated />
      </li>
    </ul>

    <ul class="settings-group" v-else>
      <li
        class="route-row"
        v-for="item in visibleFavorites"
        :key="`${item.co}-${item.route}-${item.service_type}-${item.direction}`"
        @click="goToDetails(item)"
      >
        <div class="flex min-w-0 gap-x-3">
          <div class="route-badge">{{ item.co }}</div>
          <div class="min-w-0 flex-auto">
            <p class="route-number">{{ item.route }}</p>
            <p class="route-meta">{{ item.orig_tc }} - {{ item.dest_tc }}</p>
            <p class="route-meta">
              {{ item.nearestStopName }}
              <span v-if="item.nearestDistance !== null"> · {{ formatMeters(item.nearestDistance) }}</span>
            </p>
          </div>
        </div>
        <div class="eta-stack">
          <button class="star-hit" type="button" aria-label="Remove favorite" @click.stop="store.removeFav(item)">
            <el-icon :size="20" color="#ffcc00">
              <StarFilled />
            </el-icon>
          </button>
          <p
            v-for="(eta, index) in displayEtas(item.etas)"
            :key="index"
            :class="index === 0 ? 'eta-primary' : 'eta-secondary'"
          >
            {{ formatEta(eta) }}
          </p>
        </div>
      </li>
      <li v-if="commuteFilter && !visibleFavorites.length" class="route-row">
        <p class="route-meta">
          No favorite routes go toward {{ targetPlace?.name_tc }}. Star a route that passes that stop.
        </p>
      </li>
    </ul>
  </div>
</template>

<script lang="ts" setup>
import { ElMessage } from 'element-plus'
import { Refresh, StarFilled } from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'
import type { LiveFavorite, SavedPlace } from '@/model'
import { useCommuteStore } from '@/stores/commute'
import { formatEta, formatMeters, getCurrentLocationOrNull } from '@/utils'
import { loadLiveFavorite, refreshFavoriteEtas } from '@/services/CommuteService'

type CommuteFilter = 'home' | 'work' | null

const router = useRouter()
const store = useCommuteStore()
const isPageLoading = ref(false)
const isRefreshing = ref(false)
const commuteFilter = ref<CommuteFilter>(null)
const liveFavorites = ref<LiveFavorite[]>([])

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
  if (!commuteFilter.value) {
    return liveFavorites.value
  }
  return liveFavorites.value.filter((item) => item.servesPlace)
})

const filterBanner = computed(() => {
  if (commuteFilter.value === 'home' && store.homePlace) {
    return `Going home to ${store.homePlace.name_tc}`
  }
  if (commuteFilter.value === 'work' && store.workPlace) {
    return `Going to work at ${store.workPlace.name_tc}`
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

const loadLive = async () => {
  if (!store.favRoutes.length) {
    liveFavorites.value = []
    return
  }

  isPageLoading.value = true
  const location = await getCurrentLocationOrNull()

  const results = await Promise.all(
    store.favRoutes.map((route) => loadLiveFavorite(route, location, targetPlace.value))
  )
  liveFavorites.value = results
  isPageLoading.value = false
}

const handleRefresh = async () => {
  if (!liveFavorites.value.length) {
    await loadLive()
    return
  }

  isRefreshing.value = true
  liveFavorites.value = await Promise.all(liveFavorites.value.map((item) => refreshFavoriteEtas(item)))
  isRefreshing.value = false
}

const toggleFilter = async (next: 'home' | 'work') => {
  const place = next === 'home' ? store.homePlace : store.workPlace
  if (!place) {
    ElMessage.info({
      message: next === 'home' ? 'Set your home stop in Settings first' : 'Set your work stop in Settings first',
    })
    return
  }

  commuteFilter.value = commuteFilter.value === next ? null : next
  await loadLive()
}

watch(
  () => store.favRoutes.length,
  () => {
    loadLive()
  }
)

useIntervalFn(() => {
  if (!store.favRoutes.length || isPageLoading.value) {
    return
  }
  handleRefresh()
}, 30000)

onMounted(() => {
  loadLive()
})
</script>

<style scoped>
.is-active-filter {
  --el-button-bg-color: var(--el-color-primary);
  --el-button-text-color: #fff;
  --el-button-border-color: var(--el-color-primary);
}
</style>
