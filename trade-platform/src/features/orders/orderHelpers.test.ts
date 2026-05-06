/**
 * 订单辅助函数测试
 */

import { describe, it, expect } from 'vitest'
import {
  calculateTotalAmount,
  formatCurrency,
  createOrderFormValues,
  buildOrderDraftFromPost,
  createEmptyOrderDraft,
} from './orderHelpers'
import type { RealOrder, RealOrderFormValues } from '@/types/orders'

describe('calculateTotalAmount', () => {
  it('应该正确计算总价', () => {
    expect(calculateTotalAmount('2', '100')).toBe('200')
    expect(calculateTotalAmount('3', '50')).toBe('150')
    expect(calculateTotalAmount('1.5', '10')).toBe('15')
  })

  it('应该处理小数精度', () => {
    expect(calculateTotalAmount('2', '99.99')).toBe('199.98')
    expect(calculateTotalAmount('3', '33.33')).toBe('99.99')
  })

  it('应该处理无效输入', () => {
    // 空字符串会被当作 0 处理
    expect(calculateTotalAmount('', '100')).toBe('0')
    expect(calculateTotalAmount('2', '')).toBe('0')
    expect(calculateTotalAmount('abc', '100')).toBe('')
    expect(calculateTotalAmount('2', 'xyz')).toBe('')
  })
})

describe('formatCurrency', () => {
  it('应该格式化整数', () => {
    expect(formatCurrency(100)).toBe('100')
    expect(formatCurrency(1000)).toBe('1,000')
    expect(formatCurrency(1000000)).toBe('1,000,000')
  })

  it('应该格式化小数', () => {
    expect(formatCurrency(99.99)).toBe('99.99')
    // 1000.5 会被格式化为 1,000.50（两位小数）
    expect(formatCurrency(1000.5)).toBe('1,000.50')
  })

  it('应该处理零和空值', () => {
    expect(formatCurrency(0)).toBe('0')
    expect(formatCurrency(null)).toBe('0')
    expect(formatCurrency(undefined)).toBe('0')
  })
})

describe('createOrderFormValues', () => {
  it('应该返回默认空订单', () => {
    const result = createOrderFormValues()
    expect(result.source_type).toBe('manual')
    expect(result.my_side).toBe('other')
    expect(result.status).toBe('draft')
  })

  it('应该合并提供的值', () => {
    const order: Partial<RealOrderFormValues> = {
      source_type: 'platform_post',
      source_post_id: 'test-id',
      my_side: 'buy',
      subject_title: '测试订单',
      total_amount: '100',
    }

    const result = createOrderFormValues(order)
    expect(result.source_type).toBe('platform_post')
    expect(result.source_post_id).toBe('test-id')
    expect(result.my_side).toBe('buy')
    expect(result.subject_title).toBe('测试订单')
  })
})

describe('buildOrderDraftFromPost', () => {
  const mockPost = {
    id: 'post-123',
    title: '周杰伦演唱会门票',
    price: 500,
    trade_type: 2, // 出售
    keywords: '演唱会,周杰伦',
    category_id: 'cat-1',
    extra_info: '__managed_market__test',
    created_at: '2026-01-01T00:00:00Z',
  }

  const mockPostUser = {
    phone: '13800138000',
    wechat_id: 'laowang123',
  }

  it('应该从帖子创建订单草稿', () => {
    const result = buildOrderDraftFromPost({
      post: mockPost,
      postUser: mockPostUser,
      contact: 'wx-contact',
    })

    expect(result.source_type).toBe('platform_post')
    expect(result.source_post_id).toBe('post-123')
    expect(result.subject_title).toBe('周杰伦演唱会门票')
    expect(result.total_amount).toBe('500')
    expect(result.counterparty_contact).toBe('wx-contact')
    expect(result.subject_snapshot).toBeDefined()
    expect(result.subject_snapshot?.id).toBe('post-123')
  })

  it('应该正确推断买方/卖方方向', () => {
    // 求购帖子的发布者应该是卖方
    const buyPost = { ...mockPost, trade_type: 1 }
    const result = buildOrderDraftFromPost({ post: buyPost })
    expect(result.my_side).toBe('sell')

    // 出售帖子的发布者应该是买方
    const sellPost = { ...mockPost, trade_type: 2 }
    const result2 = buildOrderDraftFromPost({ post: sellPost, isOwner: true })
    expect(result2.my_side).toBe('sell')
  })
})

describe('createEmptyOrderDraft', () => {
  it('应该创建有效的空订单草稿', () => {
    const result = createEmptyOrderDraft()

    expect(result.source_type).toBe('manual')
    expect(result.my_side).toBe('other')
    expect(result.quantity).toBe('1')
    expect(result.status).toBe('draft')
    expect(result.subject_snapshot).toBeNull()
  })
})
