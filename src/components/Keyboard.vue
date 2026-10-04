<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      ref="rootRef"
      class="app-keyboard"
      role="group"
      :aria-label="t('search.placeholder')"
    >
      <div class="app-keyboard-bar">
        <button class="app-keyboard-done" type="button" @click="close">{{ t('keyboard.done') }}</button>
      </div>
      <div class="keyboard-container">
        <div class="num-panel">
          <button
            v-for="key in numKey"
            :key="String(key)"
            class="key-btn"
            :class="{ 'is-action': key === 'reset' || key === 'back' }"
            type="button"
            @click="handleClick(key)"
          >
            {{ keyLabel(key) }}
          </button>
        </div>
        <div class="letter-panel">
          <button
            v-for="key in letterKeysShown"
            :key="String(key)"
            class="key-btn"
            type="button"
            @click="handleClick(key)"
          >
            {{ key }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script lang="ts" setup>
const props = defineProps({
  letterKeys: {
    type: Array,
    default: () => [],
  },
})

const { t } = useI18n()
const isOpen = ref(false)
const rootRef = ref<HTMLElement | null>(null)
const emit = defineEmits(['change'])
const numKey = [1, 2, 3, 4, 5, 6, 7, 8, 9, 'reset', 0, 'back']

const defaultLetterKeys = ['A', 'B', 'C', 'D', 'E', 'H', 'I', 'K', 'M', 'N', 'P', 'R', 'S', 'T', 'W', 'X']

const letterKeysShown = computed(() => {
  return props.letterKeys.length ? props.letterKeys : defaultLetterKeys
})

const keyLabel = (key: string | number) => {
  if (key === 'reset') {
    return t('keyboard.reset')
  }
  if (key === 'back') {
    return t('keyboard.back')
  }
  return key
}

const syncOpenClass = async (open: boolean) => {
  document.documentElement.classList.toggle('is-app-keyboard', open)
  await nextTick()
  if (open && rootRef.value) {
    document.documentElement.style.setProperty('--app-keyboard-height', `${rootRef.value.offsetHeight}px`)
  }
}

const handleClick = (val: string | number) => {
  emit('change', val)
}

const open = () => {
  isOpen.value = true
}

const close = () => {
  isOpen.value = false
}

watch(isOpen, syncOpenClass)

onDeactivated(() => {
  close()
})

onUnmounted(() => {
  syncOpenClass(false)
})

defineExpose({
  open,
  close,
})
</script>

<style scoped>
.app-keyboard {
  --key-h: 46px;
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 40;
  background: var(--search-field);
  backdrop-filter: saturate(180%) blur(20px);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
  border-top: 0.5px solid var(--app-separator);
  padding: 6px 10px calc(8px + env(safe-area-inset-bottom, 0px));
  padding-left: max(10px, env(safe-area-inset-left, 0px));
  padding-right: max(10px, env(safe-area-inset-right, 0px));
}

.app-keyboard-bar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 6px;
}

.app-keyboard-done {
  min-height: 32px;
  padding: 0 10px;
  border: 0;
  background: transparent;
  color: var(--el-color-primary);
  font-size: 16px;
  font-weight: 600;
}

.keyboard-container {
  display: flex;
  align-items: stretch;
  gap: 8px;
}

.num-panel,
.letter-panel {
  display: grid;
  gap: 6px;
}

.num-panel {
  flex: 1.6;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.letter-panel {
  flex: 1;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  max-height: calc(4 * var(--key-h) + 18px);
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.key-btn {
  height: var(--key-h);
  width: 100%;
  min-width: 0;
  margin: 0;
  border: 0;
  border-radius: 10px;
  background: var(--app-surface);
  box-shadow: 0 1px 0 var(--app-separator);
  color: var(--app-text);
  font-size: 18px;
  font-weight: 600;
  line-height: 1;
  -webkit-tap-highlight-color: transparent;
}

.key-btn.is-action {
  font-size: 13px;
  color: var(--el-color-primary);
}

.key-btn:active {
  background: var(--row-active);
}

@media (max-height: 700px) {
  .app-keyboard {
    --key-h: 42px;
  }

  .key-btn {
    font-size: 16px;
  }
}
</style>
