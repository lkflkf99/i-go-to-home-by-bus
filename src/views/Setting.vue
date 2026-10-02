<template>
  <ul class="settings-group">
    <li class="settings-row" v-loading="isFetching" @click="handleUpdateDB">
      <div class="min-w-0 flex-auto">
        <p class="text-sm font-semibold" style="color: var(--app-text)">Update Local DB</p>
        <p class="route-meta">
          Last updated:
          {{ lastUpdateTime ? format(lastUpdateTime, 'dd MMM yyyy HH:mm') : '-' }}
        </p>
      </div>
    </li>
    <li class="settings-row" @click="homePickerVisible = true">
      <div class="min-w-0 flex-auto">
        <p class="text-sm font-semibold" style="color: var(--app-text)">Home</p>
        <p class="route-meta">{{ store.homePlace ? store.homePlace.name_tc : 'Not set' }}</p>
      </div>
    </li>
    <li class="settings-row" @click="workPickerVisible = true">
      <div class="min-w-0 flex-auto">
        <p class="text-sm font-semibold" style="color: var(--app-text)">Work</p>
        <p class="route-meta">{{ store.workPlace ? store.workPlace.name_tc : 'Not set' }}</p>
      </div>
    </li>
    <li class="settings-row" @click="dialog.visible = true">
      <div class="min-w-0 flex-auto">
        <p class="text-sm font-semibold" style="color: var(--app-text)">Theme</p>
        <p class="route-meta">{{ dialog.model }}</p>
      </div>
    </li>
  </ul>
  <el-dialog v-model="dialog.visible" :title="dialog.title" width="90%">
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
  <PlacePicker
    v-model:visible="homePickerVisible"
    :model-value="store.homePlace"
    title="Set home stop"
    placeholder="Search a stop name"
    @select="store.setHome"
  />
  <PlacePicker
    v-model:visible="workPickerVisible"
    :model-value="store.workPlace"
    title="Set work stop"
    placeholder="Search a stop name"
    @select="store.setWork"
  />
</template>

<script lang="ts" setup>
import { format } from 'date-fns'
import { fetchBusData } from '@/services/BusService'
import { toggleDark, isDark } from '@/composables'
import { useCommuteStore } from '@/stores/commute'
import PlacePicker from '@/components/PlacePicker.vue'

const store = useCommuteStore()
const isFetching = ref(false)
const lastUpdateTime = ref(localStorage.getItem('dbLastUpdateTime'))
const homePickerVisible = ref(false)
const workPickerVisible = ref(false)
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
