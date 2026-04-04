# 从零构建：一个电商财务数据清洗工具的技术实现

## 背景

业务需求是做抖音、淘宝、天猫、京东等电商平台的账单对账和财务数据清洗。财务人员导出的账单格式混乱，需要一个工具来完成：格式清洗、多平台合并、退款损失计算、品牌返利汇总等操作。

**核心痛点：**
- 平台导出的账单格式不统一（日期格式、金额格式、空行空列）
- 多平台账单需要手动合并，列名不对齐
- 退款后佣金损失难以计算
- 每月底对账重复劳动量大

最终交付了一个桌面应用，覆盖数据处理、SKU映射、收款对账、账单对账、品牌返利、月度汇总六大功能模块。

---

## 技术选型

### 为什么用 Electron + React + Vite

| 技术 | 选择理由 |
|------|---------|
| **Electron** | 跨平台（Windows/Mac），前端团队可快速上手 |
| **React + TypeScript** | 组件化，类型安全，生态成熟 |
| **Vite** | 开发体验好，热更新快，构建速度快 |
| **Tailwind CSS** | 快速样式开发，不需要写 CSS 文件 |
| **xlsx (SheetJS)** | Excel/CSV 解析，纯 JS 实现，无需本地库 |

### 架构决策

```
Electron 进程模型：

┌─────────────────────────────────┐
│  Main Process (main.cjs)        │
│  - 窗口管理                      │
│  - 文件对话框                    │
│  - 本地文件读写 (fs)             │
└──────────────┬──────────────────┘
               │ IPC (contextBridge)
┌──────────────▼──────────────────┐
│  Preload Script (preload.cjs)   │
│  - 暴露安全的 API 给渲染进程       │
│  - window.electronAPI            │
└──────────────┬──────────────────┘
               │
┌──────────────▼──────────────────┐
│  Renderer Process (React App)     │
│  - 无 Node.js 访问权限            │
│  - 只通过 electronAPI 通信        │
│  - src/ 目录                     │
└─────────────────────────────────┘
```

**关键设计原则：主进程负责所有本地 IO，渲染进程绝不直接操作文件系统。**

---

## 项目结构

```
data-cleaner/
├── electron/
│   ├── main.ts          # Electron 主进程
│   └── preload.ts        # 预加载脚本（contextBridge）
├── src/
│   ├── App.tsx           # 主组件，所有 Tab 逻辑 (~1000行)
│   ├── main.tsx          # React 入口
│   ├── components/
│   │   ├── Toolbar.tsx        # 工具栏按钮组
│   │   ├── DataTable.tsx      # 数据表格展示
│   │   ├── FileSidebar.tsx    # 文件列表
│   │   ├── MonthlySummary.tsx  # 月度汇总 Tab
│   │   ├── Toast.tsx          # 操作结果提示
│   │   ├── ConfirmDialog.tsx   # 操作确认对话框
│   │   ├── ExportPanel.tsx     # 导出格式选择
│   │   └── MergePreview.tsx    # 合并预览
│   ├── services/
│   │   ├── businessLogic.ts   # 业务逻辑（账单解析、平台检测）
│   │   └── dataProcessor.ts   # 数据处理（去重、清洗）
│   └── utils/
│       ├── desktop.ts    # ElectronAPI 封装层
│       └── excel.ts     # xlsx 封装（读写 CSV/Excel）
├── templates/            # 各平台账单模板
└── package.json
```

---

## 核心模块实现

### 1. IPC 通信设计

**平台检测**（businessLogic.ts）：

```typescript
export function detectPlatform(fileName: string): string {
  const name = fileName.toLowerCase()
  if (name.includes('taobao') || name.includes('淘宝')) return '淘宝'
  if (name.includes('tmall') || name.includes('天猫')) return '天猫'
  if (name.includes('jd') || name.includes('京东')) return '京东'
  if (name.includes('douyin') || name.includes('抖音')) return '抖音电商'
  if (name.includes('kuaishou') || name.includes('快手')) return '快手电商'
  if (name.includes('pinduoduo') || name.includes('拼多多')) return '拼多多'
  if (name.includes('xiaohongshu') || name.includes('小红书')) return '小红书'
  return '其他'
}
```

**账单解析**使用关键词匹配，自动识别列名变体：

```typescript
export function findCol(headers: string[], keywords: string[]): number {
  return headers.findIndex(h =>
    keywords.some(kw => h.toLowerCase().includes(kw.toLowerCase()))
  )
}
```

**退款损失计算**：

```typescript
// 估算佣金损失：按平均佣金率
const avgCommRate = billRecords.reduce((s, b) => s + b.commission, 0)
  / Math.max(1, billRecords.reduce((s, b) => s + b.totalAmount, 0))

records.forEach(r => {
  r.commissionLost = r.refundAmount * avgCommRate
})
```

### 2. CSV 编码处理（踩坑记录）

**问题**：中文 Excel 导出的 CSV 通常是 GBK 编码，直接用 UTF-8 解析会乱码。

**解决**：自动检测编码，依次尝试 UTF-8 → GBK → GB18030：

