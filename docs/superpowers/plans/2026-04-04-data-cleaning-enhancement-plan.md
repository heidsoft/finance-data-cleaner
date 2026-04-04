# 数据处理 Tab 体验优化实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为「数据处理」Tab 增加操作确认、预览、格式选择和结果反馈，提升财务人员使用体验。

**Architecture:** 通过新增 4 个专用组件（Toast、ConfirmDialog、ExportPanel、MergePreview）实现操作前确认、结果反馈和格式选择，所有新组件通过 App.tsx 统一状态管理。

**Tech Stack:** React hooks, Lucide icons, Tailwind CSS

---

## 文件结构

```
src/components/
  Toast.tsx         # 新增：操作结果 toast 通知
  ConfirmDialog.tsx  # 新增：操作确认对话框
  ExportPanel.tsx   # 新增：导出格式选择面板
  MergePreview.tsx  # 新增：合并预览组件
  Toolbar.tsx       # 修改：集成确认对话框触发、导出面板
  FileSidebar.tsx   # 不变
  DataTable.tsx     # 不变
  StatusBar.tsx     # 不变
  MonthlySummary.tsx # 不变

src/App.tsx         # 修改：新增 toast/confirm/mergePreview 状态，集成新组件
src/services/dataProcessor.ts  # 新增：smartMergeHeaders() 列名智能对齐
```

---

## Task 1: Toast 组件

**Files:**
- Create: `src/components/Toast.tsx`
- Modify: `src/App.tsx` (添加 toast 状态和使用)
- Test: 手动运行 `npm run dev`，导入文件后执行去重操作，观察 toast 是否显示

- [ ] **Step 1: 创建 Toast 组件**

```tsx
// src/components/Toast.tsx
import { useEffect } from "react";
import { CheckCircle, AlertCircle, XCircle, X } from "lucide-react";

export interface ToastMessage {
  id: string;
  type: "success" | "warning" | "error";
  message: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export default function Toast({ toasts, onDismiss }: ToastProps) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }: { toast: ToastMessage; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 3000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const icons = {
    success: <CheckCircle size={16} className="text-green-500" />,
    warning: <AlertCircle size={16} className="text-yellow-500" />,
    error: <XCircle size={16} className="text-red-500" />,
  };

  const bg = {
    success: "bg-green-50 border-green-200",
    warning: "bg-yellow-50 border-yellow-200",
    error: "bg-red-50 border-red-200",
  };

  return (
    <div className={`flex items-center gap-2 px-4 py-3 rounded-lg border shadow-lg ${bg[toast.type]} min-w-64`}>
      {icons[toast.type]}
      <span className="text-sm text-gray-700 flex-1">{toast.message}</span>
      <button onClick={() => onDismiss(toast.id)} className="text-gray-400 hover:text-gray-600">
        <X size={14} />
      </button>
    </div>
  );
}
```

- [ ] **Step 2: 在 App.tsx 中添加 toast 状态**

在 App.tsx 的 useState 区域添加：
```tsx
const [toasts, setToasts] = useState<ToastMessage[]>([]);

// 在 reportError 函数附近添加：
const showToast = useCallback((message: string, type: ToastMessage["type"] = "success") => {
  const id = Date.now().toString();
  setToasts((prev) => [...prev, { id, type, message }]);
}, []);

const dismissToast = useCallback((id: string) => {
  setToasts((prev) => prev.filter((t) => t.id !== id));
}, []);

// 将 reportError 中的 console.error + setRuntimeNotice 改为 showToast("xxx", "error")
// 但保留 setRuntimeNotice，因为 runtimeNotice 是更严重的提示
```

- [ ] **Step 3: 在 App.tsx JSX 中添加 Toast 组件**

在 App.tsx return 的最外层 div 末尾（StatusBar 下方）添加：
```tsx
<Toast toasts={toasts} onDismiss={dismissToast} />
```

- [ ] **Step 4: 测试**

