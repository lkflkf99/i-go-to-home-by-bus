import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { i18n } from '@/modules/i18n'
import ElementPlus from 'element-plus'

import App from './App.vue'
import router from './router'

// css
import './assets/css/ress.css'
import './assets/css/vendor.css'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import './assets/sass/app.scss'

const app = createApp(App)

app.use(i18n)
app.use(createPinia())
app.use(router)
app.use(ElementPlus)

app.mount('#app')
