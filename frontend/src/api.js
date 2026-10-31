const TOKEN_KEY = 'brightloop.access-token'

export class ApiError extends Error {
  constructor(message, status = 0) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export function errorMessage(detail) {
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) return detail.map(error => {
    const field = (error.loc || []).filter(part => part !== 'body').join(' · ')
    return `${field ? `${field}: ` : ''}${error.msg || 'Invalid value'}`
  }).join('; ')
  return 'The request could not be completed.'
}

export function createClient({ baseURL = import.meta.env?.VITE_API_URL || '/api/v1',
  storage = globalThis.sessionStorage, fetcher = globalThis.fetch, onUnauthorized = () => {} } = {}) {
  let token = storage?.getItem(TOKEN_KEY) || null
  const setToken = value => {
    token = value
    if (value) storage?.setItem(TOKEN_KEY, value)
    else storage?.removeItem(TOKEN_KEY)
  }
  async function request(path, { method = 'GET', body, signal, blob = false, authenticated = true } = {}) {
    const headers = { Accept: blob ? 'application/pdf' : 'application/json' }
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    if (authenticated && token) headers.Authorization = `Bearer ${token}`
    let response
    try {
      const timeout = AbortSignal.timeout(30000)
      response = await fetcher(`${baseURL.replace(/\/$/, '')}${path}`, {
        method, headers, signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      })
    } catch (error) {
      if (signal?.aborted) throw error
      throw new ApiError(error.name === 'TimeoutError' ? 'The request timed out. Please try again.'
        : 'Cannot reach the server. Check that the backend is running and try again.')
    }
    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      if (response.status === 401 && authenticated) {
        setToken(null)
        onUnauthorized()
      }
      throw new ApiError(errorMessage(data.detail), response.status)
    }
    if (blob) return response.blob()
    if (response.status === 204) return null
    return response.json()
  }
  return {
    request, setToken,
    hasToken: () => Boolean(token),
    logout: () => setToken(null),
    async login(email, password) {
      const result = await request('/auth/login', { method: 'POST', body: { email, password }, authenticated: false })
      setToken(result.access_token)
      try { return await request('/auth/me') }
      catch (error) { setToken(null); throw error }
    },
    async all(path, signal) {
      const records = []
      let offset = 0
      while (true) {
        const result = await request(`${path}${path.includes('?') ? '&' : '?'}offset=${offset}&limit=100`, { signal })
        records.push(...result.items)
        offset += result.items.length
        if (offset >= result.total || result.items.length === 0) return records
      }
    },
  }
}
