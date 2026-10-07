import axios, { type AxiosError, type AxiosRequestConfig } from 'axios'
import { ElMessage } from 'element-plus'
import NProgress from 'nprogress'

interface RetryRequestConfig extends AxiosRequestConfig {
  _retry?: boolean
}

const RETRY_STATUSES = new Set([403, 408, 429, 502, 503])

const UPSTREAMS: Array<[prefix: string, origin: string]> = [
  ['/kmb', 'https://data.etabus.gov.hk/v1/transport/kmb'],
  ['/ctb', 'https://rt.data.gov.hk/v1/transport/citybus-nwfb'],
  ['/batch', 'https://rt.data.gov.hk/v1/transport/batch'],
]

const toUpstreamUrl = (url: string) => {
  for (const [prefix, origin] of UPSTREAMS) {
    if (url === prefix || url.startsWith(`${prefix}/`)) {
      return origin + url.slice(prefix.length)
    }
  }
  return null
}

const instance = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    Accept: 'application/json',
  },
})

instance.interceptors.request.use((config) => {
  NProgress.start()
  if (!import.meta.env.DEV && config.url) {
    const upstream = toUpstreamUrl(config.url)
    if (upstream) {
      config.url = upstream
      config.baseURL = undefined
    }
  }
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
