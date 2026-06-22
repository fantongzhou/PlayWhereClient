# travel-agent-client

AI 旅行规划前端。基于 Nuxt 3 + Vue 3，提供实时聊天式旅行规划体验，集成 Leaflet 互动地图和日程序时间线。

## 技术栈

- **Framework**: Nuxt 3 (Vue 3 + Vite)
- **State**: Pinia
- **Map**: 高德地图 JS API v2.0（client-only 动态加载）
- **CSS**: Scoped Vue Styles + CSS 自定义属性
- **TypeScript**: Strict mode

## 快速开始

```bash
npm install
npm run dev            # :5173，API 代理到 localhost:3333
```

## 环境变量

| 变量 | 说明 |
|------|------|
| `NUXT_PUBLIC_API_BASE` | 生产环境 API 地址。开发时留空，使用 Vite proxy |
| `NUXT_PUBLIC_AMAP_KEY` | 高德地图 JS API Key（与天气 API 共用 AMAP_API_KEY） |
| `NUXT_PUBLIC_AMAP_SECURITY_CODE` | 高德地图安全密钥（可选） |

## 页面

| 路由 | 页面 | 说明 |
|------|------|------|
| `/` | Trip Planner | **唯一页面** — 全屏聊天 + 行程生成后右侧滑出地图和时间线 |

## 核心交互流程

```
初始状态：全屏聊天界面
  ↓ 用户输入自然语言需求
  ↓ SSE 实时流式回复（思考步骤可展开）
  ↓ Agent 信息不足 → 追问 → 用户补充 → 继续
  ↓ Agent 生成行程 → 右侧面板动画滑出 (0 → 45%)
  ├─ 上半：Leaflet 互动地图（标记点 + 路线）
  └─ 下半：日期标签页 + 每日时间线 + 预算/贴士
  ↓ 继续对话调整 → 多轮记忆保持上下文
```

## 组件

| 组件 | 说明 |
|------|------|
| `TravelMap.client.vue` | Leaflet 地图，多日叠加，彩色编号标记，路线折线，酒店标记 |
| `TimelinePanel.vue` | 日程序面板，日期标签切换，预算和旅行贴士 |
| `DayCard.vue` | 单日卡片：天气条 + 活动时间线 + 酒店信息 |
| `ActivityItem.vue` | 单条活动：时间、类型徽章、名称、时长、备注、图片条、预订链接 |
| `ImagePreview.vue` | 全屏图片预览，支持键盘导航（← → Esc） |

## Composables

| Composable | 说明 |
|------------|------|
| `useRoutes` | 监听行程计划变更，自动获取每日路线 |
| `useApiBase` | 读取 runtimeConfig 中的 API 地址 |

## Stores (Pinia)

| Store | 核心状态 | 说明 |
|-------|---------|------|
| `trip` | `plan`, `activeDay`, `routesByDay` | 行程计划、当前激活日、路线数据 |

## 项目结构

```
pages/
  index.vue             # 主页：聊天 + 滑出地图/时间线
components/
  TravelMap.client.vue  # Leaflet 地图
  TimelinePanel.vue     # 时间线面板
  DayCard.vue           # 单日卡片
  ActivityItem.vue      # 活动条目
  ImagePreview.vue      # 图片预览
composables/
  useRoutes.ts          # 路线获取
  useApiBase.ts         # API 地址
stores/
  trip.ts               # 行程状态
types/
  index.ts              # 类型定义 + 预设常量
```

## 脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | 开发模式 (:5173) |
| `npm run build` | 生产构建 |
| `npm run generate` | 静态生成 |
| `npm run preview` | 预览生产构建 |

---

> 📝 本文档随功能变更同步维护。最后更新：2026-06-22
