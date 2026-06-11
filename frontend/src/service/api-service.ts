import axios, { AxiosError, type AxiosInstance } from 'axios'
import { getApiConfig } from '@/auth/config'
import { getAppUser, removeLocalUser } from '@/auth/oidc'

export type ApiErrorBody = {
  detail?: string
  error?: string
  message?: string
  title?: string
}

export class APIService {
  private client: AxiosInstance | null = null

  public initialize(): void {
    if (this.client) {
      return
    }
    this.client = axios.create({
      baseURL: getApiConfig().baseUrl,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    this.client.interceptors.request.use(async (config) => {
      const user = await getAppUser()
      if (user) {
        config.headers.Authorization = `Bearer ${user.accessToken}`
      }
      return config
    })

    this.client.interceptors.response.use(undefined, async (error: AxiosError) => {
      if (error.response?.status === 401) {
        await removeLocalUser()
      }
      return Promise.reject(error)
    })
  }

  public getAxiosInstance(): AxiosInstance {
    if (!this.client) {
      throw new Error('API service has not been initialized')
    }
    return this.client
  }
}

export function getApiErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    const body = error.response?.data as ApiErrorBody | undefined
    return (
      body?.detail || body?.message || body?.title || `Request failed (${error.response?.status})`
    )
  }
  return error instanceof Error ? error.message : 'An unexpected error occurred'
}

const apiService = new APIService()

export default apiService
