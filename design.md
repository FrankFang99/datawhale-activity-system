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
