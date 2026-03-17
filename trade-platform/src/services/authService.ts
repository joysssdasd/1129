import { User } from '@/types'

interface AuthApiEnvelope<T> {
  success: boolean
  data?: T
  error?: {
    code?: string
    message?: string
  }
}

interface AuthResult {
  user: User
  message: string
}

const parseJsonResponse = async <T>(response: Response) => {
  const payload = (await response.json().catch(() => null)) as AuthApiEnvelope<T> | null

  if (!response.ok || !payload?.success || payload.data === undefined) {
    throw new Error(payload?.error?.message || '请求失败')
  }

  return payload.data
}

const postJson = async <T>(url: string, body: Record<string, unknown>) => {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  return parseJsonResponse<T>(response)
}

export const registerWithPassword = async (payload: {
  phone: string
  password: string
  wechat_id: string
  invite_code?: string
}) => postJson<AuthResult>('/api/auth/register-with-password', payload)

export const loginWithPassword = async (payload: { phone: string; password: string }) =>
  postJson<AuthResult>('/api/auth/login-with-password', payload)
