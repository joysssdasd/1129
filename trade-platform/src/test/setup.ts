/**
 * 老王我给你设置好测试环境，让技术小白也能轻松写测试！
 */

import '@testing-library/jest-dom';
import { vi, expect } from 'vitest';

// Mock Supabase
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(),
      signIn: vi.fn(),
      signOut: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
        order: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: null, error: null })),
          })),
        })),
      })),
      insert: vi.fn(() => Promise.resolve({ data: null, error: null })),
      update: vi.fn(() => Promise.resolve({ data: null, error: null })),
      delete: vi.fn(() => Promise.resolve({ data: null, error: null })),
    })),
    functions: {
      invoke: vi.fn(() => Promise.resolve({ data: null, error: null })),
    },
  })),
}));

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock environment variables
vi.mock('../../constants', async () => {
  const actual = await vi.importActual('../../constants') as any;
  return {
    ...actual,
    DEV_CONFIG: {
      ...actual.DEV_CONFIG,
      SHOW_VERIFICATION_CODE: true,
    },
  };
});

// Global test utilities
global.createMockUser = (overrides = {}) => ({
  id: 'test-user-id',
  phone: '13800138000',
  wechat_id: 'test-wechat',
  invite_code: 'ABC123',
  points: 100,
  success_rate: 0.8,
  is_admin: false,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
  ...overrides,
});

global.createMockPost = (overrides = {}) => ({
  id: 'test-post-id',
  user_id: 'test-user-id',
  title: '测试帖子',
  keywords: '测试,关键词',
  price: 100,
  trade_type: 'transfer',
  delivery_time: '2025-01-02',
  description: '这是一个测试帖子',
  view_count: 0,
  views_remaining: 10,
  status: 'active',
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
  ...overrides,
});

// 添加自定义匹配器
expect.extend({
  toBeValidUser(received) {
    const isValid = received &&
      typeof received.id === 'string' &&
      typeof received.phone === 'string' &&
      typeof received.points === 'number' &&
      typeof received.is_admin === 'boolean';

    return {
      message: () =>
        isValid
          ? `expected ${received} not to be a valid user`
          : `expected ${received} to be a valid user`,
      pass: isValid,
    };
  },

  toBeValidPost(received) {
    const isValid = received &&
      typeof received.id === 'string' &&
      typeof received.user_id === 'string' &&
      typeof received.title === 'string' &&
      typeof received.price === 'number' &&
      ['transfer', 'request'].includes(received.trade_type);

    return {
      message: () =>
        isValid
          ? `expected ${received} not to be a valid post`
          : `expected ${received} to be a valid post`,
      pass: isValid,
    };
  },
});

// 扩展Jest类型
declare global {
  namespace Vi {
    interface JestAssertion<T = any> {
      toBeValidUser(): T;
      toBeValidPost(): T;
    }
  }
}