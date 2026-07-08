export type ApiConfig = {
  baseUrl: string
}

type RuntimeConfig = {
  api?: Partial<ApiConfig>
}

let apiConfig: ApiConfig | null = null

function configured(...values: Array<string | undefined>): string | undefined {
  return values.find((value) => value?.trim())?.trim()
}

function apiBaseUrl(value: string | undefined): string {
  const candidate = value?.trim()
  if (!candidate) {
    return '/api/v1'
  }

  if (candidate.startsWith('/')) {
    return candidate.replace(/\/+$/, '')
  }

  try {
    const url = new URL(candidate)
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      throw new Error()
    }
    return candidate.replace(/\/+$/, '')
  } catch {
    throw new Error(
      'Invalid API configuration: baseUrl must be a relative path or absolute HTTP(S) URL',
    )
  }
}

export async function loadRuntimeConfig(): Promise<void> {
  if (apiConfig) {
    return
  }

  let runtimeConfig: RuntimeConfig = {}
  try {
    const response = await fetch('/config.json', { cache: 'no-store' })
    if (response.ok) {
      runtimeConfig = (await response.json()) as RuntimeConfig
    }
  } catch {
    // Vite environment values remain available as a local-development fallback.
  }

  apiConfig = {
    baseUrl: apiBaseUrl(configured(runtimeConfig.api?.baseUrl, import.meta.env.VITE_API_BASE_URL)),
  }
}

export function getApiConfig(): ApiConfig {
  if (!apiConfig) {
    throw new Error('Runtime configuration has not been loaded')
  }
  return apiConfig
}
