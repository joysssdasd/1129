# 托管行情同步协议

## 目标

这套协议把整条链路拆成两层：

1. 模型层  
   负责读 `wechat/`、筛选有效交易、判断是否值得进站、生成日报和最终确认清单。

2. 执行层  
   只负责接收确认清单，然后执行：
   - 新建帖子
   - 用新价格替换旧价
   - 刷新有效期
   - 下架缺席旧盘
   - 记录执行历史

核心原则是：

- 模型决定“发什么”
- 程序决定“怎么稳定地同步到站内”

## Manifest

模型确认后的发站清单统一写成 `managed-sync-manifest.json`。

关键字段：

```json
{
  "kind": "niuniubase.managed-market-sync",
  "protocolVersion": 1,
  "generatedAt": "2026-03-22T12:00:00.000Z",
  "source": {
    "workflow": "wechat-market-daily",
    "timezone": "Asia/Shanghai",
    "siteOrigin": "https://www.niuniubase.top",
    "sourceDate": "2026-03-22"
  },
  "run": {
    "runId": "wechat-market-2026-03-22-xxxx",
    "runDate": "2026-03-22",
    "dryRun": false
  },
  "operator": {
    "userId": "admin-user-id",
    "wechatId": "niuniubase"
  },
  "plan": {
    "planId": "plan-2026-03-22-xxxx",
    "planHash": "full-plan-hash",
    "payloadHash": "current-request-hash",
    "syncMode": "managed_market",
    "deactivateMissing": true,
    "activeMarketKeys": ["..."],
    "posts": []
  }
}
```

## marketKey

`marketKey` 是托管同步的核心主键。

规则：

- 同一个 `marketKey` 代表“同一个标的盘口”
- `marketKey` 不包含价格
- 当新价格出现时，不新发重复帖，而是更新已有帖子

推荐结构：

- 演唱会：`板块 + 买卖方向 + 城市 + 艺人 + 日期 + 档位`
- 数码和茅台：`板块 + 买卖方向 + 品类/机型 + 版本`
- 纪念币/钞：`板块 + 买卖方向 + 标的 + 版本/封装`
- 贵金属：`板块 + 买卖方向 + 品种 + 规格`

## 执行接口

接口：

- `POST /api/admin/wechat-auto-publish`

兼容两种输入：

1. 旧模式  
   直接传 `posts`

2. 新模式  
   传 `manifest`

新模式支持：

- `dryRun`
- `phase`
- `batchIndex / batchCount`
- `planId / planHash / payloadHash`

## 执行动作

接口会把每条确认清单归类成以下动作之一：

- `create`
- `update`
- `refresh`
- `deactivate`
- `skip`

含义：

- `create`：没有匹配到旧盘，新建帖子
- `update`：匹配到旧盘，但价格、标题、分类或文案变化，需要替换旧帖内容
- `refresh`：匹配到旧盘，核心内容不变，只续期或重新认领状态
- `deactivate`：这轮确认清单里已经缺席，旧盘自动下架
- `skip`：旧模式直发时命中近 7 天重复帖

## 推荐执行流

1. 模型生成日报和 `managed-sync-manifest.json`
2. 先用 `dryRun=true` 请求接口
3. 看回执里的动作清单是否合理
4. 再正式执行分批同步
5. 所有批次成功后，最后一次 `finalize` 执行缺席旧盘下架

## 历史记录

执行层会把信息写入 `system_settings`：

- `wechat_market_state`  
  当前 `marketKey -> postId` 的映射

- `wechat_market_history`  
  每次 `create / update / refresh / deactivate` 的变更记录

- `wechat_market_runs`  
  每次请求的运行摘要，包括 `runId`、`phase`、`planHash` 和动作统计

## 为什么这套协议更稳

因为它同时解决了 4 个问题：

1. 模型确认和程序执行解耦  
   模型判断质量不会被程序逻辑绑死。

2. 新价自动替换旧价  
   同标的不再堆重复帖。

3. 可以预演  
   先看 `dryRun` 的动作清单，再决定是否执行。

4. 可以回放  
   每次执行都能按 `runId + planHash` 查回当时到底替换了什么。
