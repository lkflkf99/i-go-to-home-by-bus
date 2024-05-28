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
    >
      <div class="flex min-w-0 gap-x-4">
        <div class="rounded-ful">
          <IconBxBus class="h-6 w-6" />
        </div>
        <div class="min-w-0 flex-auto">
          <p class="text-sm font-semibold leading-6 text-gray-900">{{ item.route }}</p>
          <p class="mt-1 truncate text-xs leading-5 text-gray-500">
            {{ item.orig_tc }} - {{ item.dest_tc }}
          </p>
        </div>
      </div>
      <div class="shrink-0 sm:flex sm:flex-col sm:items-end">
        <p class="text-sm leading-6 text-gray-900">Co-Founder / CEO</p>
        <p class="mt-1 text-xs leading-5 text-gray-500">
          Last seen <time datetime="2023-01-23T13:23Z">3h ago</time>
        </p>
      </div>
    </li>
  </ul>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import API from '@/services/ApiService'
import { Search } from '@element-plus/icons-vue'

const searchInput = ref('')
const displayRouteList = ref([])
const routeList = ref([])

onMounted(async () => {
  const { data } = await API.get('/kmb/route')
  displayRouteList.value = routeList.value = data.data.filter((item) => item.bound === 'O')
})

watch(
  () => searchInput.value,
  (value) => {
    if (!value) {
      displayRouteList.value = routeList.value
    } else {
      displayRouteList.value = routeList.value.filter((item) => item.route.includes(value))
    }
  }
)
</script>

<style scoped>
.search-input {
  top: 60px;
  position: fixed;
  width: calc(100% - 38px);
  background-color: #fff;
}
</style>