运行 `npm run dev`，导入文件，执行去重操作，观察 toast 是否在右下角显示并 3 秒后消失。

- [ ] **Step 5: 提交**

```bash
git add src/components/Toast.tsx src/App.tsx
git commit -m "feat: add Toast component for operation feedback"
```

---

## Task 2: ConfirmDialog 组件

**Files:**
- Create: `src/components/ConfirmDialog.tsx`
- Modify: `src/App.tsx` (添加 confirm 状态)
- Modify: `src/components/Toolbar.tsx` (接收 onConfirm 回调)
- Test: 手动运行，点击去重按钮，观察是否弹出确认对话框

- [ ] **Step 1: 创建 ConfirmDialog 组件**

```tsx
// src/components/ConfirmDialog.tsx
import { AlertTriangle } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmClassName?: string;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "确认",
  cancelLabel = "取消",
  onConfirm,
  onCancel,
  confirmClassName = "bg-blue-600 hover:bg-blue-700",
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onCancel}>
      <div className="bg-white rounded-xl shadow-2xl w-96 p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3 mb-4">
          <AlertTriangle size={20} className="text-yellow-500 mt-0.5" />
          <div>
            <h3 className="font-semibold text-gray-800">{title}</h3>
            <p className="text-sm text-gray-600 mt-1">{message}</p>
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-white rounded-lg text-sm ${confirmClassName}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 在 Toolbar.tsx 中将操作改为受控（通过回调确认）**

将 Toolbar.tsx 的 `onDeduplicate`、`onCleanEmpty` 等改为显示确认对话框而非直接执行。

在 Toolbar.tsx 中添加：
```tsx
const [confirmAction, setConfirmAction] = useState<{
  title: string;
  message: string;
  onConfirm: () => void;
  confirmLabel?: string;
  confirmClassName?: string;
} | null>(null);
```

将各个按钮的 onClick 改为包装函数，例如：
```tsx
<button
  onClick={() => {
    const rowCount = dataRows.length;
    setConfirmAction({
      title: "确认去重",
      message: `将删除 ${rowCount - uniqueRows.length} 行重复数据，保留 ${uniqueRows.length} 行。`,
      onConfirm: () => {
        onDeduplicate(dedupCol);
        setConfirmAction(null);
      },
    });
  }}
  ...
