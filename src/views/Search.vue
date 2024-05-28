<template>
  <div class="search-input">
    <el-input
      v-model="searchInput"
      size="large"
      placeholder="Search for a bus route"
      :prefix-icon="Search"
    />
  </div>

  <ul class="divide-y divide-gray-100 mt-8">
    <li
      class="flex justify-between gap-x-6 py-5"
      v-for="(item, index) in displayRouteList"
      v-bind:key="index"
      @click="() => goToDetails(item, item.co || 'KMB')"
    >
      <div class="flex min-w-0 gap-x-4">
        <div class="rounded-ful">
          <IconTablerBus class="h-6 w-6" />
          <p class="text-sm font-semibold text-gray-900">{{ item.co || 'KMB' }}</p>
        </div>
        <div class="min-w-0 flex-auto">
          <p class="text-sm font-semibold text-gray-900">{{ item.route }}</p>
          <p class="mt-1 truncate text-xs text-gray-500">
            {{ item.orig_tc }} - {{ item.dest_tc }}
          </p>
        </div>
      </div>
      <div class="shrink-0 sm:flex sm:flex-col sm:items-end">
        <el-icon :size="24" color="#ffcc00" @click.stop="() => toggleFav(item)">
          <StarFilled v-if="isFav(item)" />
          <Star v-else />
        </el-icon>
      </div>
    </li>
  </ul>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import { Star, StarFilled } from '@element-plus/icons-vue'
import { useRouter, useRoute } from 'vue-router'
import API from '@/services/ApiService'
import { Search } from '@element-plus/icons-vue'

const searchInput = ref('')
const displayRouteList = ref([])
const routeList = ref([])
const router = useRouter()
const favRoutes = ref(JSON.parse(localStorage.getItem('favRoutes') || '[]'))

onMounted(async () => {
  const { data: kmbRoute } = await API.get('/kmb/route')
  const { data: ctbRoute } = await API.get('/ctb/route/CTB')
  displayRouteList.value = routeList.value = kmbRoute.data.filter((item) => item.bound === 'O').concat(ctbRoute.data)
})

watch(
  () => searchInput.value,
  (value) => {
    if (!value) {
      displayRouteList.value = routeList.value
    } else {
      displayRouteList.value = routeList.value.filter((item) =>
        item.route.includes(value.toUpperCase())
      )
    }
  }
)

const goToDetails = (routeItem, company) => {
  router.push({
    name: 'Bus Stops',
    query: { route: routeItem.route, serviceType: routeItem.service_type, company },
  })
}

const toggleFav = (route) => {
  if (isFav(route)) {
    favRoutes.value = favRoutes.value.filter((item) => item.route !== route.route)
  } else {
    favRoutes.value = favRoutes.value.concat(route)
  }
  localStorage.setItem('favRoutes', JSON.stringify(favRoutes.value))
}

const isFav = (route) => {
  return favRoutes.value.some((item) => item.route === route.route)
}
</script>

<style scoped>
.search-input {
  margin: 0 -20px;
  padding: 8px 16px;
  top: 60px;
  position: fixed;
  width: 100%;
  background-color: #fff;
  z-index: 1;
}
</style>
