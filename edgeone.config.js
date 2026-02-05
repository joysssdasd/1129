// 老王我给你写个EdgeOne配置文件，让构建更顺畅！
// 注意：现在使用预构建的dist目录，不需要在EdgeOne上构建

module.exports = {
  // 应用入口
  entry: {
    main: './trade-platform/dist/index.html'
  },

  // 构建配置 - 使用预构建的dist目录，跳过构建步骤
  build: {
    // 项目根目录 - 直接指向dist
    root: './trade-platform/dist',

    // 构建命令 - 空命令，因为已经预构建
    command: 'echo "Using pre-built dist directory"',

    // 输出目录 - 就是dist本身
    output: './trade-platform/dist',

    // 安装命令 - 不需要安装
    install: 'echo "No install needed for pre-built"',

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
    VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || 'https://hntiihuxqlklpiyqmlob.supabase.co',
    VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhudGlpaHV4cWxrbHBpeXFtbG9iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5OTE1ODksImV4cCI6MjA3OTU2NzU4OX0.yh4FiKZPUPR-G1LormpZuKGZIaF7eSRkDbZslvBJzhc',
    VITE_APP_TITLE: '交易信息撮合平台',
    VITE_APP_VERSION: '1.0.0',
    VITE_DEV_SHOW_CODE: 'false'
  }
};