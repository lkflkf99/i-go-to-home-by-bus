<template>
  <ul class="divide-y divide-gray-100">
    <li
      class="flex justify-between gap-x-6 py-5"
      v-for="(item, index) in favRoutes"
      v-bind:key="index"
      @click="() => goToDetails(item)"
    >
      <div class="flex min-w-0 gap-x-4">
        <div class="rounded-ful">
          <IconTablerBus class="h-6 w-6" />
        </div>
        <div class="min-w-0 flex-auto">
          <p class="text-sm font-semibold leading-6 text-gray-900">{{ item.route }}</p>
          <p class="mt-1 truncate text-xs leading-5 text-gray-500">
            {{ item.orig_tc }} - {{ item.dest_tc }}
          </p>
        </div>
      </div>
    </li>
  </ul>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const favRoutes = ref(JSON.parse(localStorage.getItem('favRoutes') || '[]'))

const goToDetails = (routeItem) => {
  router.push({
    name: 'Bus Stops',
    query: { route: routeItem.route, serviceType: routeItem.service_type },
  })
}
</script>

<style scoped>
</style>
