import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'
import { App } from 'antd'

// 获取message实例的函数
let messageInstance: any = null
export const setMessageInstance = (instance: any) => {
  messageInstance = instance
}

// 显示错误消息的安全方法
const showError = (message: string) => {
  if (messageInstance && typeof messageInstance.error === 'function') {
    messageInstance.error(message)
  } else if (messageInstance && typeof messageInstance === 'function') {
    messageInstance.error(message)
  } else {
    console.error('Message error:', message)
  }
}

// 创建 axios 实例
const request: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// 请求拦截器
request.interceptors.request.use(
  (config) => {
    // 从 localStorage 获取 token
    const token = localStorage.getItem('admin_token')
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }

    // 如果是 FormData，删除 Content-Type，让浏览器自动设置（包含 boundary）
    if (config.data instanceof FormData && config.headers) {
      delete config.headers['Content-Type'];
    }

    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 响应拦截器
request.interceptors.response.use(
  (response: AxiosResponse) => {
    const { data } = response

    // 如果响应包含 success 字段且为 false，则显示错误信息
    if (data.success === false) {
      showError(data.message || '请求失败')
      return Promise.reject(new Error(data.message || '请求失败'))
    }

    return response
  },
  (error) => {
    // 处理网络错误和服务器错误
    if (error.response) {
      const { status, data } = error.response

      switch (status) {
        case 401:
          // 未授权，清除 token 并跳转到登录页
          localStorage.removeItem('admin_token')
          localStorage.removeItem('admin_user')
          window.location.href = '/login'
          break
        case 403:
          showError('权限不足')
          break
        case 404:
          showError('请求的资源不存在')
          break
        case 500:
          showError(data?.message || '服务器内部错误')
          break
        default:
          showError(data?.message || '请求失败')
      }
    } else if (error.request) {
      showError('网络错误，请检查网络连接')
    } else {
      showError('请求配置错误')
    }

    return Promise.reject(error)
  }
)

export default request