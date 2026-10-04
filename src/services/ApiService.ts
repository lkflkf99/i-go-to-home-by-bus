import axios, { type AxiosError, type AxiosRequestConfig } from 'axios'
import { ElMessage } from 'element-plus'
import NProgress from 'nprogress'

interface RetryRequestConfig extends AxiosRequestConfig {
  _retry?: boolean
}

const RETRY_STATUSES = new Set([403, 408, 429, 502, 503])

const instance = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    Accept: 'application/json',
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
  async (err: AxiosError) => {
    const config = err.config as RetryRequestConfig | undefined
    const status = err.response?.status
    if (config && status && RETRY_STATUSES.has(status) && !config._retry) {
      config._retry = true
      await new Promise((resolve) => setTimeout(resolve, 400))
      return instance(config)
    }

    NProgress.done()
    const payload = err.response?.data as { message?: string } | string | undefined
    const message =
      (typeof payload === 'object' && payload?.message) ||
      (status ? `API error (${status})` : 'API error')
    ElMessage.error({ message })
    return Promise.reject(err)
  }
)

export default instance
