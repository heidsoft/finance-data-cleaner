# 退款损失精确计算 - 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 支持导入订单级佣金明细，按「订单号+平台」精确匹配计算退款损失

**Architecture:**
- 新增 `CommissionDetail` 接口和解析函数
- 新增 `calculateRefundLossWithMatching()` 函数实现精确匹配算法
- 在 App.tsx 添加佣金明细状态和导入/展示逻辑
- 修改退款损失表输出，添加匹配状态列

**Tech Stack:** TypeScript, React, xlsx

---

## 文件影响

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `src/services/businessLogic.ts` | 修改 | 新增接口和匹配函数 |
| `src/App.tsx` | 修改 | 状态、导入逻辑、UI |

---

## Task 1: 新增 CommissionDetail 接口

**Files:**
- Modify: `src/services/businessLogic.ts`

- [ ] **Step 1: 在 businessLogic.ts 添加 CommissionDetail 接口**

在 `RefundOrder` 接口下方添加：

```typescript
export interface CommissionDetail {
  orderId: string;
  platform: string;
  commission: number;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/businessLogic.ts
git commit -m "feat(bill): add CommissionDetail interface"
```

---

## Task 2: 新增 parseCommissionDetails 解析函数

**Files:**
- Modify: `src/services/businessLogic.ts`

- [ ] **Step 1: 添加 parseCommissionDetails 函数**

在 `parseBill` 函数之后添加：

```typescript
export function parseCommissionDetails(fileData: FileData): CommissionDetail[] {
  const headers = fileData.headers;
  const rows = fileData.data.slice(1);

  const orderIdCol = findCol(headers, ["订单号", "order", "编号", "id", "order_id"]);
  const platformCol = findCol(headers, ["平台", "platform", "渠道", "source"]);
  const commissionCol = findCol(headers, ["佣金", "commission", "服务费", "扣点", "platform_fee"]);

  if (commissionCol < 0) {
    return [];
  }

  const details: CommissionDetail[] = [];

  for (const row of rows) {
    const orderId = orderIdCol >= 0 ? String(row[orderIdCol] || "").trim() : "";
    const platform = platformCol >= 0
      ? String(row[platformCol] || "").trim()
      : detectPlatform(fileData.name);
    const commission = Math.abs(findAmount([row[commissionCol]]));

    if (commission > 0) {
      details.push({ orderId, platform, commission });
    }
  }

  return details;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/businessLogic.ts
git commit -m "feat(bill): add parseCommissionDetails function"
```

---

## Task 3: 新增退款损失精确匹配计算函数

**Files:**
- Modify: `src/services/businessLogic.ts`

- [ ] **Step 1: 添加 calculateRefundLossWithMatching 函数**

在文件末尾添加：

```typescript
export interface RefundLossResult {
  orderId: string;
  platform: string;
  refundAmount: number;
  refundDate: string;
  commission: number;
  isMatched: boolean;
  matchSource: "精确匹配" | "均摊估算";
}

export function calculateRefundLossWithMatching(
  refundRecords: RefundOrder[],
  commissionDetails: CommissionDetail[],
  avgCommissionRate: number
): { results: RefundLossResult[]; matchedCount: number; totalCount: number } {
  // Build lookup map for O(n) matching: key = "orderId|platform"
  const commissionMap = new Map<string, number>();
  for (const cd of commissionDetails) {
    const key = `${cd.orderId}|${cd.platform}`;
    commissionMap.set(key, cd.commission);
  }

  const results: RefundLossResult[] = [];
  let matchedCount = 0;

  for (const refund of refundRecords) {
    const key = `${refund.orderId}|${refund.platform}`;
    const matchedCommission = commissionMap.get(key);

    if (matchedCommission !== undefined) {
      results.push({
        orderId: refund.orderId,
        platform: refund.platform,
        refundAmount: refund.refundAmount,
        refundDate: refund.refundDate,
        commission: matchedCommission,
        isMatched: true,
        matchSource: "精确匹配",
      });
      matchedCount++;
    } else {
      // Fallback to average rate estimation
      results.push({
        orderId: refund.orderId,
        platform: refund.platform,
        refundAmount: refund.refundAmount,
        refundDate: refund.refundDate,
        commission: refund.refundAmount * avgCommissionRate,
        isMatched: false,
        matchSource: "均摊估算",
      });
    }
  }

  return { results, matchedCount, totalCount: refundRecords.length };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/businessLogic.ts
git commit -m "feat(bill): add calculateRefundLossWithMatching function"
```

---

## Task 4: App.tsx 添加佣金明细状态

**Files:**
- Modify: `src/App.tsx:70-73`

