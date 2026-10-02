<template>
  <el-dialog v-model="visible" :title="title" width="90%" @closed="query = ''">
    <el-input v-model="query" size="large" clearable :placeholder="placeholder" />
    <el-button class="mt-3" round plain type="primary" @click="useNearest">
      Use nearest stop
    </el-button>
    <el-button v-if="modelValue" class="mt-3" round plain @click="clearPlace">Clear</el-button>
    <ul class="mt-4 max-h-72 overflow-auto">
      <li
        class="route-row"
        v-for="stop in results"
        :key="stop.stop"
        @click="selectPlace(stop)"
      >
        <div class="min-w-0 flex-auto">
          <p class="text-sm font-semibold" style="color: var(--app-text)">{{ stop.name_tc }}</p>
          <p class="route-meta">{{ stop.name_en }}</p>
        </div>
      </li>
      <li v-if="query && !results.length" class="route-row">
        <p class="route-meta">No stops match that name</p>
      </li>
    </ul>
  </el-dialog>
</template>

<script lang="ts" setup>
import { ElMessage } from 'element-plus'
import type { SavedPlace } from '@/model'
import { getCurrentLocation } from '@/utils'
import { findNearestStop, searchStops } from '@/services/CommuteService'

const props = withDefaults(
  defineProps<{
    modelValue: SavedPlace | null
    visible: boolean
    title: string
    placeholder?: string
  }>(),
  {
    placeholder: 'Search a stop name',
  }
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: SavedPlace | null): void
  (e: 'update:visible', value: boolean): void
  (e: 'select', value: SavedPlace | null): void
}>()

const query = ref('')

const visible = computed({
  get: () => props.visible,
  set: (value: boolean) => emit('update:visible', value),
})

const results = computed(() => searchStops(query.value))

const close = () => {
  visible.value = false
}

const selectPlace = (place: SavedPlace) => {
  emit('update:modelValue', place)
  emit('select', place)
  close()
}

const clearPlace = () => {
  emit('update:modelValue', null)
  emit('select', null)
  close()
}

const useNearest = async () => {
  try {
    const location = await getCurrentLocation()
    const nearest = findNearestStop(location)
    if (!nearest) {
      ElMessage.error({ message: 'No cached stops yet. Update Local DB first.' })
      return
    }
    selectPlace(nearest)
  } catch {
    ElMessage.error({ message: 'Could not read your location' })
  }
}
</script>
