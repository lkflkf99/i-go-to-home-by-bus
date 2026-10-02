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
              {{ t('plan.boardAt', { name: textByLocale(item.boardStopName, item.boardStopNameEn) }) }}
              <span v-if="item.walkDistance !== null"> · {{ formatMeters(item.walkDistance) }}</span>
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
  </div>
</template>

<script lang="ts" setup>
import { useRouter } from 'vue-router'
import type { PlannedRoute } from '@/model'
import { formatEta, formatMeters, getCurrentLocationOrNull, textByLocale } from '@/utils'
import { usePrefsStore } from '@/stores/prefs'
import { planRoutes } from '@/services/CommuteService'

const { t } = useI18n()
const router = useRouter()
const prefs = usePrefsStore()
const destQuery = ref('')
const isLoading = ref(false)
const errorMessage = ref('')
const results = ref<PlannedRoute[]>([])
let searchGen = 0

const originLabel = computed(() =>
  prefs.locationEnabled ? t('plan.usingLocation') : t('plan.locationOff')
)

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

  const nextResults = await planRoutes(location, dest)
  if (gen !== searchGen) {
    return
  }

  results.value = nextResults
  isLoading.value = false
}

debouncedWatch(
  destQuery,
  (value) => {
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
