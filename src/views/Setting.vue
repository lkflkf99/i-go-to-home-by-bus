<template>
  <ul class="settings-group">
    <li class="settings-row is-control">
      <div class="min-w-0 flex-auto">
        <p class="text-sm font-semibold" style="color: var(--app-text)">{{ t('settings.location') }}</p>
        <p class="route-meta">
          {{ prefs.locationEnabled ? t('settings.locationOn') : t('settings.locationOff') }}
        </p>
      </div>
      <el-switch :model-value="prefs.locationEnabled" @change="onLocationChange" />
    </li>
    <li class="settings-row is-control">
      <div class="min-w-0 flex-auto">
        <p class="text-sm font-semibold" style="color: var(--app-text)">{{ t('settings.language') }}</p>
      </div>
      <el-radio-group :model-value="prefs.locale" size="small" @change="onLocaleChange">
        <el-radio-button value="en">{{ t('settings.langEn') }}</el-radio-button>
        <el-radio-button value="zh-HK">{{ t('settings.langZh') }}</el-radio-button>
      </el-radio-group>
    </li>
  </ul>
  <ul class="settings-group">
    <li class="settings-row" v-loading="isFetching" @click="handleUpdateDB">
      <div class="min-w-0 flex-auto">
        <p class="text-sm font-semibold" style="color: var(--app-text)">{{ t('settings.updateDb') }}</p>
        <p class="route-meta">
          {{ t('settings.lastUpdated') }}:
          {{ lastUpdateTime ? format(lastUpdateTime, 'dd MMM yyyy HH:mm', { locale: dateLocale }) : '-' }}
        </p>
      </div>
    </li>
    <li class="settings-row" @click="homePickerVisible = true">
      <div class="min-w-0 flex-auto">
        <p class="text-sm font-semibold" style="color: var(--app-text)">{{ t('settings.home') }}</p>
        <p class="route-meta">
          {{ store.homePlace ? textByLocale(store.homePlace.name_tc, store.homePlace.name_en) : t('settings.notSet') }}
        </p>
      </div>
    </li>
    <li class="settings-row" @click="workPickerVisible = true">
      <div class="min-w-0 flex-auto">
        <p class="text-sm font-semibold" style="color: var(--app-text)">{{ t('settings.work') }}</p>
        <p class="route-meta">
          {{ store.workPlace ? textByLocale(store.workPlace.name_tc, store.workPlace.name_en) : t('settings.notSet') }}
        </p>
      </div>
    </li>
    <li class="settings-row" @click="dialog.visible = true">
      <div class="min-w-0 flex-auto">
        <p class="text-sm font-semibold" style="color: var(--app-text)">{{ t('settings.theme') }}</p>
        <p class="route-meta">{{ themeLabel }}</p>
      </div>
    </li>
  </ul>
  <el-dialog v-model="dialog.visible" :title="t('settings.selectTheme')" width="90%">
    <el-radio-group v-model="dialog.model">
      <el-radio value="default">{{ t('settings.themeDefault') }}</el-radio>
      <el-radio value="blackPink">{{ t('settings.themeBlackPink') }}</el-radio>
    </el-radio-group>
    <template #footer>
      <div class="dialog-footer">
        <el-button @click="dialog.visible = false">{{ t('settings.cancel') }}</el-button>
        <el-button type="primary" @click="handleChangeTheme">{{ t('settings.confirm') }}</el-button>
      </div>
    </template>
  </el-dialog>
  <PlacePicker
    v-model:visible="homePickerVisible"
    :model-value="store.homePlace"
    :title="t('settings.setHome')"
    :placeholder="t('settings.searchStop')"
    @select="store.setHome"
  />
  <PlacePicker
    v-model:visible="workPickerVisible"
    :model-value="store.workPlace"
    :title="t('settings.setWork')"
    :placeholder="t('settings.searchStop')"
    @select="store.setWork"
  />
</template>

<script lang="ts" setup>
import { format } from 'date-fns'
import { enUS, zhHK } from 'date-fns/locale'
import { fetchBusData } from '@/services/BusService'
import { toggleDark, isDark } from '@/composables'
import { useCommuteStore } from '@/stores/commute'
import { usePrefsStore } from '@/stores/prefs'
import { textByLocale } from '@/utils'
import PlacePicker from '@/components/PlacePicker.vue'

const { t } = useI18n()
const store = useCommuteStore()
const prefs = usePrefsStore()
const isFetching = ref(false)
const lastUpdateTime = ref(localStorage.getItem('dbLastUpdateTime'))
const homePickerVisible = ref(false)
const workPickerVisible = ref(false)
const dialog = ref({
  visible: false,
  model: localStorage.getItem('theme') || 'default',
})

const dateLocale = computed(() => (prefs.locale === 'zh-HK' ? zhHK : enUS))
const themeLabel = computed(() =>
  dialog.value.model === 'blackPink' ? t('settings.themeBlackPink') : t('settings.themeDefault')
)

const onLocationChange = (value: string | number | boolean) => {
  prefs.setLocationEnabled(Boolean(value))
}

const onLocaleChange = (value: string | number | boolean) => {
  prefs.setLocale(value === 'zh-HK' ? 'zh-HK' : 'en')
}

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