- [ ] **Step 1: 添加 commissionDetails state**

找到退款相关状态（大约 line 70-73），在 `_refundFile` 声明下方添加：

```typescript
const [commissionDetails, setCommissionDetails] = useState<CommissionDetail[]>([]);
```

同时在 import 部分添加 `CommissionDetail`：

```typescript
import {
  BillRecord,
  RebateTier,
  RefundOrder,
  SKUMapping,
  CommissionDetail,
  detectPlatform,
  findAmount,
  findCol,
  parseBill,
  parseCommissionDetails,
  calculateRefundLossWithMatching,
} from "./services/businessLogic";
```

- [ ] **Step 2: Commit**

```bash
git add src/App.tsx
git commit -m "feat(bill): add commissionDetails state"
```

---

## Task 5: 新增 handleImportCommissionDetails 函数

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: 在 handleImportBill 函数之后添加 handleImportCommissionDetails**

```typescript
// 佣金明细导入
const handleImportCommissionDetails = useCallback(async () => {
  try {
    const result = await openDataFiles();
    if (!result.canceled && result.filePaths.length > 0) {
      const fileData = await processFile(result.filePaths[0]);
      if (fileData) {
        const details = parseCommissionDetails(fileData);
        if (details.length === 0) {
          setToasts((prev) => [
            ...prev,
            { type: "error", message: "未找到佣金数据，请检查文件格式" },
          ]);
          return;
        }
        setCommissionDetails(details);
        setToasts((prev) => [
          ...prev,
          { type: "success", message: `已导入 ${details.length} 条佣金明细` },
        ]);
      }
    }
  } catch (error) {
    reportError("导入佣金明细", error);
  }
}, [reportError]);
```

- [ ] **Step 2: Commit**

```bash
git add src/App.tsx
git commit -m "feat(bill): add handleImportCommissionDetails function"
```

---

## Task 6: 修改 handleGenerateRefundLoss 使用精确匹配

**Files:**
- Modify: `src/App.tsx:902-949`

- [ ] **Step 1: 修改 handleGenerateRefundLoss 函数**

将原函数替换为：

```typescript
const handleGenerateRefundLoss = useCallback(() => {
  if (refundRecords.length === 0) return;

  const avgCommissionRate =
    billRecords.length > 0
      ? billRecords.reduce((s, b) => s + b.commission, 0) /
        Math.max(1, billRecords.reduce((s, b) => s + b.totalAmount, 0))
      : 0.05;

  const { results, matchedCount, totalCount } = calculateRefundLossWithMatching(
    refundRecords,
    commissionDetails,
    avgCommissionRate
  );

  const matchedAmount = results
    .filter((r) => r.isMatched)
    .reduce((s, r) => s + r.commission, 0);
  const estimatedAmount = results
    .filter((r) => !r.isMatched)
    .reduce((s, r) => s + r.commission, 0);

  const headers = [
    "平台",
    "退款日期",
    "订单号",
    "退款金额",
    "实际佣金",
    "匹配状态",
    "佣金来源",
    "损失合计",
    "说明",
  ];

  const rows = results.map((r) => [
    r.platform,
    r.refundDate,
    r.orderId,
    r.refundAmount.toFixed(2),
    r.commission.toFixed(2),
    r.isMatched ? "✅已匹配" : "⚠️估算",
    r.matchSource,
    (r.refundAmount + r.commission).toFixed(2),
    r.isMatched ? "退款+佣金双重损失" : "退款+估算佣金损失",
  ]);

  const totalRefund = refundRecords.reduce((s, r) => s + r.refundAmount, 0);
  const totalComm = results.reduce((s, r) => s + r.commission, 0);

  const totalRow = [
    "合计",
    "",
    `${matchedCount}/${totalCount} 笔已匹配`,
    totalRefund.toFixed(2),
    totalComm.toFixed(2),
    matchedCount === totalCount ? "✅100%匹配" : `⚠️${totalCount - matchedCount}笔估算`,
    matchedCount > 0 ? `精确¥${matchedAmount.toFixed(2)}/估算¥${estimatedAmount.toFixed(2)}` : "全部估算",
    (totalRefund + totalComm).toFixed(2),
    `涉及 ${refundRecords.length} 笔退款`,
  ];

  const data = [headers, ...rows, totalRow];
  setRefundLossData(data);
  setCurrentData(data);
  setCurrentHeaders(headers);
  saveHistory(data, headers);
}, [refundRecords, commissionDetails, billRecords, saveHistory]);
```

- [ ] **Step 2: Commit**

```bash
git add src/App.tsx
git commit -m "feat(bill): use precise matching in handleGenerateRefundLoss"
```

