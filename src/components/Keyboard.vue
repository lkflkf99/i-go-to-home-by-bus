<template>
  <el-drawer v-model="isOpen" direction="btt" :with-header="false">
    <div class="keyboard-container">
      <div class="num-panel">
        <el-button v-for="key in numKey" v-bind:key="key" @click="handleClick(key)">
          {{ keyLabel(key) }}
        </el-button>
      </div>
      <div class="letter-panel">
        <el-button v-for="key in getLetterKeys()" v-bind:key="key" @click="handleClick(key)">
          {{ key }}
        </el-button>
      </div>
    </div>
  </el-drawer>
</template>

<script lang="ts" setup>
const props = defineProps({
  letterKeys: {
    type: Array,
    default: () => {
      return []
    },
  },
})

const { t } = useI18n()
const isOpen = ref(false)
const emit = defineEmits(['change'])
const numKey = [1, 2, 3, 4, 5, 6, 7, 8, 9, 'reset', 0, 'back']

const keyLabel = (key: string | number) => {
  if (key === 'reset') {
    return t('keyboard.reset')
  }
  if (key === 'back') {
    return t('keyboard.back')
  }
  return key
}
const defaultLetterKeys = [
  'A',
  'B',
  'C',
  'D',
  'E',
  'H',
  'I',
  'K',
  'M',
  'N',
  'P',
  'R',
  'S',
  'T',
  'W',
  'X',
]

const getLetterKeys = () => {
  return props.letterKeys.length ? props.letterKeys : defaultLetterKeys
}

const handleClick = (val) => {
  emit('change', val)
}

const open = () => {
  isOpen.value = true
}

defineExpose({
  open,
})
</script>

<style scoped>
.keyboard-container {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding-bottom: env(safe-area-inset-bottom, 8px);
}

.num-panel {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  flex: 0.62;
  gap: 6px;
}

.letter-panel {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  flex: 0.38;
  gap: 6px;
  max-height: 220px;
  overflow-y: auto;
}

.num-panel :deep(.el-button),
.letter-panel :deep(.el-button) {
  margin: 0;
  height: 48px;
  font-size: 18px;
  font-weight: 600;
  border-radius: 10px;
}
</style>
