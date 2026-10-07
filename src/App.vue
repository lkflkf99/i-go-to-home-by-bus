<template>
  <el-config-provider :locale="elLocale">
    <div class="app-shell" @touchstart.passive="onTouchStart" @touchend.passive="onTouchEnd">
      <header class="nav-bar">
        <button v-if="showBack" class="nav-back" type="button" :aria-label="t('nav.back')" @click="goBack">
          <el-icon :size="22"><ArrowLeft /></el-icon>
          <span>{{ t('nav.search') }}</span>
        </button>
        <span v-else class="nav-btn" aria-hidden="true"></span>
        <h1 class="nav-title">{{ pageTitle }}</h1>
        <span class="nav-btn" aria-hidden="true"></span>
      </header>

      <main ref="contentRef" class="app-content" :class="{ 'is-map': isMap, 'is-details': isDetails }">
        <RouterView v-slot="{ Component }">
          <keep-alive :include="keptViews">
            <component :is="Component" :key="viewKey" />
          </keep-alive>
        </RouterView>
      </main>

      <nav class="tab-bar" aria-label="Primary">
        <button
          v-for="tab in tabs"
          :key="tab.path"
          class="tab-item"
          type="button"
          :class="{ active: isActive(tab.path) }"
          :aria-current="isActive(tab.path) ? 'page' : undefined"
          @click="selectTab(tab.path)"
        >
          <el-icon :size="24">
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
import { bindNativeViewport, hapticTap, loadTheme, syncNativeChrome } from '@/utils'
import { usePrefsStore } from '@/stores/prefs'

loadTheme()

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const prefs = usePrefsStore()
const contentRef = ref<HTMLElement | null>(null)
const swipeStartX = ref<number | null>(null)
const scrollByPath = new Map<string, number>()
const keptViews = ['Favorites', 'Search', 'Plan', 'Map', 'Settings']

const elLocale = computed(() => (locale.value === 'zh-HK' ? zhTw : en))

const tabs = computed(() => [
  { path: '/fav', label: t('nav.favorites'), icon: Star },
  { path: '/route', label: t('nav.search'), icon: Search },
  { path: '/plan-route', label: t('nav.plan'), icon: Guide },
  { path: '/map', label: t('nav.map'), icon: Location },
  { path: '/setting', label: t('nav.settings'), icon: Setting },
])

const showBack = computed(() => route.path === '/route/details')
const isDetails = computed(() => route.path === '/route/details')
const isMap = computed(() => route.path === '/map')
const viewKey = computed(() => (route.path === '/route/details' ? route.fullPath : route.path))

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

const selectTab = (path: string) => {
  if (route.path === path) {
    contentRef.value?.scrollTo({ top: 0, behavior: 'smooth' })
    return
  }
  hapticTap()
  router.push(path)
}

const onTouchStart = (event: TouchEvent) => {
  if (!showBack.value || event.touches[0].clientX > 28) {
    swipeStartX.value = null
    return
  }
  swipeStartX.value = event.touches[0].clientX
}

const onTouchEnd = (event: TouchEvent) => {
  if (swipeStartX.value === null) {
    return
  }
  const dx = event.changedTouches[0].clientX - swipeStartX.value
  swipeStartX.value = null
  if (dx > 72) {
    goBack()
  }
}

watch(
  () => prefs.locale,
  (value) => {
    document.title = t('app.title')
    document.documentElement.lang = value === 'zh-HK' ? 'zh-HK' : 'en'
  },
  { immediate: true }
)

watch(
  () => route.fullPath,
  (to, from) => {
    if (from && contentRef.value) {
      scrollByPath.set(from, contentRef.value.scrollTop)
    }

    const toDetails = to.startsWith('/route/details')

    nextTick(() => {
      if (!contentRef.value) {
        return
      }
      contentRef.value.scrollTop = toDetails ? 0 : scrollByPath.get(to) || 0
    })
  }
)

let unbindViewport = () => {}

onMounted(async () => {
  syncNativeChrome()
  unbindViewport = bindNativeViewport()

  if (!isCatalogStale()) {
    return
  }

  if (localStorage.getItem('dbLastUpdateTime')) {
    fetchBusData()
    return
  }

  await fetchBusData()
})

onBeforeUnmount(() => {
  unbindViewport()
})
</script>
