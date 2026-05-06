export type OrderSourceType = 'platform_post' | 'manual'

export type OrderStatus = 'draft' | 'completed' | 'cancelled'

export type OrderSide = 'buy' | 'sell' | 'other'

export interface RealOrder {
  id: string
  created_by_user_id: string
  source_type: OrderSourceType
  source_post_id?: string | null
  my_side: OrderSide
  counterparty_name?: string | null
  counterparty_contact?: string | null
  subject_title: string
  category_name?: string | null
  trade_type_label?: string | null
  quantity?: number | null
  unit_price?: number | null
  total_amount: number
  deal_at: string
  delivery_method?: string | null
  payment_method?: string | null
  status: OrderStatus
  notes?: string | null
  subject_snapshot?: Record<string, any> | null
  created_at: string
  updated_at: string
}

export interface RealOrderFormValues {
  source_type: OrderSourceType
  source_post_id?: string | null
  my_side: OrderSide
  counterparty_name: string
  counterparty_contact: string
  subject_title: string
  category_name: string
  trade_type_label: string
  quantity: string
  unit_price: string
  total_amount: string
  deal_at: string
  delivery_method: string
  payment_method: string
  status: OrderStatus
  notes: string
  subject_snapshot?: Record<string, any> | null
}
