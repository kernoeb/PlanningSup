import config from '@api/config'
import { defaultLogger as logger } from '@api/utils/logger'

const USER_AGENT = 'Mozilla/5.0'

function truncate(value: string, max: number) {
  if (value.length <= max) return value
  return `${value.slice(0, max - 1)}…`
}

function normalizeFetchError(error: Error | string): { name: string, message: string, code: string | null } {
  if (typeof error === 'string') return { name: 'Error', message: error, code: null }

  const { code: rawCode } = error as Error & { code?: unknown }
  const code = typeof rawCode === 'string' ? rawCode : null

  return { name: error.name, message: error.message, code }
}

async function fetchWithTimeout(
  url: string,
  options?: BunFetchRequestInit,
  timeoutOverride?: number,
): Promise<{
  data: string | null
  ok: boolean
  headers?: Headers
  status: number
  error?: { name: string, message: string, code: string | null }
}> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(timeoutOverride || config.curlTimeout),
      headers: {
        'User-Agent': USER_AGENT,
      },
      tls: {
        rejectUnauthorized: false,
      },
      ...options,
    })

    const result = {
      data: await response.text(),
      ok: response.ok,
      headers: response.headers,
      status: response.status,
    }

    return result
  } catch (e) {
    const { name, message, code } = normalizeFetchError(e instanceof Error ? e : String(e))
    logger.warn('fetchWithTimeout failed (name={name}, code={code}): {message} url={url}', {
      name,
      code,
      message: truncate(message, 180),
      url,
    })
    return {
      data: null,
      ok: false,
      headers: new Headers(),
      status: 0,
      error: { name, message, code },
    }
  }
}

export { fetchWithTimeout }
