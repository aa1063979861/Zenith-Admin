/**********************************
 * @FilePath: interceptors.js
 * @Author: Ronnie Zhang
 * @LastEditor: Ronnie Zhang
 * @LastEditTime: 2023/12/04 22:46:40
 * @Email: zclzone@outlook.com
 * Copyright 漏 2023 Ronnie Zhang(澶ц劯鎬? | https://isme.top
 **********************************/

import { useAuthStore } from '@/store'
import { resolveResError } from './helpers'

let refreshPromise

export function setupInterceptors(axiosInstance) {
  const SUCCESS_CODES = [0, 200]

  async function resResolve(response) {
    const { data, status, config, statusText, headers } = response
    if (headers['content-type']?.includes('json')) {
      if (SUCCESS_CODES.includes(data?.code)) {
        return Promise.resolve(data)
      }

      const code = data?.code ?? status
      if (code === 401 && await tryRefreshToken(axiosInstance, config))
        return axiosInstance(config)

      const needTip = config?.needTip !== false
      const message = resolveResError(code, data?.message ?? statusText, needTip, {
        authExpired: config?.needToken !== false,
      })

      return Promise.reject({ code, message, error: data ?? response })
    }
    return Promise.resolve(data ?? response)
  }

  axiosInstance.interceptors.request.use(reqResolve, reqReject)
  axiosInstance.interceptors.response.use(resResolve, error => resReject(axiosInstance, error))
}

function reqResolve(config) {
  if (config.needToken === false) {
    return config
  }

  const { accessToken } = useAuthStore()
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }

  return config
}

function reqReject(error) {
  return Promise.reject(error)
}

async function resReject(axiosInstance, error) {
  if (!error || !error.response) {
    const code = error?.code
    const message = resolveResError(code, error.message)
    return Promise.reject({ code, message, error })
  }

  const { data, status, config } = error.response
  const code = data?.code ?? status

  if (code === 401 && await tryRefreshToken(axiosInstance, config))
    return axiosInstance(config)

  const needTip = config?.needTip !== false
  const message = resolveResError(code, data?.message ?? error.message, needTip, {
    authExpired: config?.needToken !== false,
  })
  return Promise.reject({ code, message, error: error.response?.data || error.response })
}

async function tryRefreshToken(_axiosInstance, config) {
  if (config?.skipAuthRefresh || config?._retry)
    return false

  const authStore = useAuthStore()
  if (!authStore.accessToken)
    return false

  config._retry = true

  try {
    refreshPromise ||= authStore.refreshToken()
    await refreshPromise
    return true
  }
  catch {
    await authStore.clearLoginState()
    return false
  }
  finally {
    refreshPromise = null
  }
}
