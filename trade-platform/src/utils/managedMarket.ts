export const LEGACY_MANAGED_MARKET_PREFIX = '自动整理自微信群行情'
export const INTERNAL_MANAGED_MARKET_PREFIX = '__managed_market__'

export const isManagedMarketExtraInfo = (value?: string | null) => {
  const text = String(value || '').trim()
  if (!text) return false

  return (
    text.startsWith(INTERNAL_MANAGED_MARKET_PREFIX) ||
    text.startsWith(LEGACY_MANAGED_MARKET_PREFIX)
  )
}

export const getPublicExtraInfo = (value?: string | null) => {
  const text = String(value || '').trim()
  if (!text || isManagedMarketExtraInfo(text)) {
    return ''
  }

  return text
}
