<template>
  <div class="search-page">
    <div class="sticky-search">
      <el-input
        v-model="searchInput"
        size="large"
        :placeholder="t('search.placeholder')"
        :prefix-icon="Search"
        readonly
        inputmode="none"
        tabindex="-1"
        @mousedown.prevent="openKeyboard"
        @touchstart.prevent="openKeyboard"
        @focus="keepSystemKeyboardClosed"
      />
    </div>

    <div ref="listRef" class="search-list" v-infinite-scroll="loadRoute">
    <ul class="settings-group">
      <li
        class="route-row"
        v-for="(item, index) in displayRouteList"
        :key="index"
        @click="() => goToDetails(item, item.co || 'KMB')"
      >
        <div class="listing-route">
          <div class="listing-title-row">
            <div class="route-badge">{{ item.co || 'KMB' }}</div>
            <p class="route-number">
              {{ item.route }}
              <span v-if="item.service_type > 1" class="route-meta">({{ t('search.special') }})</span>
            </p>
            <button class="star-hit" type="button" :aria-label="t('search.toggleFav')" @click.stop="() => commuteStore.toggleFav(item)">
              <el-icon :size="20" color="#ffcc00">
                <StarFilled v-if="commuteStore.isFav(item)" />
                <Star v-else />
              </el-icon>
            </button>
          </div>
          <p class="route-meta">{{ textByLocale(item.orig_tc, item.orig_en) }} - {{ textByLocale(item.dest_tc, item.dest_en) }}</p>
        </div>
      </li>
    </ul>
    </div>

    <Keyboard ref="keyboardRef" @change="handleInput" :letter-keys="letterKeys" />
  </div>
</template>

<script lang="ts">
export default { name: 'Search' }
</script>

<script lang="ts" setup>
import { Search, Star, StarFilled } from '@element-plus/icons-vue'
import { useCommuteStore } from '@/stores/commute'
import { getCompany, textByLocale } from '@/utils'

const { t } = useI18n()
const keyboardRef = ref()
const listRef = ref<HTMLElement | null>(null)
const scrollCount = ref(10)
const searchInput = ref('')
const displayRouteList = ref(JSON.parse(localStorage.getItem('routes') || '[]').slice(0, 10))
const routeList = ref(JSON.parse(localStorage.getItem('routes') || '[]'))
const router = useRouter()
const commuteStore = useCommuteStore()

watch(
  () => searchInput.value,
  (value) => {
    if (!value) {
      displayRouteList.value = routeList.value.slice(0, 10)
    } else {
      displayRouteList.value = routeList.value.filter((item) =>
        item.route.startsWith(value.toUpperCase())
      )
    }
    nextTick(() => {
      if (listRef.value) {
        listRef.value.scrollTop = 0
      }
    })
  }
)

const letterKeys = computed(() => {
  if (!searchInput.value) {
    return []
  }

  return displayRouteList.value
    .map((item) => {
      const match = item.route.match(/[a-zA-Z]/g)
      return match ? match[match.length - 1] : null
    })
    .filter((item, index, self) => item && self.indexOf(item) === index)
    .sort()
})

const goToDetails = (routeItem, company) => {
  router.push({
    name: 'Bus Stops',
    query: { route: routeItem.route, serviceType: routeItem.service_type, company: company || getCompany(routeItem) },
  })
}

const loadRoute = () => {
  if (!searchInput.value) {
    displayRouteList.value = displayRouteList.value.concat(
      routeList.value.slice(scrollCount.value, scrollCount.value + 10)
    )
    scrollCount.value += 10
  }
}

const openKeyboard = () => {
  keyboardRef.value?.open()
}

const keepSystemKeyboardClosed = (event: FocusEvent) => {
  const target = event.target as HTMLInputElement | null
  target?.blur()
  openKeyboard()
}

const handleInput = (val) => {
  if (val === 'back') {
    searchInput.value = searchInput.value.slice(0, -1)
    return
  }

  if (val === 'reset') {
    searchInput.value = ''
    return
  }

  searchInput.value += val
}

onDeactivated(() => {
  keyboardRef.value?.close()
})
</script>

<style scoped>
.search-page {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.sticky-search {
  position: static;
  flex-shrink: 0;
  margin: 0;
  padding: 0 0 12px;
}

.search-list {
  flex: 1;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  border-radius: 12px;
}

.search-list .settings-group {
  margin-top: 0;
}
</style>
