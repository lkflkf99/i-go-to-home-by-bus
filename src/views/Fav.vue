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
        {{ t('fav.goHome') }}
      </el-button>
      <el-button
        round
        plain
        type="primary"
        :class="{ 'is-active-filter': commuteFilter === 'work' }"
        @click="toggleFilter('work')"
      >
        {{ t('fav.goWork') }}
      </el-button>
      <el-button round plain type="primary" :icon="Refresh" :loading="isRefreshing" @click="handleRefresh">
        {{ t('fav.refresh') }}
      </el-button>
    </div>

    <p v-if="filterBanner" class="filter-banner">{{ filterBanner }}</p>

    <p v-if="!store.favRoutes.length" class="empty-state">
      {{ t('fav.empty') }}
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
            <p class="route-meta">
              {{ textByLocale(item.orig_tc, item.orig_en) }} - {{ textByLocale(item.dest_tc, item.dest_en) }}
            </p>
            <p class="route-meta">
              {{
                [
                  textByLocale(item.nearestStopName, item.nearestStopNameEn),
                  item.nearestDistance !== null ? formatMeters(item.nearestDistance) : '',
                  formatFare(item.fare),
                ]
                  .filter(Boolean)
                  .join(' · ')
              }}
            </p>
          </div>
        </div>
        <div class="eta-stack">
          <button class="star-hit" type="button" :aria-label="t('fav.remove')" @click.stop="store.removeFav(item)">
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
          {{ t('fav.noneToward', { name: textByLocale(targetPlace?.name_tc, targetPlace?.name_en) }) }}
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
import { usePrefsStore } from '@/stores/prefs'
import { formatEta, formatFare, formatMeters, getCurrentLocationOrNull, textByLocale } from '@/utils'
import { loadLiveFavorite, refreshFavoriteEtas } from '@/services/CommuteService'

type CommuteFilter = 'home' | 'work' | null

const { t } = useI18n()
const router = useRouter()
const store = useCommuteStore()
const prefs = usePrefsStore()
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
      message: next === 'home' ? t('fav.setHomeFirst') : t('fav.setWorkFirst'),
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

watch(
  () => prefs.locationEnabled,
  () => {
    loadLive()
  }
)

const visibility = useDocumentVisibility()

useIntervalFn(() => {
  if (visibility.value !== 'visible' || !store.favRoutes.length || isPageLoading.value) {
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
