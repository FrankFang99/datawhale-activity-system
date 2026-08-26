# Design System · Datawhale 高校活动智能管理系统

> 基于 [Datawhale.cn](https://www.Datawhale.cn/) 官网视觉风格提取，用于前端 UI 统一规范。

---

## 1. 色彩体系

### 1.1 品牌主色

| Token | 色值 | 用途 |
|-------|------|------|
| `--color-primary` | `#3370FF` | 主按钮、链接、选中态、品牌标识 |
| `--color-primary-hover` | `#2860E0` | 主按钮 hover |
| `--color-primary-active` | `#1E50CC` | 主按钮 active |
| `--color-primary-light` | `#EEF4FF` | 选中背景、浅色标签底 |

### 1.2 辅助色

| Token | 色值 | 用途 |
|-------|------|------|
| `--color-secondary` | `#62D4C8` | 渐变副色、成功辅助 |
| `--color-gradient-start` | `#3370FF` | 渐变起点 |
| `--color-gradient-end` | `#62D4C8` | 渐变终点 |

### 1.3 功能色

| Token | 色值 | 用途 |
|-------|------|------|
| `--color-success` | `#10B981` | 成功、通过、已完成 |
| `--color-warning` | `#F59E0B` | 警告、待处理 |
| `--color-error` | `#EF4444` | 错误、拒绝、危险操作 |
| `--color-info` | `#3B82F6` | 信息提示 |

### 1.4 强调色（活动标签/等级）

| Token | 色值 | 用途 |
|-------|------|------|
| `--color-accent-gold` | `#F6C65B` | 金牌活动、S 级评分 |
| `--color-accent-purple` | `#A679FF` | 特色活动、优先标记 |
| `--color-accent-pink` | `#FF6B9D` | 热门标签 |

### 1.5 中性色

| Token | 色值 | 用途 |
|-------|------|------|
| `--color-bg-layout` | `#F5F8FF` | 页面背景（浅蓝白） |
| `--color-bg-container` | `#FFFFFF` | 卡片/容器背景 |
| `--color-border` | `#E8ECF1` | 分割线、边框 |
| `--color-text-primary` | `#1A1A2E` | 主文本 |
| `--color-text-secondary` | `#6B7280` | 次要文本 |
| `--color-text-tertiary` | `#9CA3AF` | 辅助/占位文本 |
| `--color-text-disabled` | `#D1D5DB` | 禁用文本 |

---

## 2. 字体规范

### 2.1 字体族

```css
--font-sans: "PingFang SC", "Microsoft YaHei", "Helvetica Neue", Helvetica, Arial, sans-serif;
--font-mono: "JetBrains Mono", "Fira Code", "Cascadia Code", monospace;
```

### 2.2 字号层级

| Token | Size | Line Height | Weight | 用途 |
|-------|------|-------------|--------|------|
| `--text-display` | 48px / 3rem | 1.2 | 700 | 首页 Hero 大标题 |
| `--text-h1` | 36px / 2.25rem | 1.25 | 700 | 页面主标题 |
| `--text-h2` | 28px / 1.75rem | 1.3 | 600 | 区块标题 |
| `--text-h3` | 20px / 1.25rem | 1.4 | 600 | 卡片标题 |
| `--text-h4` | 16px / 1rem | 1.5 | 600 | 小标题 |
| `--text-body` | 14px / 0.875rem | 1.6 | 400 | 正文 |
| `--text-caption` | 12px / 0.75rem | 1.5 | 400 | 说明文字、标签 |
| `--text-mini` | 11px / 0.6875rem | 1.4 | 400 | 极小辅助文字 |

---

## 3. 圆角系统

| Token | Radius | 用途 |
|-------|--------|------|
| `--radius-sm` | 6px | 小按钮、标签 |
| `--radius-md` | 10px | 按钮、输入框、下拉框 |
| `--radius-lg` | 16px | 卡片、弹窗 |
| `--radius-xl` | 22px | 大卡片、Hero 区域 |
| `--radius-full` | 9999px | 胶囊标签、头像 |

---

## 4. 间距系统

采用 4px 基准网格：

| Token | Value | 用途 |
|-------|-------|------|
| `--space-1` | 4px | 图标与文字间距 |
| `--space-2` | 8px | 紧凑元素间距 |
| `--space-3` | 12px | 表单项间距 |
| `--space-4` | 16px | 卡片内边距、列表项间距 |
| `--space-6` | 24px | 区块内边距 |
| `--space-8` | 32px | 区块间距 |
| `--space-12` | 48px | 大区块间距 |
| `--space-16` | 64px | 页面级间距 |

---

## 5. 阴影系统

| Token | Box-Shadow | 用途 |
|-------|-----------|------|
| `--shadow-xs` | `0 1px 2px rgba(0,0,0,0.04)` | 输入框、标签 |
| `--shadow-sm` | `0 2px 8px rgba(51,112,255,0.08)` | 卡片默认 |
| `--shadow-md` | `0 4px 16px rgba(51,112,255,0.12)` | 卡片 hover |
| `--shadow-lg` | `0 8px 32px rgba(51,112,255,0.16)` | 弹窗、下拉 |
| `--shadow-xl` | `0 16px 48px rgba(51,112,255,0.20)` | 全屏弹窗 |

> 阴影色调偏向品牌蓝 `rgba(51,112,255,...)` 而非纯黑，与官网风格一致。

---

## 6. 组件规范

### 6.1 按钮

| 类型 | 高度 | 圆角 | 字号 | 背景 |
|------|------|------|------|------|
| Primary | 40px (lg: 44px) | 10px | 14px | `#3370FF` → hover `#2860E0` |
| Secondary | 40px | 10px | 14px | `#EEF4FF` + border `#3370FF` |
| Ghost | 40px | 10px | 14px | transparent |
| Gradient | 44px | 10px | 15px | linear-gradient(135°, #3370FF, #62D4C8) |

- Primary 按钮使用渐变变体时：`background: linear-gradient(135deg, #3370FF 0%, #62D4C8 100%)`
- 禁用态：`opacity: 0.5; cursor: not-allowed`

### 6.2 卡片

- 背景：`#FFFFFF`
- 圆角：16px（大卡片 22px）
- 阴影：默认 `--shadow-sm`，hover `--shadow-md`
- 内边距：16px（移动端）/ 24px（桌面端）
- hover 效果：`transform: translateY(-4px)` + 阴影加深，过渡 200ms ease

### 6.3 标签（Tag）

- 胶囊形态：`border-radius: 9999px`
- 字号：12px
- 内边距：`2px 12px`
- 配色：
  - 蓝色标签：bg `#EEF4FF` + text `#3370FF`
  - 绿色标签：bg `#D1FAE5` + text `#059669`
  - 橙色标签：bg `#FEF3C7` + text `#D97706`
  - 红色标签：bg `#FEE2E2` + text `#DC2626`
  - 紫色标签：bg `#EDE9FE` + text `#7C3AED`

### 6.4 输入框

- 高度：40px（large: 44px）
- 圆角：10px
- 边框：`1px solid #E8ECF1`，focus `#3370FF`
- 占位文字色：`#9CA3AF`

### 6.5 导航栏

- 高度：64px
- 背景：`#FFFFFF` + `--shadow-xs`
- Logo 区：左侧 24px 内边距
- 菜单项：选中态文字色 `#3370FF`，底部 2px 蓝色指示条
- 右侧：用户头像 + 通知图标 + 下拉菜单

### 6.6 渐变背景

Hero 区域使用蓝色渐变：
```css
background: linear-gradient(135deg, #3370FF 0%, #62D4C8 100%);
```
或浅色版本：
```css
background: linear-gradient(180deg, #EEF4FF 0%, #F5F8FF 100%);
```

---

## 7. 动效规范

| 场景 | 过渡 | 时长 | 缓动 |
|------|------|------|------|
| 按钮 hover | background-color | 200ms | ease |
| 卡片 hover | transform + box-shadow | 250ms | ease-out |
| 弹窗出现 | opacity + transform | 250ms | ease-out |
| 页面切换 | opacity | 200ms | ease |
| 标签切换 | underline | 200ms | ease |

- 不使用 bounce / elastic 等夸张弹性动画
- hover 上浮幅度：`translateY(-2px ~ -4px)`

---

## 8. 布局规范

### 8.1 页面宽度

- 最大宽度：`1280px`（内容区 `1200px`）
- 侧边栏宽度：`240px`（折叠 `64px`）
- 响应式断点：
  - `xs`: < 576px（手机）
  - `sm`: ≥ 576px
  - `md`: ≥ 768px（平板）
  - `lg`: ≥ 992px（小桌面）
  - `xl`: ≥ 1200px（桌面）
  - `xxl`: ≥ 1600px（大屏）

### 8.2 栅格

- 栅格列数：24（Ant Design 标准）
- 间距：`16px`（移动端）/ `24px`（桌面端）

### 8.3 页面结构

```
┌───────────────────────────────────┐
│           顶部导航栏 64px           │
├──────────┬────────────────────────┤
│          │                        │
│  侧边栏   │      主内容区域         │
│  240px   │      padding: 24px     │
│          │                        │
│          │      max-width: 1200px │
│          │                        │
└──────────┴────────────────────────┘
```

---

## 9. 图标规范

- 使用 `@ant-design/icons` 图标库
- 默认尺寸：`16px`（行内）/ `20px`（按钮内）/ `24px`（标题旁）
- 颜色跟随文本色，选中态跟随 `--color-primary`

---

## 10. Ant Design 主题映射

```js
const antdTheme = {
  token: {
    colorPrimary: '#3370FF',
    colorInfo: '#3370FF',
    colorSuccess: '#10B981',
    colorWarning: '#F59E0B',
    colorError: '#EF4444',
    borderRadius: 10,
    fontFamily: '"PingFang SC","Microsoft YaHei","Helvetica Neue",Helvetica,Arial,sans-serif',
    colorBgLayout: '#F5F8FF',
    colorBgContainer: '#FFFFFF',
  },
  components: {
    Button: { controlHeight: 40, borderRadius: 10 },
    Input: { controlHeight: 40, borderRadius: 10 },
    Card: { borderRadiusLG: 16 },
    Layout: { headerBg: '#FFFFFF', headerHeight: 64 },
    Menu: {
      itemBg: 'transparent',
      itemSelectedBg: '#EEF4FF',
      itemSelectedColor: '#3370FF',
    },
  },
};
```

---

## 11. 与 Datawhale.cn 官网的对齐要点

| 官网特征 | 我们的实现 |
|---------|-----------|
| 蓝色渐变 Hero 区 | 首页 Hero 使用 `linear-gradient(135deg, #3370FF, #62D4C8)` |
| 白色卡片 + 轻阴影 | 所有卡片统一使用 `--shadow-sm` + hover 上浮 |
| 胶囊标签 | 状态标签全部使用 `border-radius: 9999px` |
| 顶部固定导航 | 64px 白色导航栏 + 蓝色选中指示 |
| 响应式卡片网格 | 活动列表使用 `Row + Col` 响应式布局 |
| 渐变按钮 | CTA 按钮使用 `gradient-primary` class |

---

## 12. 命名规范

### 12.1 品牌名称

| 场景 | 写法 | 示例 |
|------|------|------|
| 品牌名（中文语境） | **Datawhale**（仅首字母大写，其余小写） | Datawhale 高校活动智能管理系统 |
| 品牌名（URL/域名） | datawhale.cn / datawhale 全小写 | https://www.datawhale.cn |
| 代码变量/常量 | `datawhale` 全小写 | `const datawhaleConfig = {}` |
| 目录/文件名 | `datawhale` 全小写 | `packages/datawhale-plugin` |
| NPM 包名 | `@datawhale/xxx` | `@datawhale/frontend` |

### 12.2 禁止使用

- ❌ **DataWhale**（驼峰大写 W）—— 已废弃，全局替换为 Datawhale
- ❌ **DATAWHALE**（全大写）—— 仅在极个别品牌强调场景使用，代码中禁止

### 12.3 检查机制

- git commit 前运行：`grep -r "DataWhale" --include="*.ts" --include="*.tsx" --include="*.md" .` 检查是否有违规写法
- CI 阶段可接入 husky pre-commit hook 自动拦截

---

## 13. 公共组件规范

> v1.1 引入。所有页面统一通过这些组件复用设计语言。新增页面**优先用公共组件**，不直接拼 AntD。

### 13.1 EmptyState（统一空状态）

- **文件**：`frontend/src/components/EmptyState.tsx`
- **样式**：`.dw-empty`（见 `styles.css`）
- **设计要点**：
  - 不放大字号、不加重动画 —— 跟列表同温
  - 标题 16px / 500，描述 13px secondary，操作按钮 ≤ 中等尺寸
  - 默认图标 `InboxOutlined`（蓝主色浅底），可自定义
- **用法**：
  ```tsx
  <EmptyState title="暂无活动" description="可以登记兴趣或申请成为组织者" />
  <EmptyState title="暂无申请" action={<Button type="primary">立即申请</Button>} />
  ```

### 13.2 PageHeader（统一页面头）

- **文件**：`frontend/src/components/PageHeader.tsx`
- **样式**：`.dw-page-header` / `.dw-page-header__title` / `.dw-page-header__subtitle` / `.dw-page-header__back`
- **设计要点**：
  - 标题 28px / 600（沿用 §2.2 h2），副标题 14px secondary
  - 返回按钮在标题上方，弱化（13px 主蓝色，无边框）
  - 右侧 action 区（按钮组 / Tab）靠右对齐
  - **不替代页面内的 Section 标题**（区块标题用 `.dw-section-title`）
- **用法**：
  ```tsx
  <PageHeader title="活动大厅" subtitle="浏览所有可参与的活动" />
  <PageHeader title="审批详情" onBack={() => navigate(-1)} action={<Button>通过</Button>} />
  ```

### 13.3 BlobBg（Hero 装饰球）

- **文件**：`frontend/src/components/BlobBg.tsx`
- **样式**：`.dw-blob` + `.dw-blob--1/2`
- **设计要点**：
  - **不喧宾夺主**：opacity 0.25-0.35，blur 40-60px
  - **不引入新色**：只用 §1.1-1.4 已定义的蓝 (#62D4C8) / 紫 (#A679FF)
  - `pointer-events: none`，不挡点击
  - **不带动画**（避免 AI 味道；用户没要求 motion）
- **用法**：
  ```tsx
  <div className="dw-hero">
    <BlobBg variant="landing" />
    <div className="dw-hero__inner">...</div>
  </div>
  ```

### 13.4 ErrorState（统一错误状态）

- **文件**：`frontend/src/components/ErrorState.tsx`
- **样式**：`.dw-error`
- **设计要点**：
  - 浅红底 `#FEF2F2` + 红文字 `#991B1B`，跟 §1.3 错误色对齐
  - 跟 EmptyState 风格统一（不夸张）
  - 默认带「重试」按钮（可关闭）
- **用法**：
  ```tsx
  <ErrorState title="加载失败" description="网络异常，请稍后重试" onRetry={load} />
  ```

### 13.5 角色 Tag（v1.1 改造）

- 顶部导航角色 Tag 不再用 AntD `color="red"`，改用 `<span class="dw-tag dw-tag-{color}">`
- 颜色映射（见 `frontend/src/styles/tokens.ts` `rolePalette`）：

| 角色 | dw-tag class | 视觉 |
|------|-------------|------|
| ADMIN | `dw-tag-red` | 红胶囊 |
| OPERATOR | `dw-tag-orange` | 橙胶囊 |
| VOLUNTEER | `dw-tag-blue` | 蓝胶囊 |
| ORGANIZER | `dw-tag-green` | 绿胶囊 |
| PARTICIPANT | `dw-tag-blue` | 蓝胶囊（与志愿者同色，文字区分） |
| ASSISTANT | `dw-tag-purple` | 紫胶囊 |

---

## 14. 已实现样式清单

> 反向登记 `frontend/src/styles.css` 全局类，方便查找 + 防止重复实现。

| 类名 | 用途 | 关联 design.md 节 |
|------|------|-------------------|
| `.dw-hero` | 蓝色渐变 Hero 区 | §6.6 |
| `.dw-hero-soft` | 浅色版 Hero（淡蓝白渐变） | §6.6 |
| `.dw-hero__inner` | Hero 内容包裹（zIndex 在装饰球之上） | §13.3 |
| `.dw-gradient-btn` | 渐变主按钮（CTA 场景） | §6.1 |
| `.dw-card` | 标准卡片（hover 上浮） | §6.2 |
| `.dw-card-flat` | 平面卡片（边框 + 弱阴影） | §6.2 |
| `.dw-tag` + `.dw-tag-{color}` | 胶囊标签（6 色） | §6.3 |
| `.dw-header` | 顶部导航栏（sticky + 阴影） | §6.5 |
| `.dw-page` | 页面内容容器（maxWidth 1200） | §8.1 |
| `.dw-page-header` / `__title` / `__subtitle` / `__back` | 页面头（统一 4 子元素） | §13.2 |
| `.dw-section-title` | 区块标题（20px / 600） | §2.2 |
| `.dw-blob` / `.dw-blob--1/2` | 渐变装饰球（Hero 内） | §13.3 |
| `.dw-stat-card` | 数据卡（Hero 下方 / 角色入口） | v1.1 |
| `.dw-stat-card__icon` + 4 变体 | 数据卡图标底色 | v1.1 |
| `.dw-role-entry` | 5 角色 Landing 入口卡 | v1.1 |
| `.dw-role-entry__item` | 入口子项 | v1.1 |
| `.dw-empty` / `__icon` / `__title` / `__desc` | 空状态（4 子元素） | §13.1 |
| `.dw-error` / `__title` / `__desc` | 错误状态 | §13.4 |
| `.dw-fade-in` | 淡入（克制使用，250ms） | §7 |
| `.dw-pulse-soft` | 弱脉动（2.4s，仅加载场景） | §7 |
| `@media (max-width: 768px)` | 移动端微调 | §8.1 |

---

## 15. v1.1 变更记录

> 跟代码同步，每次 UI 调整追加一条。

- **v1.1（2026-08-25）**：建立 `styles/tokens.ts` 单一 token 源；styles.css 增强到 11KB（新增 EmptyState / PageHeader / BlobBg / ErrorState 4 公共组件 + dw-hero-soft / dw-stat-card / dw-role-entry / dw-blob 等 15 个新类）；Layout.tsx 角色 Tag 改用 `dw-tag` 系列（脱离 AntD 默认色）；main.tsx AntD 主题改用 `tokens.ts.antdTheme`。

---

## 16. 暗色模式（v1.2 引入 · 行业前沿 v2 标配）

> v1.2 引入。**实现完整、可用**（不只是 CSS 框架层面，组件层面也全部适配）。

### 16.1 触发方式

- 顶部导航右侧 ☀/🌙 按钮切换（`<ThemeToggle>`）
- 状态持久化到 localStorage（`datawhale-theme`），刷新不丢
- 监听系统级 `prefers-color-scheme` 媒体查询可后续接入（v1.2 暂未做）

### 16.2 技术实现

- **store**：`src/store/theme.ts`（zustand + persist）
  - `mode: 'light' | 'dark'`
  - `setMode()` / `toggle()` / 同步 `documentElement.dataset.theme`
- **AntD 主题**：`antdThemeFor(mode)` 动态生成
  - `light` → `defaultAlgorithm` + design.md §1 token
  - `dark` → `darkAlgorithm` + 深色调整 token（`colorBgLayout: #0F172A` / `colorBgContainer: #1E293B` / `colorText: #F1F5F9`）
- **CSS**：`[data-theme='dark']` 选择器覆盖 CSS 变量 + 关键组件

### 16.3 颜色对照表

| 元素 | 浅色 | 深色 |
|------|------|------|
| 页面背景 | `#F5F8FF` | `#0F172A` |
| 卡片/容器 | `#FFFFFF` | `#1E293B` |
| 边框 | `#E8ECF1` | `#334155` |
| 主文字 | `#1A1A2E` | `#F1F5F9` |
| 次文字 | `#6B7280` | `#94A3B8` |
| 蓝标签 bg | `#EEF4FF` | `rgba(51,112,255,0.18)` |
| 蓝标签 fg | `#3370FF` | `#93C5FD` |
| 绿标签 bg | `#D1FAE5` | `rgba(16,185,129,0.18)` |
| 渐变 Hero | 不变 | 不变（保持品牌识别） |
| 渐变球 opacity | 0.35 | 0.20（深色下避免过亮） |
| 阴影 | rgba(51,112,255,0.08) | rgba(0,0,0,0.30) |

### 16.4 切换过渡

```css
body, .ant-layout, .dw-card, .dw-stat-card, .dw-role-entry,
.ant-table-thead > tr > th, .dw-header,
.ant-modal-content, .ant-drawer-content {
  transition: background-color 200ms ease, border-color 200ms ease, color 200ms ease;
}
```

200ms ease，**不**用 bouncy / elastic。

### 16.5 设计原则

- **不引入新色**：所有深色用色都在 design.md §1 已有色域内（蓝/绿/紫/橙 + 灰阶）
- **品牌识别不变**：渐变 Hero、渐变按钮、渐变 logo 块在两套主题保持一致
- **可访问性**：所有文字 + 背景对比度满足 WCAG AA（≥ 4.5:1）

---

## 17. 公共页面（v1.2 新增）

> 行业前沿：每个 SaaS 都该有的 4 类"系统页面"。

### 17.1 NotFound（404）

- **文件**：`src/pages/NotFound.tsx`
- **设计要点**：
  - 96px 渐变数字（404）+ 友好文案
  - 路径 `<Text code>` 显示给用户对照
  - 搜索框：直接跳到活动大厅 + keyword 参数
  - "回到活动大厅" / "返回上一页" 双按钮
  - 4-6 个常用入口（按 role 过滤）
  - 暗色模式全适配（色板 `pal` 实时切换）
- **路由**：`path: '*'`

### 17.2 403（RoleGuard）

- **文件**：`src/router/index.tsx`（RoleGuard 内部）
- **设计要点**：
  - 96px 渐变数字（403，**橙红渐变**区别 404）
  - 明确告知"该页面仅限 X 角色；您当前是 Y"
  - "回到活动大厅" 按钮
- **触发**：`<RoleGuard allow={...}>` 不匹配时

### 17.3 待补（v1.3 计划）

- **500 / 网络错误页**（ErrorBoundary 包装）
- **网络断开提示**（监听 `navigator.onLine`）
- **维护中页面**（开关控制）

---

## 18. 表格 + 表单精修（v1.2 行业前沿）

### 18.1 表格（Linear / Stripe 风格）

- 表头：`#F5F8FF` 背景 + 12px 灰色 500 weight + letter-spacing 0.02em
- 行 hover：`#F8FAFF` 浅蓝（不要条纹）
- 单元格 padding 14px 16px（比 AntD 默认 8px 宽，**更舒展**）
- 暗色：表头 `#0F172A` / 行 hover `rgba(51,112,255,0.06)`
- **不**引入斑马纹（条纹在 2026 已不流行）

### 18.2 表单

- 必填星号：`#EF4444`（AntD 默认红色调暗一档，跟 design.md §1.3 一致）
- 错误文字：12px / `#EF4444` / `marginTop: 2px`
- Label：font-weight 500（比 AntD 默认 400 略粗，**层级更清晰**）
- 焦点环：3px `rgba(51,112,255,0.10)`（柔和不刺眼）

### 18.3 全局 Focus Ring（可访问性）

```css
*:focus-visible {
  outline: 2px solid rgba(51, 112, 255, 0.45);
  outline-offset: 2px;
  border-radius: 6px;
}
.ant-btn:focus-visible,
.ant-input:focus-visible,
.ant-input-affix-wrapper:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(51, 112, 255, 0.18);
}
```

---

## 19. 响应式强化（v1.2）

| 断点 | 触发条件 | 主要调整 |
|------|----------|----------|
| `md` | ≤ 768px | Hero 缩小 / 页面 padding 16px / Header 简化 / 表格横滚 |
| `sm` | ≤ 480px | Hero 字号 24px / 统计卡图标缩小 / 隐藏 Header 副标题 |

---

## 20. v1.2 变更记录（2026-08-25 · 行业前沿标准打磨）

- **新增**：`src/store/theme.ts`（zustand 主题 store + AntD ThemeConfig 动态生成）
- **新增**：`src/components/ThemeToggle.tsx`（顶部 ☀/🌙 切换按钮）
- **新增**：`src/pages/NotFound.tsx`（404 兜底：渐变数字 + 搜索 + 4-6 入口 + dark 全适配）
- **新增**：`frontend/scripts/screenshot_no_auth.py`（无后端截图脚本：Login/Register/404 × light/dark = 6 张）
- **新增**：`frontend/scripts/screenshot_5roles.py`（5 角色 Landing 截图脚本，待 backend 起来后跑）
- **修**：`src/router/index.tsx`（404 改用 NotFound；403 用渐变数字 + 角色说明，脱离 AntD Result 默认样式）
- **修**：`src/components/Layout.tsx`（Logo 文字/Bell/用户名 改用 dw-header__* class，配合暗色切换；Header 加 ThemeToggle）
- **修**：`src/components/AuthBrand.tsx`（订阅 themeStore，inline style 实时切色）
- **修**：`src/components/ThemeToggle.tsx`（图标 + 颜色用 dw-header__icon class）
- **修**：`src/pages/NotFound.tsx`（订阅 themeStore，标题/入口卡片/图标颜色实时切）
- **修**：`src/main.tsx`（用 App 组件 + themeStore 订阅 + AntD ConfigProvider 动态 theme）
- **修**：`src/styles.css`（+250 行：暗色模式全套 + 表格精修 + focus ring + form 精修 + 响应式强化 + 滚动条）
- **修**：`frontend/tsconfig.json`（`types: ["node", "vitest/globals"]`）+ 装 `@types/node`（**v1.0.0 baseline 一直 build fail 的根因**）
- **修**：`src/services/api.ts`（Activity.groupQrCode + reviewStatus/operatorReviewStatus 加 'UNCERTAIN'，跟 v16.7 后端状态机对齐）
- **修**：`src/pages/message/Inbox.tsx`（Text ellipsis → Paragraph ellipsis，antd 5 EllipsisConfig 兼容）
- **改写**：5 核心页面（MyApplications / MyRegistrations / VolunteerWorkbench / ReimbursementCenter / ApprovalWorkbench）散落 `<Title>` + `<Text>` → 统一 `<PageHeader>`（design.md §13.2 落地）
- **CSS 产物**：dist/assets/index-*.css 16.6KB（gzip 4.38KB），比 v1.1 增加 6KB
- **测试**：vitest 8 files / 110 tests 全过
- **typecheck**：0 错误（v1.0.0 baseline 一直 19 错误，已全部修完）
- **build**：✅ 成功（v1.0.0 baseline 一直 fail，已修通）
- **截图**：`C:\Users\15088\AppData\Local\Temp\datawhale_screenshots\v1.2_ui\` 6 张（Login/Register/404 × light/dark）