---

## Task 7: UI - 账单对账 Tab 添加「导入佣金明细」按钮

**Files:**
- Modify: `src/App.tsx:1447-1526`

- [ ] **Step 1: 在佣金自动计提表区域添加「导入佣金明细」按钮和明细查看**

找到佣金自动计提表的 header 区域（约 line 1449-1458），在 `<div className="p-4 border-b border-gray-100 flex items-center justify-between">` 的内容部分：

将：
```jsx
<div>
  <h2 className="font-semibold text-gray-800">
    📊 佣金自动计提表
  </h2>
  <p className="text-xs text-gray-500 mt-0.5">
    根据账单自动生成佣金/扣点计提数据
  </p>
</div>
```

改为：
```jsx
<div>
  <h2 className="font-semibold text-gray-800">
    📊 佣金自动计提表
  </h2>
  <p className="text-xs text-gray-500 mt-0.5">
    根据账单自动生成佣金/扣点计提数据
    {commissionDetails.length > 0 && (
      <span className="ml-2 text-green-600">
        ✓ 已导入 {commissionDetails.length} 条佣金明细
      </span>
    )}
  </p>
</div>
```

- [ ] **Step 2: 在「重新生成」按钮旁添加「导入佣金明细」按钮**

在 `重新生成` 按钮之后添加：

```jsx
<button
  onClick={handleImportCommissionDetails}
  disabled={!desktopReady}
  className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm disabled:opacity-40"
>
  📋 导入佣金明细
</button>
```

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat(bill): add import commission details button in accrual section"
```

---

## Task 8: UI - 退款损失还原区域添加匹配率提示

**Files:**
- Modify: `src/App.tsx:1528-1646`

- [ ] **Step 1: 修改退款损失还原区域的说明文字**

找到退款损失还原的说明文字（约 line 1535-1537），将：
```jsx
<p className="text-xs text-gray-500 mt-0.5">
  导入退款订单，还原因退款产生的佣金损失（平台不退佣金）
</p>
```

改为：
```jsx
<p className="text-xs text-gray-500 mt-0.5">
  {commissionDetails.length > 0
    ? "已导入佣金明细，可精确计算退款损失"
    : "导入佣金明细文件后可精确计算损失，否则使用估算"}
</p>
```

- [ ] **Step 2: Commit**

```bash
git add src/App.tsx
git commit -m "feat(bill): update refund loss section description"
```

---

## Task 9: UI - 退款损失汇总区显示匹配率

**Files:**
- Modify: `src/App.tsx:1554-1591`

- [ ] **Step 1: 在退款汇总信息区域显示匹配状态**

找到退款笔数/金额/佣金的显示区域（约 line 1554-1591），在预估佣金损失那一行下方添加一行匹配率显示：

```jsx
{commissionDetails.length > 0 && refundRecords.length > 0 && (
  <div className="bg-orange-50 px-3 py-1.5 rounded text-xs">
    💡 已匹配 {commissionDetails.length} 条佣金明细，将用于精确计算
  </div>
)}
{commissionDetails.length === 0 && refundRecords.length > 0 && (
  <div className="bg-gray-100 px-3 py-1.5 rounded text-xs text-gray-600">
    ⚠️ 未导入佣金明细，使用均摊估算
  </div>
)}
```

- [ ] **Step 2: Commit**

```bash
git add src/App.tsx
git commit -m "feat(bill): show matching status in refund summary"
```

---

## Task 10: 最终验证

- [ ] **Step 1: 运行开发服务器验证**

```bash
npm run dev
```

应用应该正常启动，无编译错误。

- [ ] **Step 2: 验证功能流程**

1. 在「账单对账」Tab，导入账单文件
2. 点击「导入佣金明细」，选择佣金明细文件
3. 确认显示"已导入 N 条佣金明细"
4. 导入退款订单
5. 点击「生成退款损失表」
6. 确认表格包含新增列：匹配状态、佣金来源
7. 确认合计行显示匹配率

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "feat: implement accurate refund loss calculation with order-level commission matching"
```

---

## 验证清单

| 功能点 | 预期结果 |
|--------|----------|
| 导入佣金明细 | Toast 显示成功 + 行数 |
| 佣金明细为空时导入 | Toast 显示错误"未找到佣金数据" |
| 生成退款损失表（有明细） | 表格含匹配状态列，显示 ✅已匹配 |
| 生成退款损失表（无明细） | 表格显示 ⚠️估算，降级处理 |
| 合计行 | 显示匹配率 (156/180 笔 86.7%) |
| 导出文件名 | `退款损失还原_精确版_YYYY-MM.xlsx` |
