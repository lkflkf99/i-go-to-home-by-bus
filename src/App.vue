<template>
  <div class="app-shell">
    <header class="nav-bar">
      <button v-if="showBack" class="nav-btn" type="button" aria-label="Back" @click="goBack">
        <el-icon :size="22"><ArrowLeft /></el-icon>
      </button>
      <span v-else class="nav-btn" aria-hidden="true"></span>
      <h1 class="nav-title">{{ pageTitle }}</h1>
      <span class="nav-btn" aria-hidden="true"></span>
    </header>

    <main class="app-content" :class="{ 'is-map': isMap }">
      <RouterView />
    </main>

    <nav class="tab-bar">
      <button
        v-for="tab in tabs"
        :key="tab.path"
        class="tab-item"
        type="button"
        :class="{ active: isActive(tab.path) }"
        @click="router.push(tab.path)"
      >
        <el-icon :size="22">
          <component :is="tab.icon" />
        </el-icon>
        <span>{{ tab.label }}</span>
      </button>
    </nav>
  </div>
</template>

<script lang="ts" setup>
import { useRouter, useRoute } from 'vue-router'
import { ArrowLeft, Location, Setting, Search, Star, Guide } from '@element-plus/icons-vue'
import { fetchBusData } from '@/services/BusService'
import { loadTheme } from '@/utils'

loadTheme()

const route = useRoute()
const router = useRouter()

const tabs = [
  { path: '/fav', label: 'Favorites', icon: Star },
  { path: '/route', label: 'Search', icon: Search },
  { path: '/plan-route', label: 'Plan', icon: Guide },
  { path: '/map', label: 'Map', icon: Location },
  { path: '/setting', label: 'Settings', icon: Setting },
]

const showBack = computed(() => route.path === '/route/details')
const isMap = computed(() => route.path === '/map')

const pageTitle = computed(() => {
  if (route.path === '/route/details' && route.query.route) {
    return String(route.query.route)
  }
  return String(route.name || '')
})

const goBack = () => {
  if (window.history.length > 1) {
    router.back()
    return
  }
  router.push('/route')
}

const isActive = (path: string) => {
  if (path === '/route') {
    return route.path.startsWith('/route')
  }
  return route.path === path
}

onMounted(async () => {
  if (!localStorage.getItem('dbLastUpdateTime')) {
    await fetchBusData()
  }
})
</script>
