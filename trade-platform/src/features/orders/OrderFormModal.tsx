import { useEffect, useState } from 'react'
import { CalendarClock, CreditCard, Package2, Tag, Users, X } from 'lucide-react'
import type { RealOrder, RealOrderFormValues } from '@/types/orders'
import {
  DELIVERY_METHOD_OPTIONS,
  ORDER_SIDE_LABELS,
  ORDER_SOURCE_LABELS,
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_OPTIONS,
  calculateTotalAmount,
  createOrderFormValues,
  toDateTimeInputValue,
} from './orderHelpers'

interface OrderFormModalProps {
  open: boolean
  order?: RealOrder | null
  initialValues?: Partial<RealOrderFormValues> | null
  submitting?: boolean
  onClose: () => void
  onSubmit: (values: RealOrderFormValues) => Promise<void> | void
}

const inputClassName =
  'w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10'

const labelClassName = 'mb-2 block text-sm font-medium text-slate-700'

export default function OrderFormModal({
  open,
  order,
  initialValues,
  submitting = false,
  onClose,
  onSubmit,
}: OrderFormModalProps) {
  const [form, setForm] = useState<RealOrderFormValues>(createOrderFormValues(initialValues))

  useEffect(() => {
    if (!open) return
    setForm(createOrderFormValues(order || initialValues))
  }, [open, order, initialValues])

  if (!open) return null

  const updateField = (key: keyof RealOrderFormValues, value: string) => {
    setForm((current) => {
      const next = {
        ...current,
        [key]: value,
      }

      if (key === 'quantity' || key === 'unit_price') {
        const totalAmount = calculateTotalAmount(
          key === 'quantity' ? value : current.quantity,
          key === 'unit_price' ? value : current.unit_price
        )

        if (totalAmount) {
          next.total_amount = totalAmount
        }
      }

      return next
    })
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await onSubmit(form)
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-sm">
      <div className="absolute inset-0 overflow-y-auto p-0 sm:p-4">
        <div className="mx-auto flex min-h-full w-full max-w-3xl items-end justify-center sm:items-center">
          <div className="w-full overflow-hidden rounded-t-[28px] bg-white shadow-2xl ring-1 ring-black/5 sm:rounded-[28px]">
            <div className="border-b border-slate-100 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-5 py-5 text-white sm:px-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/80 ring-1 ring-white/10">
                    <Package2 className="h-3.5 w-3.5" />
                    {order ? '编辑订单' : '新建订单'}
                  </div>
                  <h2 className="mt-3 text-2xl font-semibold tracking-tight">
                    {order ? '整理一笔已有成交' : '记录一笔新的真实订单'}
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                    {form.source_type === 'platform_post'
                      ? '平台帖子已经为你预填了常用信息，改两三个字段就能保存。'
                      : '先把交易记下来，后面随时都能继续补全和调整。'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  aria-label="关闭订单表单"
                  className="rounded-full bg-white/10 p-2 text-white/80 transition-colors hover:bg-white/15 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-5 grid gap-2 sm:grid-cols-3">
                <div className="rounded-2xl bg-white/8 px-4 py-3 ring-1 ring-white/10">
                  <div className="text-xs text-slate-300">来源</div>
                  <div className="mt-1 text-sm font-medium">{ORDER_SOURCE_LABELS[form.source_type]}</div>
                </div>
                <div className="rounded-2xl bg-white/8 px-4 py-3 ring-1 ring-white/10">
                  <div className="text-xs text-slate-300">状态</div>
                  <div className="mt-1 text-sm font-medium">{ORDER_STATUS_LABELS[form.status]}</div>
                </div>
                <div className="rounded-2xl bg-white/8 px-4 py-3 ring-1 ring-white/10">
                  <div className="text-xs text-slate-300">角色</div>
                  <div className="mt-1 text-sm font-medium">{ORDER_SIDE_LABELS[form.my_side]}</div>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 px-4 py-5 sm:px-6 sm:py-6">
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
                  <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <Users className="h-4 w-4 text-blue-600" />
                    交易对象
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className={labelClassName} htmlFor="order-role">
                        我的角色
                      </label>
                      <div id="order-role" className="grid grid-cols-3 gap-2">
                        {(['buy', 'sell', 'other'] as const).map((option) => (
                          <button
                            key={option}
                            type="button"
                            onClick={() => setForm((current) => ({ ...current, my_side: option }))}
                            className={`rounded-2xl border px-3 py-2.5 text-sm font-medium transition-colors ${
                              form.my_side === option
                                ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
                                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                            }`}
                          >
                            {ORDER_SIDE_LABELS[option]}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className={labelClassName} htmlFor="counterparty-name">
                        交易对象
                      </label>
                      <input
                        id="counterparty-name"
                        type="text"
                        value={form.counterparty_name}
                        onChange={(event) => updateField('counterparty_name', event.target.value)}
                        className={inputClassName}
                        placeholder="例如：老客户张先生"
                      />
                    </div>

                    <div>
                      <label className={labelClassName} htmlFor="counterparty-contact">
                        联系方式
                      </label>
                      <input
                        id="counterparty-contact"
                        type="text"
                        value={form.counterparty_contact}
                        onChange={(event) => updateField('counterparty_contact', event.target.value)}
                        className={inputClassName}
                        placeholder="微信 / 手机 / QQ"
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-5">
                  <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <Tag className="h-4 w-4 text-blue-600" />
                    标的与金额
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className={labelClassName} htmlFor="subject-title">
                        标的名称
                      </label>
                      <input
                        id="subject-title"
                        type="text"
                        value={form.subject_title}
                        onChange={(event) => updateField('subject_title', event.target.value)}
                        required
                        className={inputClassName}
                        placeholder="例如：门票 / 设备 / 席位"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className={labelClassName} htmlFor="category-name">
                        分类 / 板块
                      </label>
                      <input
                        id="category-name"
                        type="text"
                        value={form.category_name}
                        onChange={(event) => updateField('category_name', event.target.value)}
                        className={inputClassName}
                        placeholder="例如：演唱会票 / 数码产品"
                      />
                    </div>

                    <div>
                      <label className={labelClassName} htmlFor="quantity">
                        数量
                      </label>
                      <input
                        id="quantity"
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.quantity}
                        onChange={(event) => updateField('quantity', event.target.value)}
                        className={inputClassName}
                        placeholder="1"
                      />
                    </div>

                    <div>
                      <label className={labelClassName} htmlFor="unit-price">
                        单价
                      </label>
                      <input
                        id="unit-price"
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.unit_price}
                        onChange={(event) => updateField('unit_price', event.target.value)}
                        className={inputClassName}
                        placeholder="0.00"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className={labelClassName} htmlFor="total-amount">
                        成交总额
                      </label>
                      <input
                        id="total-amount"
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.total_amount}
                        onChange={(event) => updateField('total_amount', event.target.value)}
                        required
                        className={inputClassName}
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-5">
                  <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <CalendarClock className="h-4 w-4 text-blue-600" />
                    成交与状态
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className={labelClassName} htmlFor="deal-at">
                        成交时间
                      </label>
                      <input
                        id="deal-at"
                        type="datetime-local"
                        value={toDateTimeInputValue(form.deal_at)}
                        onChange={(event) => updateField('deal_at', event.target.value)}
                        className={inputClassName}
                      />
                    </div>

                    <div>
                      <label className={labelClassName} htmlFor="order-status">
                        订单状态
                      </label>
                      <div id="order-status" className="grid grid-cols-3 gap-2">
                        {(['draft', 'completed', 'cancelled'] as const).map((option) => (
                          <button
                            key={option}
                            type="button"
                            onClick={() => setForm((current) => ({ ...current, status: option }))}
                            className={`rounded-2xl border px-3 py-2.5 text-sm font-medium transition-colors ${
                              form.status === option
                                ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                            }`}
                          >
                            {ORDER_STATUS_LABELS[option]}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
                  <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <CreditCard className="h-4 w-4 text-blue-600" />
                    交割与备注
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className={labelClassName} htmlFor="delivery-method">
                        交割方式
                      </label>
                      <input
                        id="delivery-method"
                        list="delivery-method-options"
                        value={form.delivery_method}
                        onChange={(event) => updateField('delivery_method', event.target.value)}
                        className={inputClassName}
                        placeholder="例如：当面交割"
                      />
                      <datalist id="delivery-method-options">
                        {DELIVERY_METHOD_OPTIONS.map((option) => (
                          <option key={option} value={option} />
                        ))}
                      </datalist>
                    </div>

                    <div>
                      <label className={labelClassName} htmlFor="payment-method">
                        付款方式
                      </label>
                      <input
                        id="payment-method"
                        list="payment-method-options"
                        value={form.payment_method}
                        onChange={(event) => updateField('payment_method', event.target.value)}
                        className={inputClassName}
                        placeholder="例如：微信"
                      />
                      <datalist id="payment-method-options">
                        {PAYMENT_METHOD_OPTIONS.map((option) => (
                          <option key={option} value={option} />
                        ))}
                      </datalist>
                    </div>

                    <div>
                      <label className={labelClassName} htmlFor="trade-type-label">
                        交易类型说明
                      </label>
                      <input
                        id="trade-type-label"
                        type="text"
                        value={form.trade_type_label}
                        onChange={(event) => updateField('trade_type_label', event.target.value)}
                        className={inputClassName}
                        placeholder="例如：求购 / 出售 / 做多 / 做空"
                      />
                    </div>

                    <div>
                      <label className={labelClassName} htmlFor="order-notes">
                        备注
                      </label>
                      <textarea
                        id="order-notes"
                        value={form.notes}
                        onChange={(event) => updateField('notes', event.target.value)}
                        rows={4}
                        className={`${inputClassName} resize-none`}
                        placeholder="可以补充交割细节、特殊约定、交易背景等"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="sticky bottom-0 -mx-4 border-t border-slate-100 bg-white/95 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6">
                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={onClose}
                    className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 px-5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex h-12 items-center justify-center rounded-2xl bg-blue-600 px-5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? '保存中...' : order ? '保存修改' : '保存订单'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
