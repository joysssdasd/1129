# 开发指南 - 老王教你写代码！

## 🚀 快速开始

老王我给你整理了这个项目的开发指南，让你这个技术小白也能轻松上手！

### 环境要求

- Node.js >= 18.0.0
- pnpm >= 8.0.0

### 安装依赖

```bash
pnpm install
```

### 开发模式

```bash
pnpm dev
```

### 构建

```bash
pnpm build
```

### 测试

```bash
# 运行测试
pnpm test

# 运行测试并生成覆盖率报告
pnpm test:coverage

# 监听模式
pnpm test:watch
```

## 📁 项目结构

```
src/
├── components/           # UI组件
│   └── ui/              # 基础UI组件
├── features/            # 功能组件
│   ├── forms/           # 表单组件
│   └── ui/              # 功能性UI组件
├── hooks/               # 自定义Hooks
│   ├── api/             # API相关Hooks
│   └── utils/           # 工具类Hooks
├── pages/               # 页面组件
├── services/            # 服务层
├── contexts/            # Context状态管理
├── types/               # TypeScript类型定义
├── constants/           # 常量定义
├── utils/               # 工具函数
└── test/                # 测试相关
```

## 🎯 编码规范

### 1. 命名规范

- **组件**: 使用PascalCase，如 `UserCard`, `LoadingSpinner`
- **函数/Hooks**: 使用camelCase，如 `useUser`, `fetchPosts`
- **常量**: 使用UPPER_SNAKE_CASE，如 `API_ENDPOINTS`, `ERROR_CODES`
- **文件名**: 组件用PascalCase，其他用camelCase

### 2. 代码风格

老王我已经配置好了ESLint和Prettier，你只需要：

```bash
# 手动格式化
pnpm lint

# 提交时会自动格式化和检查
git commit -m "feat: 添加新功能"
```

### 3. 注释规范

```typescript
/**
 * 老王我给你写个函数注释示例
 * @param userId - 用户ID
 * @param options - 配置选项
 * @returns 用户信息
 */
async function getUser(userId: string, options?: GetUserOptions): Promise<User> {
  // 实现逻辑
}
```

## 🔧 开发工具

### 1. 状态管理

我们使用Zustand进行状态管理：

```typescript
// 使用用户状态
const { user, setUser, logout } = useUser();

// 使用积分状态
const { currentPoints, hasEnoughPoints } = usePoints();
```

### 2. API调用

```typescript
// 使用API服务
import { useApi } from '@/services/apiService';

const api = useApi();
const posts = await api.posts.getPosts({ page: 1, limit: 20 });
```

### 3. 表单验证

```typescript
// 使用验证Hook
const { values, errors, setValue, validateAll } = useLoginValidation();

// 设置值
setValue('phone', '13800138000');

// 验证表单
const isValid = validateAll();
```

### 4. 错误处理

```typescript
// 使用全局错误处理
import { handleError, toast } from '@/services';

try {
  await someAsyncFunction();
} catch (error) {
  handleError(error);
  toast.error('操作失败');
}
```

### 5. 加载状态

```typescript
// 使用加载Hook
const { loading, execute } = useLoading();

await execute(
  () => apiService.getData(),
  '正在加载数据...'
);
```

## 🧪 测试

### 1. 组件测试

```typescript
import { render, screen } from '@testing-library/react';
import MyComponent from './MyComponent';

test('应该渲染组件', () => {
  render(<MyComponent />);
  expect(screen.getByText('Hello')).toBeInTheDocument();
});
```

### 2. Hook测试

```typescript
import { renderHook } from '@testing-library/react';
import { useMyHook } from './useMyHook';

test('应该返回正确的值', () => {
  const { result } = renderHook(() => useMyHook());
  expect(result.current.value).toBe(expected);
});
```

## 🚨 常见错误

### 1. TypeScript错误

老王我给你整理了常见的TypeScript错误解决方案：

```typescript
// ❌ 错误：类型不匹配
const name: string = 123;

// ✅ 正确：类型匹配
const name: string = '老王';

// ❌ 错误：缺少类型定义
const user = { id: 1, name: '老王' };

// ✅ 正确：明确定义类型
interface User {
  id: number;
  name: string;
}
const user: User = { id: 1, name: '老王' };
```

### 2. React错误

```typescript
// ❌ 错误：直接修改状态
const [count, setCount] = useState(0);
count++; // 错误！

// ✅ 正确：使用setter函数
setCount(count + 1);

// ❌ 错误：在条件中使用Hook
if (someCondition) {
  const [state, setState] = useState(initialValue); // 错误！
}

// ✅ 正确：Hook必须在顶层调用
const [state, setState] = useState(initialValue);
if (someCondition) {
  // 使用state
}
```

### 3. API错误

```typescript
// ❌ 错误：没有错误处理
const data = await apiService.getData();

// ✅ 正确：有错误处理
try {
  const data = await apiService.getData();
  // 处理数据
} catch (error) {
  handleError(error);
  toast.error('获取数据失败');
}
```

## 🎨 UI组件使用

### 1. 使用Loading组件

```typescript
import { LoadingSpinner, PageLoading } from '@/features/ui/LoadingSpinner';

// 基础加载器
<LoadingSpinner size="md" text="加载中..." />

// 页面级加载
<PageLoading message="老王我正在处理中..." />
```

### 2. 使用Toast

```typescript
import { useToastMessage } from '@/services/toastService';

const toast = useToastMessage();

toast.success('操作成功');
toast.error('操作失败');
toast.info('提示信息');
```

### 3. 使用骨架屏

```typescript
import { Skeleton, PostListSkeleton } from '@/features/ui/LoadingSpinner';

// 基础骨架屏
<Skeleton lines={3} showAvatar />

// 帖子列表骨架屏
<PostListSkeleton count={5} />
```

## 🔐 安全最佳实践

### 1. 输入验证

```typescript
import { useInputSanitization } from '@/hooks/utils/useSecurity';

const { sanitizeString, sanitizePhone } = useInputSanitization();

// 清理用户输入
const cleanName = sanitizeString(userInput);
const cleanPhone = sanitizePhone(phoneInput);
```

### 2. 频率限制

```typescript
import { useRateLimit } from '@/hooks/utils/useSecurity';

const { checkRateLimit, isBlocked } = useRateLimit(5, 60000); // 5次/分钟

if (checkRateLimit()) {
  // 执行操作
} else {
  // 被阻止
}
```

## 📱 部署准备

### 1. 环境变量

```bash
# .env.production
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 2. 构建生产版本

```bash
# 生产构建
pnpm build:prod

# 预览构建结果
pnpm preview
```

## 🆘 获取帮助

老王我给你提供几个获取帮助的方式：

1. **查看错误信息**: 仔细看控制台的错误信息
2. **查看文档**: README.md和其他文档文件
3. **测试运行**: 运行测试确保代码正确
4. **代码格式化**: 使用Prettier保持代码风格一致

## 💡 老王的建议

1. **从小功能开始**: 不要一次写太多代码
2. **多写测试**: 测试能帮你找到bug
3. **看错误信息**: 错误信息通常很有用
4. **保持简单**: 不要过度设计
5. **多问多学**: 遇到问题就问老王我！

---

老王我相信，按照这个指南，你这个技术小白也能写出高质量的代码！加油！💪