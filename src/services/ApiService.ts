import axios from 'axios'
import { ElMessage } from 'element-plus'
import NProgress from 'nprogress'

const instance = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Access-Control-Allow-Origin': '*',
  },
})

instance.interceptors.request.use((config) => {
  NProgress.start()
  return config
})

instance.interceptors.response.use(
  (response) => {
    NProgress.done()
    return response
  },
  (err) => {
    NProgress.done()
    ElMessage.error({ message: err.response?.data.message || 'API error' })
    return Promise.reject(err)
  }
)

export default instance
