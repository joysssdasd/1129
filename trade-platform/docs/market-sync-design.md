# 微信行情数据同步架构设计

## 1. 背景与目标

### 现状
- **wechat 模块**：微信群聊天记录 → 牛牛日报（AI 清洗后的结构化行情）
- **trade-platform**：独立的交易平台，用户手动发布帖子
- **数据孤岛**：两边数据不互通

### 目标
打通 wechat → trade-platform 的数据流，让牛牛日报的行情数据自动同步到平台展示。

---

## 2. 数据模型设计

### 2.1 微信行情帖子类型扩展

在 `posts` 表中增加字段：

```sql
-- 新增字段
ALTER TABLE posts ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'user';  -- 'user' | 'wechat_market'
ALTER TABLE posts ADD COLUMN IF NOT EXISTS market_key TEXT;                  -- 行情唯一标识，如 '周杰伦-南宁-780档'
ALTER TABLE posts ADD COLUMN IF NOT EXISTS market_board TEXT;                 -- 板块：演唱会/数码茅台/贵金属/纪念币钞
ALTER TABLE posts ADD COLUMN IF NOT EXISTS market_data JSONB;                 -- 原始行情数据快照
ALTER TABLE posts ADD COLUMN IF NOT EXISTS run_id TEXT;                       -- 同步批次ID
```

### 2.2 行情帖子字段映射

| 牛牛日报字段 | posts.title | posts.keywords | posts.price | posts.trade_type | posts.category_id | posts.extra_info |
|------------|-------------|----------------|------------|------------------|-------------------|-----------------|
| 南宁-周杰伦 780档 出 2750 | 南宁-周杰伦 780档 | 周杰伦,南宁,780档,演唱会 | 2750 | 2 (出售) | 演唱会分类ID | 备注信息 |
| i茅台原件 收 1630 | i茅台原件 | i茅台原件,茅台 | 1630 | 1 (求购) | 数码茅台分类ID | 备注信息 |

### 2.3 Category 映射

```javascript
const MARKET_BOARD_CATEGORIES = {
  '演唱会': 'concerts',
  '数码和茅台': 'digital_moutai',
  '贵金属': 'precious_metals',
  '纪念币/钞': 'commemorative_coins'
}
```

---

## 3. API 设计

### 3.1 同步端点

```
POST /api/market/sync
```

**请求体**：
```json
{
  "manifest": {
    "kind": "niuniubase.managed-market-sync",
    "protocolVersion": 1,
    "plan": {
      "posts": [...],        // 行情帖子列表
      "syncMode": "managed_market",
      "deactivateMissing": true,
      "activeMarketKeys": [...]  // 当前活跃的行情标识
    },
    "run": {
      "runId": "...",
      "runDate": "2026-05-06",
      "dryRun": false
    },
    "execution": {
      "phase": "sync"
    }
  },
  "operatorUserId": "uuid"  // 可选，使用指定管理员
}
```

**响应**：
```json
{
  "success": true,
  "data": {
    "runId": "...",
    "createdPosts": [...],
    "updatedPosts": [...],
    "deactivatedPosts": [...],
    "actions": [...]
  }
}
```

### 3.2 查询端点

```
GET /api/posts?source_type=wechat_market&market_board=演唱会
```

---

## 4. 前端设计

### 4.1 筛选器

在 HomePage 添加 Tab 筛选：
- 全部（默认）
- 微信行情
- 用户发布

### 4.2 行情标记

- 微信行情帖子显示特殊标记（如"行情"标签）
- 不同板块用不同颜色区分

### 4.3 帖子详情页

显示行情原始数据快照（market_data）

---

## 5. 同步策略

### 5.1 幂等性保证

使用 `market_key` 作为唯一标识，同一天同一行情只保留最新版本：
- 如果 `market_key` 已存在且价格相同 → 跳过
- 如果 `market_key` 已存在但价格变化 → 更新
- 如果 `market_key` 不存在 → 新建

### 5.2 过期机制

- 微信行情帖子默认 7 天后自动下架
- 下架时设置 `status='inactive'`, `hide_reason='auto_expired'`

### 5.3 同步触发

1. **手动触发**：管理员后台点击"同步微信行情"
2. **定时触发**：每日固定时间（如早上 9:00）
3. **Webhook**：wechat 分析完成后自动触发

---

## 6. 实现计划

### Phase 1: 数据库迁移
- [x] 创建迁移文件 `20260506_add_wechat_market_fields.sql`
- [ ] 执行迁移到 Supabase

### Phase 2: API 实现
- [x] `handleAdminWechatAutoPublish` 已实现基础版本
- [x] `insertManagedMarketPost` 已支持基础帖子创建
- [x] 修改 `insertManagedMarketPost` 添加 `source_type='wechat_market'` 和 `market_key`
- [x] 修改 `buildManagedPostUpdatePayload` 支持 `market_data` 更新

### Phase 3: 前端实现
- [x] 添加微信行情 Tab 筛选（来源筛选）
- [x] 显示行情板块标记
- [ ] 订单关联（后续 P2 阶段）

### Phase 4: 自动化
- [ ] 配置定时同步任务
- [ ] 添加同步日志和监控

---

## 8. P2: 订单与帖子关联已实现

### 已完成功能
- [x] 订单完成时自动增加关联帖子的 `deal_count`
- [x] PostDetailPage 显示成交次数
- [x] 微信行情帖子标记显示

### 实现细节
当订单状态变更为 `completed` 且 `source_post_id` 存在时：
1. 查询关联帖子的当前 `deal_count`
2. 将 `deal_count` 加 1 并更新数据库
3. 记录操作错误但不影响订单更新结果

---

## 9. P3: 单元测试覆盖

### 已添加测试
- [x] `src/features/orders/orderHelpers.test.ts` - 订单辅助函数测试
  - `calculateTotalAmount` - 总价计算
  - `formatCurrency` - 货币格式化
  - `createOrderFormValues` - 表单值创建
  - `buildOrderDraftFromPost` - 从帖子创建订单草稿
  - `createEmptyOrderDraft` - 创建空订单草稿

### 运行测试
```bash
cd trade-platform
pnpm test:run
```

---

## 7. 安全考虑

1. **权限控制**：只有管理员可以调用同步 API
2. **输入验证**：严格验证帖子数据格式
3. **限流**：防止频繁同步
4. **审计日志**：记录每次同步操作
