<template>
  <div>
    <el-input
      v-model="destQuery"
      size="large"
      clearable
      placeholder="Where are you going? e.g. 沙田"
    />
    <p class="mt-3 text-xs text-gray-500">{{ originLabel }}</p>

    <ul class="divide-y divide-gray-100 mt-4" v-if="isLoading">
      <li class="py-5" v-for="index in 4" :key="index">
        <el-skeleton :rows="2" animated />
      </li>
    </ul>

    <p v-else-if="errorMessage" class="mt-8 text-sm text-gray-500">{{ errorMessage }}</p>

    <p v-else-if="destQuery && !results.length" class="mt-8 text-sm text-gray-500">
      No nearby buses match that destination.
    </p>

    <ul class="divide-y divide-gray-100" v-else>
      <li
        class="flex justify-between gap-x-6 py-5"
        v-for="item in results"
        :key="`${item.co}-${item.route}-${item.dest_tc}-${item.boardStopId}`"
        @click="goToDetails(item)"
      >
        <div class="flex min-w-0 gap-x-4">
          <div class="rounded-ful">
            <IconTablerBus class="h-6 w-6" />
            <p class="text-sm font-semibold text-gray-900">{{ item.co }}</p>
          </div>
          <div class="min-w-0 flex-auto">
            <p class="text-sm font-semibold leading-6 text-gray-900">{{ item.route }}</p>
            <p class="mt-1 truncate text-xs leading-5 text-gray-500">To {{ item.dest_tc }}</p>
            <p class="mt-1 truncate text-xs leading-5 text-gray-500">
              Board at {{ item.boardStopName }}
              <span v-if="item.walkDistance !== null"> · {{ item.walkDistance.toFixed(0) }}M</span>
            </p>
          </div>
        </div>
        <div class="shrink-0 flex flex-col items-end">
          <p
            class="mt-1 text-xs leading-5"
            :class="{ 'font-bold': index === 0, 'text-gray-500': index !== 0 }"
            v-for="(eta, index) in item.etas.length ? item.etas : [null]"
            :key="index"
          >
            {{ eta ? formatDistanceToNow(new Date(eta)) : '-' }}
          </p>
        </div>
      </li>
    </ul>
  </div>
</template>

<script lang="ts" setup>
import { formatDistanceToNow } from 'date-fns'
import { useRouter } from 'vue-router'
import type { PlannedRoute } from '@/model'
import { getCurrentLocationOrNull } from '@/utils'
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
