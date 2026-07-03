import axios from 'axios'

export const authRequest = axios.create({
  baseURL: import.meta.env.VITE_AXIOS_BASE_URL,
  timeout: 12000,
  withCredentials: true,
})
