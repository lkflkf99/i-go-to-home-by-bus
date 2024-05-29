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
      <el-footer class="flex justify-between footer-container">
        <el-button
          :type="getMenuBtnType('/fav')"
          :icon="Star"
          circle
          text
          @click="router.push('/fav')"
        >
        </el-button>
        <el-button
          :type="getMenuBtnType('/route')"
          :icon="Search"
          circle
          text
          @click="router.push('/route')"
        />
        <el-button
          :type="getMenuBtnType('/map')"
          :icon="Location"
          circle
          text
          @click="router.push('/map')"
        />
        <el-button
          :type="getMenuBtnType('/setting')"
          :icon="Setting"
          circle
          text
          @click="router.push('/setting')"
        />
      </el-footer>
    </el-container>
  </div>
</template>

<script lang="ts" setup>
import { useRouter, useRoute } from 'vue-router'
import { Location, Setting, Search, Star } from '@element-plus/icons-vue'
import { fetchBusData } from '@/services/BusService'

const route = useRoute()
const router = useRouter()

const goBack = () => {
  router.back()
}

const getMenuBtnType = (path: string) => {
  return route.path === path ? 'primary' : null
}

// const showBack = () => {
//   const tabPages = ['Fav', 'Bus Routes', 'Setting']
//   return !tabPages.includes(route.name)
// }

onMounted(() => {
  if (!localStorage.getItem('dbLastUpdateTime')) {
    fetchBusData()
  }
})
</script>

<style scoped>
.footer-container {
  border: 1px solid #ebeef5;
  border-radius: 16px 16px 0 0;
  padding: 16px;
}

.page-header {
  border: 1px solid #ebeef5;
}

.el-button {
  font-size: 20px;
}
</style>
