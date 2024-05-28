<template>
  <div class="antialiased w-screen h-screen min-h-screen duration-300 transition">
    <el-container class="h-full">
      <el-header class="flex items-center">
        <el-page-header @back="goBack">
          <template #content>
            <span class="text-large font-600 mr-3">{{ route.name }}</span>
          </template>
        </el-page-header>
      </el-header>
      <el-main><RouterView /></el-main>
      <el-footer class="flex justify-between footer-container">
        <el-button type="primary" :icon="Star" circle @click="router.push('/fav')" />
        <el-button type="primary" :icon="Search" circle @click="router.push('/search')" />
        <el-button type="primary" :icon="Location" circle @click="router.push('/location')" />
        <el-button type="primary" :icon="Setting" circle @click="router.push('/setting')" />
      </el-footer>
    </el-container>
  </div>
</template>

<script lang="ts" setup>
import { useRouter, useRoute } from 'vue-router'
import { Location, Setting, Search, Star } from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()

const goBack = () => {
  console.log('go back')
}
</script>

<style scoped>
.footer-container {
  border: 1px solid #ebeef5;
  border-radius: 16px 16px 0 0;
  padding: 16px;
}

.page-header {
  padding: 24px 0;
}
</style>
