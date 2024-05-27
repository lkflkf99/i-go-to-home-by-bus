<template>
  <div class="antialiased w-screen h-screen min-h-screen duration-300 transition">
    <el-container class="h-full">
      <el-header>Header</el-header>
      <el-main><RouterView /></el-main>
      <el-footer class="flex justify-between footer-container">
        <el-button type="warning" :icon="Star" circle />
        <el-button type="primary" :icon="Search" circle />
        <el-button type="success" :icon="Location" circle />
        <el-button type="danger" :icon="Setting" circle />
      </el-footer>
    </el-container>
  </div>
</template>

<script lang="ts" setup>
import { Location, Setting, Search, Star } from '@element-plus/icons-vue'
</script>

<style scoped>
.footer-container {
  border: 1px solid #ebeef5;
  border-radius: 16px 16px 0 0;
  padding: 16px;
}
</style>