```

实际上 Toolbar 需要知道 dataRows 才能计算。更好的方案是让 Toolbar 接收一个 `dataRows` 参数，或者干脆在 App.tsx 层做确认。

**推荐方案：在 App.tsx 层做确认，Toolbar 保持原样（接收 callback），App.tsX 调用时先弹出确认框，用户确认后才调用 Toolbar 的 callback。**

- [ ] **Step 3: 在 App.tsx 中添加 confirm 状态并包装操作函数**

添加：
```tsx
const [confirmDialog, setConfirmDialog] = useState<{
  title: string;
  message: string;
  onConfirm: () => void;
  confirmLabel?: string;
  confirmClassName?: string;
} | null>(null);
```

在 handleDeduplicate 调用前加确认：
```tsx
const handleDeduplicateWithConfirm = useCallback(() => {
  if (currentData.length === 0) return;
  const headers = currentData[0];
  const dataRows = currentData.slice(1);
  // 计算会删除多少行
  const seen = new Set();
  const uniqueRows = dataRows.filter(row => {
    const key = dedupCol >= 0 ? row[dedupCol] : JSON.stringify(row);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const removed = dataRows.length - uniqueRows.length;

  setConfirmDialog({
    title: "确认去重",
    message: removed > 0
      ? `将删除 ${removed} 行重复数据，保留 ${uniqueRows.length} 行。`
      : "没有发现重复行，无需去重。",
    onConfirm: () => {
      handleDeduplicate(dedupCol);
      setConfirmDialog(null);
      showToast(`去重完成：删除了 ${removed} 行`, "success");
    },
    confirmClassName: "bg-orange-500 hover:bg-orange-600",
  });
}, [currentData, dedupCol]);
```

对 handleCleanEmpty、handleTrimWhitespace、handleStandardizeDate、handleFillEmpty、handleSelectColumns 也做类似包装。

- [ ] **Step 4: 在 App.tsx JSX 中添加 ConfirmDialog**

```tsx
<ConfirmDialog
  open={confirmDialog !== null}
  title={confirmDialog?.title || ""}
  message={confirmDialog?.message || ""}
  confirmLabel={confirmDialog?.confirmLabel}
  confirmClassName={confirmDialog?.confirmClassName}
  onConfirm={confirmDialog?.onConfirm || (() => {})}
  onCancel={() => setConfirmDialog(null)}
/>
```

- [ ] **Step 5: 修改 Toolbar Props，将 onDeduplicate 等改为需要确认的版本**

在 App.tsx 的 Toolbar 使用处，将 `onDeduplicate={handleDeduplicate}` 改为 `onDeduplicate={handleDeduplicateWithConfirm}`，以此类推。

- [ ] **Step 6: 测试**

运行 `npm run dev`，导入文件，点击去重按钮，确认是否弹出确认对话框。

- [ ] **Step 7: 提交**

```bash
git add src/components/ConfirmDialog.tsx src/App.tsx src/components/Toolbar.tsx
git commit -m "feat: add ConfirmDialog for operation confirmation"
```

---

## Task 3: 操作结果 Toast 反馈

**Files:**
- Modify: `src/App.tsx`
- Test: 手动运行，各操作完成后是否显示对应 toast

**前置：** Task 1 必须完成。

- [ ] **Step 1: 在各操作的 onConfirm 回调中添加 showToast**

例如去重：
```tsx
showToast(`去重完成：删除了 ${removed} 行重复数据`, "success");
```

每个操作的确认回调都应该有对应的成功 toast：
- 去重：✅ 去重完成，删除了 N 行
- 清空：✅ 清空完成，删除了 N 行空行、M 列空列
- Trim：✅ Trim 完成，N 行已去除空格
- 日期规范化：✅ 日期格式已标准化
- 填空值：✅ 已填充 M 个空单元格
- 选列：✅ 已保留 N 列

- [ ] **Step 2: 测试**

运行 `npm run dev`，执行各操作，观察 toast 提示是否正确。

- [ ] **Step 3: 提交**

```bash
git add src/App.tsx
git commit -m "feat: add toast feedback for all operations"
```

---

## Task 4: 导出格式选择面板

**Files:**
- Create: `src/components/ExportPanel.tsx`
- Modify: `src/App.tsx` (添加 export panel 状态)
- Test: 手动运行，点击导出按钮，观察是否显示格式选择

- [ ] **Step 1: 创建 ExportPanel 组件**

```tsx
// src/components/ExportPanel.tsx
import { Download } from "lucide-react";

interface ExportPanelProps {
  open: boolean;
  onExport: (format: "xlsx" | "csv", encoding?: "utf-8" | "gbk", delimiter?: string) => void;
  onCancel: () => void;
}

export default function ExportPanel({ open, onExport, onCancel }: ExportPanelProps) {
  const [format, setFormat] = useState<"xlsx" | "csv">("xlsx");
  const [encoding, setEncoding] = useState<"utf-8" | "gbk">("utf-8");
  const [delimiter, setDelimiter] = useState<"," | "\t">(",");

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onCancel}>
      <div className="bg-white rounded-xl shadow-2xl w-80 p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Download size={18} />
          导出数据
        </h3>

        <div className="mb-4">
          <label className="text-sm text-gray-600 mb-2 block">文件格式</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" value="xlsx" checked={format === "xlsx"} onChange={() => setFormat("xlsx")} />
              <span className="text-sm">Excel (.xlsx)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" value="csv" checked={format === "csv"} onChange={() => setFormat("csv")} />
              <span className="text-sm">CSV (.csv)</span>
            </label>
          </div>
        </div>

        {format === "csv" && (
          <>
            <div className="mb-4">
              <label className="text-sm text-gray-600 mb-2 block">编码</label>
              <select
                value={encoding}
                onChange={(e) => setEncoding(e.target.value as "utf-8" | "gbk")}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="utf-8">UTF-8（推荐）</option>
                <option value="gbk">GBK（兼容 Excel）</option>
              </select>
            </div>
            <div className="mb-4">
              <label className="text-sm text-gray-600 mb-2 block">分隔符</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" value="," checked={delimiter === ","} onChange={() => setDelimiter(",")} />
                  <span className="text-sm">逗号 ,</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" value="\t" checked={delimiter === "\t"} onChange={() => setDelimiter("\t")} />
                  <span className="text-sm">制表符 Tab</span>
                </label>
              </div>
            </div>
          </>
        )}

        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm">
            取消
          </button>
          <button
            onClick={() => onExport(format, encoding, delimiter)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
          >
            导出
          </button>
        </div>
      </div>
    </div>
  );
}
```

注意：需要在文件顶部添加 `useState` import。

- [ ] **Step 2: 在 App.tsx 中添加导出面板状态和包装函数**

```tsx
const [showExportPanel, setShowExportPanel] = useState(false);

const handleExportWithPanel = useCallback(() => {
  if (currentData.length === 0) return;
  setShowExportPanel(true);
}, [currentData]);

const handleDoExport = useCallback(async (format: "xlsx" | "csv", encoding?: "utf-8" | "gbk", delimiter?: string) => {
  if (currentData.length === 0) return;
  setShowExportPanel(false);
  try {
    const defaultName = format === "csv"
      ? `清洗后数据.${encoding === "gbk" ? "csv" : "csv"}`
      : `清洗后数据.xlsx`;
    const result = await saveDataFile(defaultName);
    if (!result.canceled && result.filePath) {
      // 传递 encoding 和 delimiter 到 exportToCSV
      if (format === "csv") {
        await exportToCSV(currentData, result.filePath, encoding, delimiter);
      } else {
        await exportToExcel(currentData, result.filePath);
      }
      showToast(`导出成功：${result.filePath.split("/").pop()}`, "success");
    }
  } catch (error) {
    reportError("导出数据", error);
  }
}, [currentData, reportError]);
```

- [ ] **Step 3: 修改 excel.ts 的 exportToCSV 支持 encoding 和 delimiter 参数**

在 `src/utils/excel.ts` 中：
```tsx
export async function exportToCSV(
  data: any[][],
  filePath: string,
  encoding: "utf-8" | "gbk" = "utf-8",
  delimiter: string = ","
): Promise<void> {
  const csv = data.map(row =>
    row.map(cell => {
      const str = cell === null || cell === undefined ? "" : String(cell);
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(delimiter)
  ).join("\n");

  const bom = encoding === "utf-8" ? "\ufeff" : "";
  const buffer = new TextEncoder().encode(bom + csv);
  await writeLocalFile(filePath, buffer.buffer);
}
```

- [ ] **Step 4: 在 App.tsx JSX 中添加 ExportPanel**

```tsx
<ExportPanel
  open={showExportPanel}
  onExport={handleDoExport}
  onCancel={() => setShowExportPanel(false)}
/>
```

- [ ] **Step 5: 修改 Toolbar 中导出按钮的 onClick**

将 Toolbar 的 `onExport` 改为 `onExport()` 接收一个参数，但 Toolbar 目前导出按钮是分别调用 `onExport("xlsx")` 和 `onExport("csv")`。

更好的方案是：Toolbar 导出按钮改为调用 `onShowExportPanel()`，由 App.tsx 决定显示 ExportPanel，然后在 ExportPanel 中处理真正的导出。

在 Toolbar.tsx 中：
```tsx
// 将两个导出按钮改为一个"导出"按钮，onClick 调用 onShowExportPanel
<button
  onClick={onShowExportPanel}
  disabled={!hasData || !desktopReady}
  className="..."
>
  <Download size={15} />
  <span>导出</span>
</button>
```

同时在 ToolbarProps 中：
```tsx
onShowExportPanel: () => void;  // 替代 onExport: (format: "xlsx" | "csv") => void
```

在 App.tsx 中传入 `onShowExportPanel={handleExportWithPanel}` 并删除两个 onExport prop。

- [ ] **Step 6: 测试**

运行 `npm run dev`，导入文件，点击导出按钮，观察格式选择面板是否显示，选择格式后是否正确导出。

- [ ] **Step 7: 提交**

```bash
git add src/components/ExportPanel.tsx src/App.tsx src/utils/excel.ts
git commit -m "feat: add export format selection panel with encoding options"
```

---

## Task 5: MergePreview 组件 + 合并预览

**Files:**
- Create: `src/components/MergePreview.tsx`
- Modify: `src/App.tsx` (添加 mergePreview 状态)
- Modify: `src/services/dataProcessor.ts` (新增 smartMergeHeaders)
- Test: 手动运行，导入多个文件，点击合并，观察预览是否显示

- [ ] **Step 1: 在 dataProcessor.ts 中添加 smartMergeHeaders 函数**

```tsx
// src/services/dataProcessor.ts 末尾添加

export interface MergeColumnInfo {
  columnName: string;
  sources: string[]; // 哪些文件包含此列
  sourceIndices: number[];
}

export interface MergePreviewResult {
  unifiedHeaders: string[];
  columnInfo: MergeColumnInfo[];
  totalRows: number;
  fileStats: { name: string; rows: number; columns: number }[];
}

/**
 * 智能合并多个文件的列名
 * - 相同列名合并为一列
 * - 返回列名来源信息（哪些文件包含此列）
 */
export function smartMergeHeaders(files: { headers: string[]; data: any[][]; name: string }[]): MergePreviewResult {
  const allHeaders = files.map(f => f.headers);
  const columnMap = new Map<string, { sources: string[]; sourceIndices: number[] }>();

  files.forEach((file, fileIdx) => {
    file.headers.forEach((col, colIdx) => {
      const key = col.trim();
      if (!columnMap.has(key)) {
        columnMap.set(key, { sources: [], sourceIndices: [] });
      }
      const entry = columnMap.get(key)!;
      entry.sources.push(file.name);
      entry.sourceIndices.push(colIdx);
    });
  });

  const unifiedHeaders = Array.from(columnMap.keys());
  const columnInfo: MergeColumnInfo[] = unifiedHeaders.map(name => {
    const entry = columnMap.get(name)!;
    return {
      columnName: name,
      sources: entry.sources,
      sourceIndices: entry.sourceIndices,
    };
  });

  const totalRows = files.reduce((sum, f) => sum + f.data.length - 1, 0);
  const fileStats = files.map(f => ({
    name: f.name,
    rows: f.data.length - 1,
    columns: f.headers.length,
  }));

  return { unifiedHeaders, columnInfo, totalRows, fileStats };
}

/**
 * 根据 smartMergeHeaders 的结果执行真正的合并
 */
export function executeSmartMerge(
  files: { headers: string[]; data: any[][]; name: string }[],
  columnInfo: MergeColumnInfo[]
): any[][] {
  if (files.length === 0) return [];

  const merged: any[][] = [columnInfo.map(c => c.columnName)];

  files.forEach((file, fileIdx) => {
    const fileRows = file.data.slice(1); // 去掉表头
    fileRows.forEach(row => {
      const newRow = columnInfo.map(col => {
        const sourceIdx = col.sourceIndices[col.sources.indexOf(file.name)];
        return sourceIdx !== undefined ? row[sourceIdx] : "";
      });
      merged.push(newRow);
    });
  });

  return merged;
}
```

- [ ] **Step 2: 创建 MergePreview 组件**

```tsx
// src/components/MergePreview.tsx
import { FileData } from "../utils/excel";
import { MergeColumnInfo } from "../services/dataProcessor";

interface MergePreviewProps {
  files: FileData[];
  unifiedHeaders: string[];
  columnInfo: MergeColumnInfo[];
  totalRows: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function MergePreview({
  files,
  unifiedHeaders,
  columnInfo,
  totalRows,
  onConfirm,
  onCancel,
}: MergePreviewProps) {
  const uniqueColumns = columnInfo.filter(c => c.sources.length === 1);
  const sharedColumns = columnInfo.filter(c => c.sources.length > 1);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onCancel}>
      <div className="bg-white rounded-xl shadow-2xl w-[600px] max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-800">📋 合并预览</h3>
          <p className="text-sm text-gray-500 mt-1">
            共 {files.length} 个文件，合并后 {totalRows} 行 × {unifiedHeaders.length} 列
          </p>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {/* 文件列表 */}
          <div className="mb-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">参与文件</h4>
            <div className="flex flex-wrap gap-2">
              {files.map((f, i) => (
                <span key={i} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                  {f.name}
                </span>
              ))}
            </div>
          </div>

          {/* 列名对比表 */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">列名对比</h4>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border border-gray-200 px-2 py-1 text-left">列名</th>
                  {files.map((f, i) => (
                    <th key={i} className="border border-gray-200 px-2 py-1 text-center">{f.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {columnInfo.map((col, i) => (
                  <tr key={i} className={col.sources.length === 1 ? "bg-yellow-50" : ""}>
                    <td className="border border-gray-200 px-2 py-1">
                      {col.columnName || <span className="text-gray-400">（空列名）</span>}
                    </td>
                    {files.map((f, fi) => {
                      const hasCol = col.sources.includes(f.name);
                      return (
                        <td key={fi} className="border border-gray-200 px-2 py-1 text-center">
                          {hasCol ? (
                            <span className="text-green-600">✓</span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="p-4 border-t border-gray-200 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
          >
            确认合并
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 在 App.tsx 中添加合并预览状态和包装函数**

```tsx
const [mergePreview, setMergePreview] = useState<{
  unifiedHeaders: string[];
  columnInfo: MergeColumnInfo[];
  totalRows: number;
} | null>(null);

const handleMergeWithPreview = useCallback(() => {
  if (files.length < 2) return;
  const { unifiedHeaders, columnInfo, totalRows } = smartMergeHeaders(files);
  setMergePreview({ unifiedHeaders, columnInfo, totalRows });
}, [files]);

const handleConfirmMerge = useCallback(() => {
  if (!mergePreview || files.length < 2) return;
  const merged = executeSmartMerge(files, mergePreview.columnInfo);
  setMergedData(merged);
  setCurrentHeaders(mergePreview.unifiedHeaders);
  setCurrentData(merged);
  setIsMerged(true);
  saveHistory(merged, mergePreview.unifiedHeaders);
  computeStats(files);
  setMergePreview(null);
  showToast(`合并完成：${files.length} 个文件，${mergePreview.totalRows} 行数据`, "success");
}, [mergePreview, files, saveHistory]);
```

- [ ] **Step 4: 在 Toolbar 中修改合并按钮的 onClick 为预览版本**

将 Toolbar 的 `onMerge` 改为 `onMerge()` 在 App.tsx 层显示预览，然后用户确认后再执行合并。

在 Toolbar.tsx Props 中，`onMerge` 保持不变（无参数），在 App.tsx 中：
```tsx
<Toolbar
  ...
  onMerge={handleMergeWithPreview}  // 改为预览版本
  ...
/>
```

- [ ] **Step 5: 在 App.tsx JSX 中添加 MergePreview**

```tsx
{mergePreview && (
  <MergePreview
    files={files}
    unifiedHeaders={mergePreview.unifiedHeaders}
    columnInfo={mergePreview.columnInfo}
    totalRows={mergePreview.totalRows}
    onConfirm={handleConfirmMerge}
    onCancel={() => setMergePreview(null)}
  />
)}
```

- [ ] **Step 6: 测试**

运行 `npm run dev`，导入 2 个文件，点击合并按钮，观察预览面板是否正确显示列名对比。

- [ ] **Step 7: 提交**

```bash
git add src/components/MergePreview.tsx src/App.tsx src/services/dataProcessor.ts
git commit -m "feat: add merge preview with column alignment visualization"
```

---

## Task 6: 一键清洗按钮

**Files:**
- Modify: `src/components/Toolbar.tsx` (添加一键清洗按钮)
- Modify: `src/App.tsx` (添加 handleOneClickClean 包装函数和确认)
- Test: 手动运行，点击一键清洗，观察是否弹出确认

- [ ] **Step 1: 在 Toolbar.tsx 中添加一键清洗按钮**

在工具栏按钮区域添加：
```tsx
{/* 一键清洗 */}
<button
  onClick={onOneClickClean}
  disabled={!hasData}
  className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-lg hover:from-blue-600 hover:to-indigo-600 transition-colors text-sm disabled:opacity-40"
  title="去空格 + 清空空行空列 + 日期标准化"
>
  <Wand2 size={15} />
  <span>一键清洗</span>
</button>
```

从 lucide-react 导入 `Wand2`：
```tsx
import { ..., Wand2 } from "lucide-react";
```

- [ ] **Step 2: 在 ToolbarProps 中添加 onOneClickClean**

```tsx
onOneClickClean: () => void;
```

- [ ] **Step 3: 在 App.tsx 中添加 handleOneClickCleanWithConfirm**

```tsx
const handleOneClickCleanWithConfirm = useCallback(() => {
  if (currentData.length === 0) return;
  const dataRows = currentData.slice(1);
  const nonEmptyRows = dataRows.filter(row =>
    row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== '')
  );
  const nonEmptyRowCount = dataRows.length - nonEmptyRows.length;
  const emptyCellCount = dataRows.reduce((sum, row) =>
    sum + row.filter(cell => cell === null || cell === undefined || String(cell).trim() === '').length, 0
  );

  setConfirmDialog({
    title: "确认一键清洗",
    message: `将执行以下操作：\n1. 去除所有单元格的前后空格\n2. 删除 ${nonEmptyRowCount} 行空行\n3. 删除空列\n4. 将日期格式统一为 YYYY-MM-DD`,
    onConfirm: () => {
      // 依次执行 trim, cleanEmpty, standardizeDate
      handleTrimWhitespace();
      handleCleanEmpty();
      handleStandardizeDate();
      setConfirmDialog(null);
      showToast("一键清洗完成", "success");
    },
    confirmClassName: "bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600",
  });
}, [currentData, handleTrimWhitespace, handleCleanEmpty, handleStandardizeDate]);
```

- [ ] **Step 4: 在 App.tsx Toolbar 使用处传入 onOneClickClean**

```tsx
<Toolbar
  ...
  onOneClickClean={handleOneClickCleanWithConfirm}
  ...
/>
```

- [ ] **Step 5: 测试**

运行 `npm run dev`，导入带空行和格式不规范日期的文件，点击"一键清洗"按钮，观察确认对话框和执行结果。

- [ ] **Step 6: 提交**

```bash
git add src/components/Toolbar.tsx src/App.tsx
git commit -m "feat: add one-click clean button for batch data cleaning"
```

---

## 验收标准

1. **Toast 反馈**：每个操作完成后右下角显示 toast，3 秒后自动消失
2. **确认对话框**：去重、清空、一键清洗等操作点击后弹出确认框，显示影响范围
3. **导出格式选择**：点击导出弹出面板，可选 CSV/Excel、编码、分隔符
4. **合并预览**：点击合并后显示预览面板，列出所有文件、列名对比、总行数列数
5. **一键清洗**：点击后确认，执行 trim + 清空 + 日期标准化三个操作

## 实现顺序

Task 1 → Task 2 → Task 3 → Task 4 → Task 5 → Task 6
