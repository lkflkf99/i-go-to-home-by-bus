<template>
  <el-config-provider :locale="elLocale">
    <div class="app-shell">
      <header class="nav-bar">
        <button v-if="showBack" class="nav-btn" type="button" :aria-label="t('nav.back')" @click="goBack">
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
  </el-config-provider>
</template>

<script lang="ts" setup>
import { useRouter, useRoute } from 'vue-router'
import { ArrowLeft, Location, Setting, Search, Star, Guide } from '@element-plus/icons-vue'
import en from 'element-plus/es/locale/lang/en'
import zhTw from 'element-plus/es/locale/lang/zh-tw'
import { fetchBusData, isCatalogStale } from '@/services/BusService'
import { loadTheme } from '@/utils'
import { usePrefsStore } from '@/stores/prefs'

loadTheme()

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const prefs = usePrefsStore()

const elLocale = computed(() => (locale.value === 'zh-HK' ? zhTw : en))

const tabs = computed(() => [
  { path: '/fav', label: t('nav.favorites'), icon: Star },
  { path: '/route', label: t('nav.search'), icon: Search },
  { path: '/plan-route', label: t('nav.plan'), icon: Guide },
  { path: '/map', label: t('nav.map'), icon: Location },
  { path: '/setting', label: t('nav.settings'), icon: Setting },
])

const showBack = computed(() => route.path === '/route/details')
const isMap = computed(() => route.path === '/map')

const pageTitle = computed(() => {
  if (route.path === '/route/details' && route.query.route) {
    return String(route.query.route)
  }
  const titles: Record<string, string> = {
    '/fav': t('nav.favorites'),
    '/route': t('nav.search'),
    '/plan-route': t('nav.plan'),
    '/map': t('nav.map'),
    '/setting': t('nav.settings'),
  }
  return titles[route.path] || t('app.title')
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

watch(
  () => prefs.locale,
  () => {
    document.title = t('app.title')
  },
  { immediate: true }
)

onMounted(async () => {
  if (!isCatalogStale()) {
    return
  }

  if (localStorage.getItem('dbLastUpdateTime')) {
    fetchBusData()
    return
  }

  await fetchBusData()
})
</script>
