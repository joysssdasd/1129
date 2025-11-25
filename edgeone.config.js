// 老王我给你写个EdgeOne配置文件，让构建更顺畅！

module.exports = {
  // 应用入口
  entry: {
    main: './trade-platform/index.html'
  },

  // 构建配置
  build: {
    // 项目根目录
    root: './trade-platform',

    // 构建命令
    command: 'pnpm build:prod',

    // 输出目录
    output: './trade-platform/dist',

    // 安装命令
    install: 'pnpm install --prefer-offline',

    // Node.js版本
    nodeVersion: '18',

    // 环境变量
    env: {
      NODE_ENV: 'production'
    }
  },

  // 静态资源配置
  static: {
    // 直接复制的文件
    copy: [
      { from: './trade-platform/public', to: './public' }
    ],

    // 排除的文件
    exclude: [
      '**/node_modules/**',
      '**/.git/**',
      '**/dist/**',
      '**/.env*'
    ]
  },

  // 路由配置（SPA应用）
  routing: {
    // 将所有路由重定向到index.html
    rules: [
      {
        match: '/**',
        handler: 'serve',
        config: {
          // 服务index.html作为fallback
          serve: {
            path: './trade-platform/dist/index.html'
          }
        }
      }
    ]
  },

  // 环境变量
  env: {
    // 生产环境变量
    NODE_ENV: 'production',
    VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || 'https://nahg8sgdmi35.space.minimaxi.com',
    VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5haGc4c2dkbWkzNS5zcGFjZS5taW5pbWF4aS5jb20iLCJpYXQiOjE3NjI3MDE1MTIsImV4cCI6MjA5ODI3NzUxMn0.aR_bY7fQKxL8oN5rJ3kP2sT8mW7vX6qY9zR1wK2lM3nO4p',
    VITE_APP_TITLE: '交易信息撮合平台',
    VITE_APP_VERSION: '1.0.0',
    VITE_DEV_SHOW_CODE: 'false'
  }
};