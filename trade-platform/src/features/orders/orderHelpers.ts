import type {
  OrderSide,
  OrderSourceType,
  OrderStatus,
  RealOrder,
  RealOrderFormValues,
} from '@/types/orders'
import { getPublicExtraInfo } from '@/utils/managedMarket'

const ORDER_DRAFT_STORAGE_KEY = 'pending_order_draft'

export const ORDER_SOURCE_LABELS: Record<OrderSourceType, string> = {
  platform_post: '平台帖子',
  manual: '手动录入',
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  draft: '草稿',
  completed: '已成交',
  cancelled: '已取消',
}

export const ORDER_SIDE_LABELS: Record<OrderSide, string> = {
  buy: '我是买方',
  sell: '我是卖方',
  other: '其他',
}

export const ORDER_STATUS_STYLES: Record<OrderStatus, string> = {
  draft: 'bg-amber-100 text-amber-700',
  completed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-gray-200 text-gray-600',
}

export const ORDER_SOURCE_STYLES: Record<OrderSourceType, string> = {
  platform_post: 'bg-blue-100 text-blue-700',
  manual: 'bg-purple-100 text-purple-700',
}

export const DELIVERY_METHOD_OPTIONS = [
  '当面交割',
  '线上转让',
  '电子凭证',
  '快递/物流',
  '分批交割',
]

export const PAYMENT_METHOD_OPTIONS = [
  '微信',
  '支付宝',
  '银行卡',
  '现金',
  '其他',
]

const tradeTypeLabelMap: Record<string, string> = {
  '1': '求购',
  '2': '出售',
  '3': '做多',
  '4': '做空',
  transfer: '转让',
  request: '求购',
}

const normalizeNumber = (value: unknown) => {
  if (value === null || value === undefined || value === '') return ''
  const parsed = Number(value)
  return Number.isFinite(parsed) ? String(parsed) : ''
}

const inferOrderSide = (tradeType: unknown, isOwner = false): OrderSide => {
  const normalized = String(tradeType ?? '')
  if (normalized === '1' || normalized === 'request') {
    return isOwner ? 'buy' : 'sell'
  }
  if (normalized === '2' || normalized === 'transfer') {
    return isOwner ? 'sell' : 'buy'
  }
  return 'other'
}

const getTradeTypeLabel = (tradeType: unknown) => {
  return tradeTypeLabelMap[String(tradeType ?? '')] || '未知'
}

const getMaskedCounterpartyName = (postUser?: any) => {
  if (postUser?.phone) {
    return `平台用户 ${String(postUser.phone).slice(-4)}`
  }
  return '平台交易对象'
}

export const createEmptyOrderDraft = (): RealOrderFormValues => ({
  source_type: 'manual',
  source_post_id: null,
  my_side: 'other',
  counterparty_name: '',
  counterparty_contact: '',
  subject_title: '',
  category_name: '',
  trade_type_label: '',
  quantity: '1',
  unit_price: '',
  total_amount: '',
  deal_at: new Date().toISOString(),
  delivery_method: '',
  payment_method: '',
  status: 'draft',
  notes: '',
  subject_snapshot: null,
})

export const buildOrderDraftFromPost = ({
  post,
  postUser,
  contact,
  isOwner = false,
  categoryName,
}: {
  post: any
  postUser?: any
  contact?: string
  isOwner?: boolean
  categoryName?: string
}): RealOrderFormValues => {
  const price = Number(post?.price ?? 0)
  const publicExtraInfo = getPublicExtraInfo(post?.extra_info)

  return {
    source_type: 'platform_post',
    source_post_id: post?.id || null,
    my_side: inferOrderSide(post?.trade_type, isOwner),
    counterparty_name: getMaskedCounterpartyName(postUser),
    counterparty_contact: contact || postUser?.wechat_id || '',
    subject_title: post?.title || '',
    category_name: categoryName || post?.category_name || '',
    trade_type_label: getTradeTypeLabel(post?.trade_type),
    quantity: '1',
    unit_price: price > 0 ? String(price) : '',
    total_amount: price > 0 ? String(price) : '',
    deal_at: new Date().toISOString(),
    delivery_method: post?.delivery_days ? `${post.delivery_days}天交割` : '',
    payment_method: '',
    status: 'draft',
    notes: publicExtraInfo,
    subject_snapshot: {
      id: post?.id || null,
      title: post?.title || '',
      price: post?.price || null,
      keywords: post?.keywords || '',
      trade_type: post?.trade_type || null,
      category_id: post?.category_id || null,
      category_name: categoryName || post?.category_name || '',
      delivery_days: post?.delivery_days || null,
      extra_info: publicExtraInfo,
      created_at: post?.created_at || null,
    },
  }
}

export const createOrderFormValues = (
  values?: Partial<RealOrderFormValues> | RealOrder | null
) => {
  const defaults = createEmptyOrderDraft()

  if (!values) return defaults

  return {
    ...defaults,
    ...values,
    quantity: normalizeNumber((values as any).quantity),
    unit_price: normalizeNumber((values as any).unit_price),
    total_amount: normalizeNumber((values as any).total_amount),
    deal_at: (values as any).deal_at || defaults.deal_at,
    source_post_id: (values as any).source_post_id || null,
    subject_snapshot: (values as any).subject_snapshot || null,
  }
}

export const savePendingOrderDraft = (draft: RealOrderFormValues) => {
  if (typeof window === 'undefined') return
  window.sessionStorage.setItem(ORDER_DRAFT_STORAGE_KEY, JSON.stringify(draft))
}

export const consumePendingOrderDraft = () => {
  if (typeof window === 'undefined') return null

  const raw = window.sessionStorage.getItem(ORDER_DRAFT_STORAGE_KEY)
  if (!raw) return null

  window.sessionStorage.removeItem(ORDER_DRAFT_STORAGE_KEY)

  try {
    return createOrderFormValues(JSON.parse(raw))
  } catch {
    return null
  }
}

export const formatCurrency = (value?: number | null) => {
  if (!value) return '0'
  return new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export const formatDateTime = (value?: string | null) => {
  if (!value) return '--'
  return new Date(value).toLocaleString()
}

export const toDateTimeInputValue = (value?: string | null) => {
  const date = value ? new Date(value) : new Date()
  const pad = (input: number) => String(input).padStart(2, '0')

  const year = date.getFullYear()
  const month = pad(date.getMonth() + 1)
  const day = pad(date.getDate())
  const hours = pad(date.getHours())
  const minutes = pad(date.getMinutes())

  return `${year}-${month}-${day}T${hours}:${minutes}`
}

export const calculateTotalAmount = (quantity: string, unitPrice: string) => {
  const quantityNumber = Number(quantity)
  const unitPriceNumber = Number(unitPrice)

  if (!Number.isFinite(quantityNumber) || !Number.isFinite(unitPriceNumber)) {
    return ''
  }

  return String(Number((quantityNumber * unitPriceNumber).toFixed(2)))
}
