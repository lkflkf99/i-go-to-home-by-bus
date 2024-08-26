<template>
  <ul class="divide-y divide-gray-100">
    <li class="flex justify-between gap-x-6 py-5" v-loading="isFetching" @click="handleUpdateDB">
      <div class="flex min-w-0 gap-x-4">
        <div class="min-w-0 flex-auto">
          <p class="text-sm font-semibold text-gray-900">Update Local DB</p>
          <p class="mt-1 truncate text-xs text-gray-500">
            Last Updated Time:
            {{ lastUpdateTime ? format(lastUpdateTime, 'dd-MM-yyyy HH:mm') : '-' }}
          </p>
        </div>
      </div>
    </li>
    <li class="flex justify-between gap-x-6 py-5" @click="dialog.visible = true">
      <div class="flex min-w-0 gap-x-4">
        <div class="min-w-0 flex-auto">
          <p class="text-sm font-semibold text-gray-900">Theme</p>
          <p class="mt-1 truncate text-xs text-gray-500">{{ dialog.model }}</p>
        </div>
      </div>
    </li>
  </ul>
  <el-dialog v-model="dialog.visible" :title="dialog.title" width="80%">
    <el-radio-group v-model="dialog.model">
      <el-radio value="default">Default</el-radio>
      <el-radio value="blackPink">Black Pink</el-radio>
    </el-radio-group>
    <template #footer>
      <div class="dialog-footer">
        <el-button @click="dialog.visible = false">Cancel</el-button>
        <el-button type="primary" @click="handleChangeTheme">Confirm</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import { format } from 'date-fns'
import { fetchBusData } from '@/services/BusService'
import { toggleDark, isDark } from '@/composables'

const isFetching = ref(false)
const lastUpdateTime = ref(localStorage.getItem('dbLastUpdateTime'))
const dialog = ref({
  title: 'Select Theme',
  visible: false,
  model: localStorage.getItem('theme') || 'default',
})

const handleUpdateDB = async () => {
  isFetching.value = true

  try {
    const res = await fetchBusData()
    lastUpdateTime.value = res
    isFetching.value = false
  } catch {
    isFetching.value = false
  }
}

const handleChangeTheme = () => {
  dialog.value.visible = false
  localStorage.setItem('theme', dialog.value.model)
  const root = document.getElementsByTagName('html')[0]

  if (dialog.value.model === 'blackPink' && !isDark.value) {
    root.classList.remove('default')
    toggleDark()
  } else if (dialog.value.model === 'default' && isDark.value) {
    root.classList.remove('blackPink')
    toggleDark()
  }

  root.classList.add(dialog.value.model)
}
</script>

<style scoped></style>
