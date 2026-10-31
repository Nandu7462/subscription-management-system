export async function apiReady(url, fetcher = globalThis.fetch) {
  try {
    const response = await fetcher(url, { signal: AbortSignal.timeout(1500) })
    if (!response.ok) return false
    const data = await response.json()
    return data.status === 'ready'
  } catch { return false }
}
