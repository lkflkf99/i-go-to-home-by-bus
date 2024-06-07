<template>
  <div class="antialiased w-screen h-screen min-h-screen duration-300 transition">
    <el-container class="h-full">
      <el-header class="flex items-center page-header">
        <el-page-header @back="goBack">
          <template #content>
            <span class="text-large font-600 mr-3">{{ route.name }}</span>
          </template>
        </el-page-header>
      </el-header>
      <el-main><RouterView /></el-main>
      <el-footer class="flex justify-around footer-container">
        <div class="footer-tab" @click="router.push('/fav')">
          <el-icon :size="24" :color="getMenuColor('/fav')">
            <Star />
          </el-icon>
        </div>

        <div class="footer-tab" @click="router.push('/route')">
          <el-icon :size="24" :color="getMenuColor('/route')">
            <Search />
          </el-icon>
        </div>

        <div class="footer-tab" @click="router.push('/plan-route')">
          <el-icon :size="24" :color="getMenuColor('/plan-route')">
            <Guide />
          </el-icon>
        </div>

        <div class="footer-tab" @click="router.push('/map')">
          <el-icon :size="24" :color="getMenuColor('/map')">
            <Location />
          </el-icon>
        </div>

        <div class="footer-tab" @click="router.push('/setting')">
          <el-icon :size="24" :color="getMenuColor('/setting')">
            <Setting />
          </el-icon>
        </div>
      </el-footer>
    </el-container>
  </div>
</template>

<script lang="ts" setup>
import { useRouter, useRoute } from 'vue-router'
import { Location, Setting, Search, Star, Guide } from '@element-plus/icons-vue'
import { fetchBusData } from '@/services/BusService'

const route = useRoute()
const router = useRouter()

const goBack = () => {
  router.back()
}

const getMenuColor = (path: string) => {
  return route.path === path ? '#409eff' : null
}

// const showBack = () => {
//   const tabPages = ['Fav', 'Bus Routes', 'Setting']
//   return !tabPages.includes(route.name)
// }

onMounted(async () => {
  if (!localStorage.getItem('dbLastUpdateTime')) {
    await fetchBusData()
  }
})
</script>

<style scoped>
.footer-container {
  border: 1px solid #ebeef5;
  border-radius: 16px 16px 0 0;
  align-items: center;
}

.page-header {
  border: 1px solid #ebeef5;
}

.footer-tab {
  display: flex;
  padding: 16px;
}
</style>
