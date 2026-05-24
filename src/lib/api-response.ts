export interface ApiEnvelope<T> {
  code?: number
  message?: string
  data?: T
}

export function isApiSuccess(response: unknown): boolean {
  const body = getResponseBody(response)
  return body?.code === 200
}

export function getApiData<T>(response: unknown, fallback: T): T {
  const body = getResponseBody<T>(response)
  return body?.code === 200 && body.data !== undefined ? body.data : fallback
}

export function getApiMessage(response: unknown, fallback: string): string {
  const body = getResponseBody(response)
  return body?.message || fallback
}

function getResponseBody<T>(response: unknown): ApiEnvelope<T> | null {
  if (!response || typeof response !== 'object') return null
  const data = (response as { data?: unknown }).data
  if (!data || typeof data !== 'object') return null
  return data as ApiEnvelope<T>
}