```typescript
function detectAndDecodeBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    return new TextDecoder('utf-8').decode(bytes)
  } catch {
    try {
      new TextDecoder('gbk', { fatal: true }).decode(bytes)
      return new TextDecoder('gbk').decode(bytes)
    } catch {
      return new TextDecoder('gb18030').decode(bytes)
    }
  }
}
```

### 3. 数据合并的列名智能对齐

**问题**：多平台账单列名不完全一样，"订单金额"和"销售额"其实是同一个字段。

**解决**：smartMergeHeaders 自动按列名分组，只显示差异：

```typescript
export function smartMergeHeaders(files: FileData[]): MergePreviewResult {
  const columnMap = new Map<string, { sources: string[]; sourceIndices: number[] }>()

  files.forEach((file, _fileIdx) => {
    file.headers.forEach((col, colIdx) => {
      const key = col.trim()
      if (!columnMap.has(key)) {
        columnMap.set(key, { sources: [], sourceIndices: [] })
      }
      columnMap.get(key)!.sources.push(file.name)
      columnMap.get(key)!.sourceIndices.push(colIdx)
    })
  })
  // ...
}
```

### 4. 合并预览防止用户误操作

```typescript
const handleMergeWithPreview = useCallback(() => {
  const { unifiedHeaders, columnInfo, totalRows } = smartMergeHeaders(files)
  setMergePreview({ unifiedHeaders, columnInfo, totalRows })
}, [files])

// 用户确认后才真正执行合并
const handleConfirmMerge = useCallback(() => {
  const merged = executeSmartMerge(files, mergePreview.columnInfo)
  setMergedData(merged)
  setCurrentData(merged)
  saveHistory(merged, mergePreview.unifiedHeaders)
  setMergePreview(null)
  showToast(`合并完成`, "success")
}, [mergePreview, files, saveHistory])
```

---

## 构建配置

### Vite + Electron 插件配置

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import nodePolyfills from 'vite-plugin-node-polyfills'

export default defineConfig({
  plugins: [
    electron([
      {
        entry: 'electron/main.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: { output: { entryFileNames: '[name].cjs' } }
          }
        }
      },
      {
        entry: 'electron/preload.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: { output: { entryFileNames: '[name].cjs' } }
          }
        }
      }
    ]),
    renderer(),
    nodePolyfills({ globals: { Buffer: true } })
  ]
})
```

### ESM / CommonJS 边界处理

**踩坑**：package.json 添加 `"type": "module"` 后，Electron 主进程报 `require is not defined`。

**原因**：Electron 主进程必须是 CommonJS，但 Vite 默认输出 ESM。

**解决**：Vite 构建时强制输出 `.cjs` 文件，package.json main 指向 `.cjs`：

```json
{
  "type": "module",
  "main": "dist-electron/main.cjs"
}
```

### electron-builder 配置

```json
{
  "build": {
    "mac": { "target": "dir", "sign": false },
    "win": {
      "target": [{ "target": "nsis", "arch": ["x64"] }],
      "icon": "public/icon.ico"
    },
    "nsis": { "oneClick": false, "allowToChangeInstallationDirectory": true }
  }
}
```

**国内构建加速**：设置 Electron 镜像：

```bash
ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/" npx electron-builder --win
```

---

## 打包后空白屏幕问题排查

**问题**：本地开发正常，打包后打开白屏。

**排查过程**：
1. DevTools 检查 Console：无错误
2. 检查 window.electronAPI：undefined
3. 打包后的 `app.asar` 和 `Info.plist` 有 `ElectronAsarIntegrity` 哈希
4. 原因：electron-builder 打包后哈希不匹配，导致 asar 加载失败

**解决**：移除 `Info.plist` 中的 `ElectronAsarIntegrity` 字段：

```bash
PlistBuddy -x -c "Delete :ElectronAsarIntegrity" Info.plist
```

---

## 财务功能实现思路

### 退款损失还原

```typescript
// 实际损失 = 退款金额 + 预估佣金损失
// 佣金损失 = 退款金额 × 平均佣金率
// 平均佣金率 = Σ佣金 / Σ账单金额
```

### 品牌阶梯返利（累进计算）

```typescript
const calculateRebate = (gmvWan: number, tiers: RebateTier[]) => {
  let remaining = gmvWan
  let totalRebate = 0

  for (const tier of tiers) {
    if (remaining <= 0) break
    const applicable = Math.min(remaining, tier.max - tier.min)
    if (applicable > 0) {
      totalRebate += (applicable * tier.rate) / 100
      remaining -= applicable
    }
  }
  return { totalRebate }
}
```

---

## 总结

### 技术亮点

1. **进程隔离**：主进程负责 IO，渲染进程无法直接访问 Node.js API，安全性好
2. **编码自适应**：CSV 导入自动检测 GBK/GB18030，解决中文乱码问题
3. **操作确认机制**：所有破坏性操作（去重、清空）都有确认提示，降低误操作风险
4. **合并预览**：多文件合并前可视化列名对比，合并结果可预期

### 可改进方向

1. 增加数据校验（金额负数、日期格式错误等）
2. 增加操作历史日志
3. 增加快捷键支持
4. 支持更多平台（亚马逊、Shopee等）
5. 数据可视化（图表）

---

## 源码地址

（待补充）

---

*如果你也在做类似的数据处理工具，欢迎交流。*
