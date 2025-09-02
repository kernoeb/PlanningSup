import { defaultLogger as logger } from '@api/utils/logger'

const USER_AGENT = 'Mozilla/5.0'

const TIMEOUT = (() => {
  const env = Bun.env.CURL_TIMEOUT
  if (env) {
    const parsed = Number.parseInt(env)
    if (!Number.isNaN(parsed)) return parsed
  }
  return 5000 // 5 seconds
})()

async function fetchWithTimeout(
  url: string,
  options?: BunFetchRequestInit,
  timeoutOverride?: number,
): Promise<{
  data: string | null
  ok: boolean
  headers?: Headers
  status: number
}> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(timeoutOverride || TIMEOUT),
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
    logger.warn('fetchWithTimeout error {*}', { url, error: e })
    return {
      data: null,
      ok: false,
      headers: new Headers(),
      status: 0,
    }
  }
}

export { fetchWithTimeout }
