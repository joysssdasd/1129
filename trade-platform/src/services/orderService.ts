import type { RealOrder, RealOrderFormValues } from '@/types/orders'

interface OrdersApiEnvelope<T> {
  success: boolean
  data?: T
  error?: {
    code?: string
    message?: string
  }
}

const toNullableString = (value: string) => {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

const toNullableNumber = (value: string) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const toPayload = (userId: string, values: RealOrderFormValues) => ({
  created_by_user_id: userId,
  source_type: values.source_type,
  source_post_id:
    values.source_type === 'platform_post' ? values.source_post_id || null : null,
  my_side: values.my_side,
  counterparty_name: toNullableString(values.counterparty_name),
  counterparty_contact: toNullableString(values.counterparty_contact),
  subject_title: values.subject_title.trim(),
  category_name: toNullableString(values.category_name),
  trade_type_label: toNullableString(values.trade_type_label),
  quantity: toNullableNumber(values.quantity),
  unit_price: toNullableNumber(values.unit_price),
  total_amount: Number(values.total_amount),
  deal_at: new Date(values.deal_at).toISOString(),
  delivery_method: toNullableString(values.delivery_method),
  payment_method: toNullableString(values.payment_method),
  status: values.status,
  notes: toNullableString(values.notes),
  subject_snapshot: values.subject_snapshot || null,
})

const parseJsonResponse = async <T>(response: Response) => {
  const payload = (await response.json().catch(() => null)) as OrdersApiEnvelope<T> | null

  if (!response.ok || !payload?.success || payload.data === undefined) {
    throw new Error(payload?.error?.message || '订单请求失败')
  }

  return payload.data
}

export const orderService = {
  async listOrders(userId: string) {
    const response = await fetch(`/api/orders?user_id=${encodeURIComponent(userId)}`)
    const data = await parseJsonResponse<RealOrder[]>(response)
    return data || []
  },

  async createOrder(userId: string, values: RealOrderFormValues) {
    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId,
        order: toPayload(userId, values),
      }),
    })

    return parseJsonResponse<RealOrder>(response)
  },

  async updateOrder(userId: string, orderId: string, values: RealOrderFormValues) {
    const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId,
        order: toPayload(userId, values),
      }),
    })

    return parseJsonResponse<RealOrder>(response)
  },
}
