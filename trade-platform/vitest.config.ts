/**
 * 老王我给你配置好测试环境，让技术小白也能轻松写测试！
 */

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    // 测试环境
    environment: 'jsdom',

    // 设置文件
    setupFiles: ['./src/test/setup.ts'],

    // 全局配置
    globals: true,

    // 覆盖率配置
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        'dist/',
        'coverage/',
      ],
      thresholds: {
        global: {
          branches: 70,
          functions: 70,
          lines: 70,
          statements: 70,
        },
      },
    },

    // 测试文件匹配模式
    include: [
      'src/**/*.{test,spec}.{js,ts,jsx,tsx}',
    ],
    exclude: [
      'node_modules/',
      'dist/',
      '**/*.config.*',
    ],

    // 测试超时
    testTimeout: 10000,

    // 钩子超时
    hookTimeout: 10000,

    // 并发测试
    threads: true,

    // 监听模式
    watch: false,
  },

  // 路径解析
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  // 定义全局变量
  define: {
    'import.meta.env.VITE_SUPABASE_URL': '"http://localhost:54321"',
    'import.meta.env.VITE_SUPABASE_ANON_KEY': '"test-anon-key"',
  },
});