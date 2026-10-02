<template>
  <div>
    <div class="sticky-search">
      <el-input
        v-model="searchInput"
        size="large"
        placeholder="Search route number"
        :prefix-icon="Search"
        readonly
        inputmode="none"
        @focus="() => keyboardRef.open()"
      />
    </div>

    <ul class="settings-group" v-infinite-scroll="loadRoute">
      <li
        class="route-row"
        v-for="(item, index) in displayRouteList"
        :key="index"
        @click="() => goToDetails(item, item.co || 'KMB')"
      >
        <div class="flex min-w-0 gap-x-3">
          <div class="route-badge">{{ item.co || 'KMB' }}</div>
          <div class="min-w-0 flex-auto">
            <p class="route-number">
              {{ item.route }}
              <span v-if="item.service_type > 1" class="route-meta">(特別班次)</span>
            </p>
            <p class="route-meta">{{ item.orig_tc }} - {{ item.dest_tc }}</p>
          </div>
        </div>
        <button class="star-hit" type="button" aria-label="Toggle favorite" @click.stop="() => commuteStore.toggleFav(item)">
          <el-icon :size="22" color="#ffcc00">
            <StarFilled v-if="commuteStore.isFav(item)" />
            <Star v-else />
          </el-icon>
        </button>
      </li>
    </ul>

    <Keyboard ref="keyboardRef" @change="handleInput" :letter-keys="letterKeys" />
  </div>
</template>

<script lang="ts" setup>
import { Search, Star, StarFilled } from '@element-plus/icons-vue'
import { useCommuteStore } from '@/stores/commute'
import { getCompany } from '@/utils'

const keyboardRef = ref()
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
</script>
