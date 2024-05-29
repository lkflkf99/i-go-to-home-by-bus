<template>
  <ul class="divide-y divide-gray-100">
    <li class="flex justify-between gap-x-6 py-5" v-loading="isFetching" @click="handleUpdateDB">
      <div class="flex min-w-0 gap-x-4">
        <div class="min-w-0 flex-auto">
          <p class="text-sm font-semibold text-gray-900">Update Local DB</p>
          <p class="mt-1 truncate text-xs text-gray-500">
            Last Updated Time: {{ lastUpdateTime ? format(lastUpdateTime, 'dd-MM-yyyy HH:mm') : '-' }}
          </p>
        </div>
      </div>
    </li>
  </ul>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import { format } from 'date-fns'
// import { useRouter, useRoute } from 'vue-router'
// import API from '@/services/ApiService'
import { fetchBusData } from '@/services/BusService'

const isFetching = ref(false)
const lastUpdateTime = ref(localStorage.getItem('dbLastUpdateTime'))

const handleUpdateDB = async () => {
  isFetching.value = true

  try {
    const res = await fetchBusData()
    lastUpdateTime.value = res
    isFetching.value = false
  } catch {
    isFetching.value = false
  }
}
</script>

<style scoped></style>
