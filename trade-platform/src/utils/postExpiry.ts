export const POST_VALIDITY_DAYS = 3
export const POST_VALIDITY_MS = POST_VALIDITY_DAYS * 24 * 60 * 60 * 1000

type PostExpiryFields = {
  status?: number | string | null
  expire_at?: string | null
  created_at?: string | null
}

export const getActivePostCutoffIso = (now = Date.now()) =>
  new Date(now - POST_VALIDITY_MS).toISOString()

export const isPostCurrentlyActive = (post: PostExpiryFields, now = Date.now()) => {
  const numericStatus = Number(post.status)
  if (Number.isFinite(numericStatus) && numericStatus !== 1) return false

  const expireMs = post.expire_at ? new Date(post.expire_at).getTime() : NaN
  if (Number.isFinite(expireMs) && expireMs <= now) return false

  const createdMs = post.created_at ? new Date(post.created_at).getTime() : NaN
  if (Number.isFinite(createdMs) && now - createdMs >= POST_VALIDITY_MS) return false

  return true
}
