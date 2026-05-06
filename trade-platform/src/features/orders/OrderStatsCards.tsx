import { BarChart3, CalendarDays, CheckCircle2, CircleDollarSign } from 'lucide-react'
import type { RealOrder } from '@/types/orders'
import { formatCurrency } from './orderHelpers'

interface OrderStatsCardsProps {
  orders: RealOrder[]
}

const startOfCurrentMonth = () => {
  const date = new Date()
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export default function OrderStatsCards({ orders }: OrderStatsCardsProps) {
  const completedOrders = orders.filter((order) => order.status === 'completed')
  const currentMonthStart = startOfCurrentMonth()
  const currentMonthCompletedOrders = completedOrders.filter((order) => {
    return new Date(order.deal_at) >= currentMonthStart
  })

  const totalCompletedAmount = completedOrders.reduce(
    (sum, order) => sum + Number(order.total_amount || 0),
    0
  )
  const currentMonthAmount = currentMonthCompletedOrders.reduce(
    (sum, order) => sum + Number(order.total_amount || 0),
    0
  )

  const stats = [
    {
      label: '总订单数',
      value: String(orders.length),
      helper: '已记录的全部订单',
      accent: 'from-slate-900 via-slate-800 to-slate-700',
      icon: BarChart3,
    },
    {
      label: '已成交数',
      value: String(completedOrders.length),
      helper: '已经确认完成',
      accent: 'from-emerald-600 via-emerald-500 to-teal-500',
      icon: CheckCircle2,
    },
    {
      label: '总成交额',
      value: `¥ ${formatCurrency(totalCompletedAmount)}`,
      helper: '仅统计已成交订单',
      accent: 'from-blue-600 via-cyan-600 to-sky-500',
      icon: CircleDollarSign,
    },
    {
      label: '本月成交额',
      value: `¥ ${formatCurrency(currentMonthAmount)}`,
      helper: '当前自然月累计',
      accent: 'from-violet-600 via-fuchsia-600 to-indigo-500',
      icon: CalendarDays,
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${stat.accent} p-4 text-white shadow-lg shadow-slate-900/10 ring-1 ring-white/10`}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_48%)]" />
          <div className="relative flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-medium text-white/75">{stat.label}</div>
              <div className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">
                {stat.value}
              </div>
              <div className="mt-2 text-xs text-white/70">{stat.helper}</div>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/20">
              <stat.icon className="h-5 w-5 text-white" aria-hidden="true" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
