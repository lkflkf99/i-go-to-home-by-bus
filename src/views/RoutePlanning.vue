<template>
  <div>
    <div class="sticky-search">
      <el-input
        v-model="destQuery"
        size="large"
        clearable
        placeholder="Where are you going? e.g. 沙田"
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
      No nearby buses match that destination.
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
            <p class="route-meta">To {{ item.dest_tc }}</p>
            <p class="route-meta">
              Board at {{ item.boardStopName }}
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
import { formatEta, formatMeters, getCurrentLocationOrNull } from '@/utils'
import { planRoutes } from '@/services/CommuteService'

const router = useRouter()
const destQuery = ref('')
const isLoading = ref(false)
const errorMessage = ref('')
const originLabel = ref('Using your current location')
const results = ref<PlannedRoute[]>([])

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
  if (!dest) {
    results.value = []
    errorMessage.value = ''
    return
  }

  isLoading.value = true
  errorMessage.value = ''

  const location = await getCurrentLocationOrNull()
  if (!location) {
    originLabel.value = 'Location unavailable'
    errorMessage.value = 'Enable location to plan a route from nearby stops.'
    results.value = []
    isLoading.value = false
    return
  }

  originLabel.value = 'Using your current location'
  results.value = await planRoutes(location, dest)

  isLoading.value = false
}

debouncedWatch(
  destQuery,
  (value) => {
    search(value)
  },
  { debounce: 400 }
)
</script>
