import { useState, useCallback, useMemo } from "react";
import Toolbar from "./components/Toolbar";
import FileSidebar from "./components/FileSidebar";
import DataTable from "./components/DataTable";
import StatusBar from "./components/StatusBar";
import Toast, { ToastMessage } from "./components/Toast";
import ConfirmDialog from "./components/ConfirmDialog";
import MonthlySummary from "./components/MonthlySummary";
import ExportPanel from "./components/ExportPanel";
import MergePreview from "./components/MergePreview";
import {
  FileData,
  processFile,
  exportToExcel,
  exportToCSV,
} from "./utils/excel";
import { hasElectronAPI, openDataFiles, saveDataFile } from "./utils/desktop";
import {
  smartMergeHeaders,
  executeSmartMerge,
  MergeColumnInfo,
} from "./services/dataProcessor";

interface HistoryState {
  data: any[][];
  headers: string[];
  fileIndex: number | null;
  isMerged: boolean;
}

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

type Tab = "data" | "mapping" | "reconcile" | "bill" | "rebate" | "monthly";

function App() {
  const desktopReady = hasElectronAPI();
  const [files, setFiles] = useState<FileData[]>([]);
  const [selectedFileIndex, setSelectedFileIndex] = useState<number | null>(
    null,
  );
  const [currentData, setCurrentData] = useState<any[][]>([]);
  const [currentHeaders, setCurrentHeaders] = useState<string[]>([]);
  const [_mergedData, setMergedData] = useState<any[][] | null>(null);
  const [isMerged, setIsMerged] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [activeTab, setActiveTab] = useState<Tab>("data");

  const [skuMappings, setSkuMappings] = useState<SKUMapping[]>([]);
  const [mappingFile, setMappingFile] = useState<FileData | null>(null);
  const [paymentFile, setPaymentFile] = useState<FileData | null>(null);
  const [billRecords, setBillRecords] = useState<BillRecord[]>([]);
  const [showBillDetail, setShowBillDetail] = useState<BillRecord | null>(null);
  const [orderStats, setOrderStats] = useState<{
    totalOrders: number;
    totalAmount: number;
    platformBreakdown: Record<string, { count: number; amount: number }>;
  } | null>(null);

  // 退款相关
  const [_refundFile, setRefundFile] = useState<FileData | null>(null);
  const [refundRecords, setRefundRecords] = useState<RefundOrder[]>([]);
  const [refundLossData, setRefundLossData] = useState<any[][]>([]);
  const [commissionDetails, setCommissionDetails] = useState<CommissionDetail[]>([]);

  // 返利相关
  const [rebateTiers] = useState<RebateTier[]>([
    { min: 0, max: 50, rate: 2, label: "0-50万" },
    { min: 50, max: 100, rate: 3, label: "50-100万" },
    { min: 100, max: 200, rate: 4, label: "100-200万" },
    { min: 200, max: 500, rate: 5, label: "200-500万" },
    { min: 500, max: 0, rate: 6, label: "500万以上" },
  ]);
  const [customTiers, setCustomTiers] = useState<RebateTier[]>([]);
  const [rebateResult, setRebateResult] = useState<any[][] | null>(null);
  const [rebateBrand, setRebateBrand] = useState("");
  const [rebateGMV, setRebateGMV] = useState(0);
  const [runtimeNotice, setRuntimeNotice] = useState<string | null>(
    desktopReady
      ? null
      : "当前为浏览器预览模式，可查看界面但无法直接进行本地文件导入导出，请使用桌面应用运行。",
  );

  // Toast 通知
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    confirmLabel?: string;
    confirmClassName?: string;
    disabled?: boolean;
  } | null>(null);

  const [showExportPanel, setShowExportPanel] = useState(false);

  const [mergePreview, setMergePreview] = useState<{
    unifiedHeaders: string[];
    columnInfo: MergeColumnInfo[];
    totalRows: number;
  } | null>(null);

  const showToast = useCallback((message: string, type: ToastMessage["type"] = "success") => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, type, message }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // 佣金计提
  const [accrualData, setAccrualData] = useState<any[][]>([]);

  const saveHistory = useCallback(
    (data: any[][], headers: string[]) => {
      const newEntry: HistoryState = {
        data: [...data.map((row) => [...row])],
        headers: [...headers],
        fileIndex: selectedFileIndex,
        isMerged,
      };
      setHistory((prev) => {
        const newHistory = prev.slice(0, historyIndex + 1);
        newHistory.push(newEntry);
        return newHistory;
      });
      setHistoryIndex((prev) => prev + 1);
    },
    [selectedFileIndex, isMerged, historyIndex],
  );

  const reportError = useCallback((action: string, error: unknown) => {
    const message = error instanceof Error ? error.message : `${action}失败`;
    console.error(`${action}失败:`, error);
    setRuntimeNotice(`${action}失败：${message}`);
  }, []);

  const handleUndo = useCallback(() => {
    if (historyIndex <= 0) return;
    const prev = history[historyIndex - 1];
    setCurrentData(prev.data);
    setCurrentHeaders(prev.headers);
    setHistoryIndex((prev) => prev - 1);
  }, [history, historyIndex]);

  const handleImportOrders = useCallback(async () => {
    try {
      const result = await openDataFiles();
      if (!result.canceled && result.filePaths.length > 0) {
        const newFiles: FileData[] = [];
        for (const filePath of result.filePaths) {
          const fileData = await processFile(filePath);
          if (fileData) newFiles.push(fileData);
        }
        setFiles((prev) => [...prev, ...newFiles]);
        if (selectedFileIndex === null && newFiles.length > 0) {
          setSelectedFileIndex(files.length);
          setCurrentHeaders(newFiles[0].headers);
          setCurrentData(newFiles[0].data);
          setIsMerged(false);
          saveHistory(newFiles[0].data, newFiles[0].headers);
        }
        computeStats([...files, ...newFiles]);
      }
    } catch (error) {
      reportError("导入订单", error);
    }
  }, [files.length, selectedFileIndex, saveHistory, reportError]);

  const computeStats = (allFiles: FileData[]) => {
    const allRows: any[][] = [];
    const platformMap: Record<string, { count: number; amount: number }> = {};
    allFiles.forEach((file) => {
      const dataRows = file.data.slice(1);
      allRows.push(...dataRows);
      const platform = detectPlatform(file.name);
      if (!platformMap[platform])
        platformMap[platform] = { count: 0, amount: 0 };
      platformMap[platform].count += dataRows.length;
      dataRows.forEach((row) => {
        const amount = findAmount(row);
        if (!isNaN(amount)) platformMap[platform].amount += amount;
      });
    });
    const totalAmount = allRows.reduce((sum, row) => sum + findAmount(row), 0);
    setOrderStats({
      totalOrders: allRows.length,
      totalAmount,
      platformBreakdown: platformMap,
    });
  };

  const handleFileSelect = useCallback(
    (index: number) => {
      setSelectedFileIndex(index);
      if (index < files.length) {
        setCurrentHeaders(files[index].headers);
        setCurrentData(files[index].data);
        setIsMerged(false);
        setSearchText("");
      }
    },
    [files],
  );

  const handleRemoveFile = useCallback(
    (index: number) => {
      setFiles((prev) => prev.filter((_, i) => i !== index));
      if (selectedFileIndex === index) {
        setSelectedFileIndex(null);
        setCurrentData([]);
        setCurrentHeaders([]);
      } else if (selectedFileIndex !== null && selectedFileIndex > index)
        setSelectedFileIndex(selectedFileIndex - 1);
    },
    [selectedFileIndex],
  );

  const handleMergeWithPreview = useCallback(() => {
    if (files.length < 2) return;
    const { unifiedHeaders, columnInfo, totalRows } = smartMergeHeaders(files);
    setMergePreview({ unifiedHeaders, columnInfo, totalRows });
  }, [files]);

  const handleConfirmMerge = useCallback(() => {
    if (!mergePreview || files.length < 2) return;
    const totalRows = mergePreview.totalRows;
    const merged = executeSmartMerge(files, mergePreview.columnInfo);
    setMergedData(merged);
    setCurrentHeaders(mergePreview.unifiedHeaders);
    setCurrentData(merged);
    setIsMerged(true);
    saveHistory(merged, mergePreview.unifiedHeaders);
    computeStats(files);
    setMergePreview(null);
    showToast(`合并完成：${files.length} 个文件，${totalRows} 行数据`, "success");
  }, [mergePreview, files, saveHistory, computeStats, showToast]);

  const handleDeduplicate = useCallback(
    (columnIndex?: number) => {
      if (currentData.length === 0) return;
      const headers = currentData[0];
      const dataRows = currentData.slice(1);
      let uniqueRows: any[][];
      if (columnIndex !== undefined && columnIndex >= 0) {
        const seen = new Set();
        uniqueRows = dataRows.filter((row) => {
          const key = row[columnIndex];
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      } else {
        const seen = new Set();
        uniqueRows = dataRows.filter((row) => {
          const key = JSON.stringify(row);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      }
      const newData = [headers, ...uniqueRows];
      setCurrentData(newData);
      if (selectedFileIndex !== null && !isMerged) {
        const newFiles = [...files];
        newFiles[selectedFileIndex] = {
          ...files[selectedFileIndex],
          data: newData,
        };
        setFiles(newFiles);
      } else if (isMerged) {
        setMergedData(newData);
      }
      saveHistory(newData, headers);
    },
    [currentData, selectedFileIndex, isMerged, files, saveHistory],
  );

  const handleCleanEmpty = useCallback(() => {
    if (currentData.length === 0) return;
    const headers = currentData[0];
    const dataRows = currentData.slice(1);
    const nonEmptyRows = dataRows.filter((row) =>
      row.some(
        (cell) =>
          cell !== null && cell !== undefined && String(cell).trim() !== "",
      ),
    );
    const nonEmptyCols = headers.map((_, colIndex) =>
      dataRows.some((row) => {
        const cell = row[colIndex];
        return (
          cell !== null && cell !== undefined && String(cell).trim() !== ""
        );
      }),
    );
    const cleanedHeaders = headers.filter((_, i) => nonEmptyCols[i]);
    const cleanedRows = nonEmptyRows.map((row) =>
      row.filter((_, i) => nonEmptyCols[i]),
    );
    const newData = [cleanedHeaders, ...cleanedRows];
    setCurrentData(newData);
    setCurrentHeaders(cleanedHeaders);
    if (selectedFileIndex !== null && !isMerged) {
      const newFiles = [...files];
      newFiles[selectedFileIndex] = {
        ...files[selectedFileIndex],
        headers: cleanedHeaders,
        data: newData,
      };
      setFiles(newFiles);
    } else if (isMerged) {
      setMergedData(newData);
    }
    saveHistory(newData, cleanedHeaders);
  }, [currentData, selectedFileIndex, isMerged, files, saveHistory]);

  const handleTrimWhitespace = useCallback(() => {
    if (currentData.length === 0) return;
    const headers = currentData[0];
    const dataRows = currentData.slice(1);
    const trimmedRows = dataRows.map((row) =>
      row.map((cell) => (typeof cell === "string" ? cell.trim() : cell)),
    );
    const newData = [headers, ...trimmedRows];
    setCurrentData(newData);
    if (selectedFileIndex !== null && !isMerged) {
      const newFiles = [...files];
      newFiles[selectedFileIndex] = {
        ...files[selectedFileIndex],
        data: newData,
      };
      setFiles(newFiles);
    }
    saveHistory(newData, headers);
  }, [currentData, selectedFileIndex, isMerged, files, saveHistory]);

  const handleStandardizeDate = useCallback(() => {
    if (currentData.length === 0) return;
    const headers = currentData[0];
    const dataRows = currentData.slice(1);
    const standardizedRows = dataRows.map((row) =>
      row.map((cell) => {
        if (typeof cell !== "string") return cell;
        const trimmed = cell.trim();
        const patterns = [
          { regex: /^(\d{4})[年/-](\d{1,2})[月/-](\d{1,2})日?$/ },
          { regex: /^(\d{1,2})[月/-](\d{1,2})[日/-](\d{4})$/ },
          { regex: /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/ },
          { regex: /^(\d{4})(\d{2})(\d{2})$/ },
        ];
        for (const p of patterns) {
          const match = trimmed.match(p.regex as any);
          if (match) {
            try {
              let y = "",
                m = "",
                d = "";
              if (match[1].length === 4) {
                y = match[1];
                m = match[2].padStart(2, "0");
                d = match[3].padStart(2, "0");
              } else {
                y = match[3];
                m = match[1].padStart(2, "0");
                d = match[2].padStart(2, "0");
              }
              const date = new Date(`${y}-${m}-${d}`);
              if (!isNaN(date.getTime()))
                return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
            } catch {}
          }
        }
        return cell;
      }),
    );
    const newData = [headers, ...standardizedRows];
    setCurrentData(newData);
    if (selectedFileIndex !== null && !isMerged) {
      const newFiles = [...files];
      newFiles[selectedFileIndex] = {
        ...files[selectedFileIndex],
        data: newData,
      };
      setFiles(newFiles);
    }
    saveHistory(newData, headers);
  }, [currentData, selectedFileIndex, isMerged, files, saveHistory]);

  const handleFillEmpty = useCallback(
    (fillValue: string) => {
      if (currentData.length === 0) return;
      const headers = currentData[0];
      const dataRows = currentData.slice(1);
      const filledRows = dataRows.map((row) =>
        row.map((cell) => {
          if (cell === null || cell === undefined || String(cell).trim() === "")
            return fillValue;
          return cell;
        }),
      );
      const newData = [headers, ...filledRows];
      setCurrentData(newData);
      if (selectedFileIndex !== null && !isMerged) {
        const newFiles = [...files];
        newFiles[selectedFileIndex] = {
          ...files[selectedFileIndex],
          data: newData,
        };
        setFiles(newFiles);
      }
      saveHistory(newData, headers);
    },
    [currentData, selectedFileIndex, isMerged, files, saveHistory],
  );

  const handleSelectColumns = useCallback(
    (selectedCols: number[]) => {
      if (currentData.length === 0) return;
      const headers = currentData[0];
      const dataRows = currentData.slice(1);
      const newHeaders = selectedCols.map((i) => headers[i]);
      const newRows = dataRows.map((row) => selectedCols.map((i) => row[i]));
      const newData = [newHeaders, ...newRows];
      setCurrentData(newData);
      setCurrentHeaders(newHeaders);
      if (selectedFileIndex !== null && !isMerged) {
        const newFiles = [...files];
        newFiles[selectedFileIndex] = {
          ...files[selectedFileIndex],
          headers: newHeaders,
          data: newData,
        };
        setFiles(newFiles);
      } else if (isMerged) {
        setMergedData(newData);
      }
      saveHistory(newData, newHeaders);
    },
    [currentData, selectedFileIndex, isMerged, files, saveHistory],
  );

  // ========== Confirm-wrapped toolbar handlers ==========

  const handleDeduplicateWithConfirm = useCallback(
    (columnIndex: number) => {
      if (currentData.length === 0) return;
      const dataRows = currentData.slice(1);
      const seen = new Set();
      let removed = 0;
      dataRows.forEach((row) => {
        const key = columnIndex >= 0 ? row[columnIndex] : JSON.stringify(row);
        if (seen.has(key)) {
          removed++;
        } else {
          seen.add(key);
        }
      });
      setConfirmDialog({
        title: "确认去重",
        message:
          removed > 0
            ? `将删除 ${removed} 行重复数据，保留 ${dataRows.length - removed} 行。`
            : "没有发现重复行，无需去重。",
        onConfirm: () => {
          setConfirmDialog((prev) => prev ? { ...prev, disabled: true } : null);
          handleDeduplicate(columnIndex);
          setConfirmDialog(null);
          if (removed > 0) {
            showToast(`去重完成：删除了 ${removed} 行`, "success");
          }
        },
        confirmLabel: removed > 0 ? "确认去重" : "好的",
        confirmClassName: "bg-orange-500 hover:bg-orange-600",
      });
    },
    [currentData, handleDeduplicate],
  );

  const handleCleanEmptyWithConfirm = useCallback(() => {
    if (currentData.length === 0) return;
    const dataRows = currentData.slice(1);
    const nonEmptyRows = dataRows.filter((row) =>
      row.some(
        (cell) =>
          cell !== null && cell !== undefined && String(cell).trim() !== "",
      ),
    );
    const removed = dataRows.length - nonEmptyRows.length;
    setConfirmDialog({
      title: "确认清空",
      message:
        removed > 0
          ? `将删除 ${removed} 行空行/空列，保留 ${nonEmptyRows.length} 行。`
          : "没有发现空行空列，无需清空。",
      onConfirm: () => {
        setConfirmDialog((prev) => prev ? { ...prev, disabled: true } : null);
        handleCleanEmpty();
        setConfirmDialog(null);
        if (removed > 0) {
          showToast(`清空完成：删除了 ${removed} 行空行`, "success");
        }
      },
      confirmLabel: removed > 0 ? "确认清空" : "好的",
      confirmClassName: "bg-yellow-500 hover:bg-yellow-600",
    });
  }, [currentData, handleCleanEmpty]);

  const handleTrimWhitespaceWithConfirm = useCallback(() => {
    if (currentData.length === 0) return;
    setConfirmDialog({
      title: "确认 Trim",
      message: "去除所有单元格的首尾空格。",
      onConfirm: () => {
        setConfirmDialog((prev) => prev ? { ...prev, disabled: true } : null);
        handleTrimWhitespace();
        setConfirmDialog(null);
        showToast("Trim 完成", "success");
      },
      confirmClassName: "bg-gray-500 hover:bg-gray-600",
    });
  }, [handleTrimWhitespace]);

  const handleStandardizeDateWithConfirm = useCallback(() => {
    if (currentData.length === 0) return;
    setConfirmDialog({
      title: "确认日期格式规范化",
      message: "将各种日期格式统一为 YYYY-MM-DD。",
      onConfirm: () => {
        setConfirmDialog((prev) => prev ? { ...prev, disabled: true } : null);
        handleStandardizeDate();
        setConfirmDialog(null);
        showToast("日期格式规范化完成", "success");
      },
      confirmClassName: "bg-indigo-500 hover:bg-indigo-600",
    });
  }, [handleStandardizeDate]);

  const handleFillEmptyWithConfirm = useCallback(
    (value: string) => {
      if (currentData.length === 0) return;
      setConfirmDialog({
        title: "确认填充空值",
        message: `将使用 "${value}" 填充所有空单元格。`,
        onConfirm: () => {
          setConfirmDialog((prev) => prev ? { ...prev, disabled: true } : null);
          handleFillEmpty(value);
          setConfirmDialog(null);
          showToast(`已使用 "${value}" 填充空值`, "success");
        },
        confirmClassName: "bg-teal-500 hover:bg-teal-600",
      });
    },
    [handleFillEmpty],
  );

  const handleSelectColumnsWithConfirm = useCallback(
    (selectedCols: number[]) => {
      if (currentData.length === 0) return;
      const headers = currentData[0];
      const currentColCount = headers.length;
      const newColCount = selectedCols.length;
      const removed = currentColCount - newColCount;
      setConfirmDialog({
        title: "确认选列",
        message:
          removed > 0
            ? `将保留 ${newColCount} 列，删除 ${removed} 列。`
            : `将保留全部 ${newColCount} 列。`,
        onConfirm: () => {
          setConfirmDialog((prev) => prev ? { ...prev, disabled: true } : null);
          handleSelectColumns(selectedCols);
          setConfirmDialog(null);
          if (removed > 0) {
            showToast(`选列完成：保留 ${newColCount} 列`, "success");
          }
        },
        confirmLabel: removed > 0 ? "确认选列" : "好的",
        confirmClassName: "bg-pink-500 hover:bg-pink-600",
      });
    },
    [currentData, handleSelectColumns],
  );

  // Combined one-click clean transformation (applies all ops to same data, single state update)
  const applyOneClickClean = useCallback((data: any[]) => {
    if (data.length === 0) return;
    const headers = data[0];
    let dataRows = data.slice(1);

    // 1. Trim whitespace
    dataRows = dataRows.map(row =>
      row.map(cell => (typeof cell === 'string' ? cell.trim() : cell))
    );

    // 2. Remove empty rows
    dataRows = dataRows.filter(row =>
      row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== '')
    );

    // 3. Standardize dates
    dataRows = dataRows.map(row =>
      row.map(cell => {
        if (typeof cell !== 'string') return cell;
        const trimmed = cell.trim();
        const patterns = [
          { regex: /^(\d{4})[年/-](\d{1,2})[月/-](\d{1,2})日?$/ },
          { regex: /^(\d{1,2})[月/-](\d{1,2})[日/-](\d{4})$/ },
          { regex: /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/ },
          { regex: /^(\d{4})(\d{2})(\d{2})$/ },
        ];
        for (const p of patterns) {
          const match = trimmed.match(p.regex as any);
          if (match) {
            try {
              let y = '', m = '', d = '';
              if (match[1].length === 4) {
                y = match[1];
                m = match[2].padStart(2, '0');
                d = match[3].padStart(2, '0');
              } else {
                y = match[3];
                m = match[1].padStart(2, '0');
                d = match[2].padStart(2, '0');
              }
              const date = new Date(`${y}-${m}-${d}`);
              if (!isNaN(date.getTime()))
                return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            } catch {}
          }
        }
        return cell;
      })
    );

    const newData = [headers, ...dataRows];
    setCurrentData(newData);
    setCurrentHeaders(headers);
    if (selectedFileIndex !== null && !isMerged) {
      const newFiles = [...files];
      newFiles[selectedFileIndex] = { ...files[selectedFileIndex], data: newData, headers };
      setFiles(newFiles);
    } else if (isMerged) {
      setMergedData(newData);
    }
    saveHistory(newData, headers);
  }, [selectedFileIndex, isMerged, files, saveHistory]);

  const handleOneClickCleanWithConfirm = useCallback(() => {
    if (currentData.length === 0) return;
    const dataRows = currentData.slice(1);
    const nonEmptyRows = dataRows.filter(row =>
      row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== '')
    );
    const removedRows = dataRows.length - nonEmptyRows.length;

    setConfirmDialog({
      title: "确认一键清洗",
      message: `将执行以下操作：\n1. 去除所有单元格的前后空格\n2. 删除 ${removedRows} 行空行\n3. 将日期格式统一为 YYYY-MM-DD`,
      onConfirm: () => {
        setConfirmDialog(prev => prev ? { ...prev, disabled: true } : null);
        applyOneClickClean(currentData);
        setConfirmDialog(null);
        showToast("一键清洗完成", "success");
      },
      confirmClassName: "bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600",
    });
  }, [currentData, applyOneClickClean, showToast]);

  // SKU映射
  const handleImportMapping = useCallback(async () => {
    try {
      const result = await openDataFiles();
      if (!result.canceled && result.filePaths.length > 0) {
        const fileData = await processFile(result.filePaths[0]);
        if (fileData) {
          setMappingFile(fileData);
          const mappings: SKUMapping[] = fileData.data
            .slice(1)
            .map((row) => ({
              platformName: String(row[0] || "").trim(),
              internalCode: String(row[1] || "").trim(),
              price: parseFloat(String(row[2] || 0).replace(/[¥$,]/g, "")) || 0,
            }))
            .filter((m) => m.platformName && m.internalCode);
          setSkuMappings(mappings);
        }
      }
    } catch (error) {
      reportError("导入映射表", error);
    }
  }, [reportError]);

  const handleApplyMapping = useCallback(() => {
    if (currentData.length === 0 || skuMappings.length === 0) return;
    const headers = currentData[0];
    const dataRows = currentData.slice(1);
    const mappedRows = dataRows.map((row) => {
      const newRow = [...row];
      for (let i = 0; i < newRow.length; i++) {
        const cell = String(newRow[i] || "").trim();
        const mapping = skuMappings.find((m) => m.platformName === cell);
        if (mapping && !newRow.includes(mapping.internalCode))
          newRow.push(mapping.internalCode);
      }
      return newRow;
    });
    const newData = [[...headers, "内部编码"], ...mappedRows];
    setCurrentData(newData);
    saveHistory(newData, [...headers, "内部编码"]);
  }, [currentData, skuMappings, saveHistory]);

  // 收款对账
  const handleImportPayment = useCallback(async () => {
    try {
      const result = await openDataFiles();
      if (!result.canceled && result.filePaths.length > 0) {
        const fileData = await processFile(result.filePaths[0]);
        if (fileData) setPaymentFile(fileData);
      }
    } catch (error) {
      reportError("导入收款流水", error);
    }
  }, [reportError]);

  const handleReconcile = useCallback(() => {
    if (currentData.length === 0 || !paymentFile) return;
    const orderRows = currentData.slice(1);
    const paymentRows = paymentFile.data.slice(1);
    const reconciled: any[][] = [["订单金额", "收款金额", "状态", "说明"]];
    const unmatchedPayments = [...paymentRows];
    orderRows.forEach((order) => {
      const orderAmount = findAmount(order);
      if (orderAmount === 0) return;
      const matchIdx = unmatchedPayments.findIndex(
        (pay) => Math.abs(findAmount(pay) - orderAmount) < 0.01,
      );
      if (matchIdx >= 0) {
        reconciled.push([
          orderAmount,
          findAmount(unmatchedPayments[matchIdx]),
          "已核销",
          "匹配成功",
        ]);
        unmatchedPayments.splice(matchIdx, 1);
      } else {
        reconciled.push([orderAmount, "", "未匹配", "无对应收款记录"]);
      }
    });
    unmatchedPayments.forEach((pay) =>
      reconciled.push(["", findAmount(pay), "未认领", "无对应订单"]),
    );
    setCurrentData(reconciled);
    setCurrentHeaders(reconciled[0]);
    setIsMerged(false);
    saveHistory(reconciled, reconciled[0]);
  }, [currentData, paymentFile, saveHistory]);

  // 账单导入
  const handleImportBill = useCallback(async () => {
    try {
      const result = await openDataFiles();
      if (!result.canceled && result.filePaths.length > 0) {
        for (const filePath of result.filePaths) {
          const fileData = await processFile(filePath);
          if (fileData) {
            const record = parseBill(fileData);
            setBillRecords((prev) => {
              if (prev.find((r) => r.fileName === record.fileName)) return prev;
              return [...prev, record];
            });
          }
        }
      }
    } catch (error) {
      reportError("导入账单", error);
    }
  }, [reportError]);

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

  // 佣金计提
  const handleGenerateAccrual = useCallback(() => {
    if (billRecords.length === 0) return;
    const headers = [
      "平台",
      "账期",
      "账单金额",
      "订单笔数",
      "佣金",
      "技术服务费",
      "补贴/返点",
      "净收款",
      "佣金率",
      "技术服务费率",
      "是否跨期",
    ];
    const rows = billRecords.map((b) => {
      const commRate =
        b.totalAmount > 0
          ? ((b.commission / b.totalAmount) * 100).toFixed(2) + "%"
          : "0%";
      const techRate =
        b.totalAmount > 0
          ? ((b.techFee / b.totalAmount) * 100).toFixed(2) + "%"
          : "0%";
      const today = new Date();
      const billDate = new Date(b.date);
      const isCrossPeriod =
        !isNaN(billDate.getTime()) && billDate.getMonth() !== today.getMonth();
      return [
        b.platform,
        b.date,
        b.totalAmount.toFixed(2),
        b.orderCount,
        b.commission.toFixed(2),
        b.techFee.toFixed(2),
        b.subsidy.toFixed(2),
        b.netAmount.toFixed(2),
        commRate,
        techRate,
        isCrossPeriod ? "⚠️跨期" : "当月",
      ];
    });
    const totalRow = [
      "合计",
      "",
      billRecords.reduce((s, b) => s + b.totalAmount, 0).toFixed(2),
      billRecords.reduce((s, b) => s + b.orderCount, 0),
      billRecords.reduce((s, b) => s + b.commission, 0).toFixed(2),
      billRecords.reduce((s, b) => s + b.techFee, 0).toFixed(2),
      billRecords.reduce((s, b) => s + b.subsidy, 0).toFixed(2),
      billRecords.reduce((s, b) => s + b.netAmount, 0).toFixed(2),
      "",
      "",
      "",
    ];
    const data = [headers, ...rows, totalRow];
    setAccrualData(data);
    setCurrentData(data);
    setCurrentHeaders(headers);
    saveHistory(data, headers);
  }, [billRecords, saveHistory]);

  const handleRemoveBill = (idx: number) =>
    setBillRecords((prev) => prev.filter((_, i) => i !== idx));

  // ========== P1: 退款损失还原 ==========
  const handleImportRefund = useCallback(async () => {
    try {
      const result = await openDataFiles();
      if (!result.canceled && result.filePaths.length > 0) {
        const fileData = await processFile(result.filePaths[0]);
        if (fileData) {
          setRefundFile(fileData);
          const headers = fileData.headers;
          const rows = fileData.data.slice(1);
          const idCol = findCol(headers, ["订单号", "order", "编号", "id"]);
          const amtCol = findCol(headers, ["退款", "refund", "金额", "amount"]);
          const dateCol = findCol(headers, ["日期", "time", "date", "时间"]);
          const platformCol = findCol(headers, ["平台", "source", "渠道"]);
          const records: RefundOrder[] = rows.map((row) => ({
            platform:
              platformCol >= 0
                ? String(row[platformCol] || detectPlatform(fileData.name))
                : detectPlatform(fileData.name),
            orderId: idCol >= 0 ? String(row[idCol] || "") : "",
            refundAmount: amtCol >= 0 ? Math.abs(findAmount([row[amtCol]])) : 0,
            refundDate: dateCol >= 0 ? String(row[dateCol] || "") : "",
            commissionLost: 0,
          }));
          // 估算佣金损失：按平均佣金率估算（用账单数据）
          const avgCommRate =
            billRecords.length > 0
              ? billRecords.reduce((s, b) => s + b.commission, 0) /
                Math.max(
                  1,
                  billRecords.reduce((s, b) => s + b.totalAmount, 0),
                )
              : 0.05; // 默认5%
          records.forEach((r) => {
            r.commissionLost = r.refundAmount * avgCommRate;
          });
          setRefundRecords(records);
        }
      }
    } catch (error) {
      reportError("导入退款单", error);
    }
  }, [billRecords, reportError]);

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

  const handleExportRefundLoss = useCallback(async () => {
    if (refundLossData.length === 0) return;
    try {
      const result = await saveDataFile(
        `退款损失还原_${new Date().toISOString().slice(0, 7)}.xlsx`,
      );
      if (!result.canceled && result.filePath)
        await exportToExcel(refundLossData, result.filePath);
    } catch (error) {
      reportError("导出退款损失表", error);
    }
  }, [refundLossData, reportError]);

  // ========== P1: 品牌阶梯返利计算 ==========
  const calculateRebate = useCallback((gmvWan: number, tiers: RebateTier[]) => {
    let remaining = gmvWan;
    let totalRebate = 0;
    const details: any[][] = [];
    for (const tier of tiers) {
      if (remaining <= 0) break;
      const tierMax = tier.max > 0 ? tier.max : remaining + 1;
      const applicable = Math.min(remaining, tierMax - tier.min);
      if (applicable > 0) {
        const rebate = (applicable * tier.rate) / 100;
        totalRebate += rebate;
        details.push([
          tier.label,
          `${tier.min}-${tier.max === 0 ? "∞" : tier.max}万`,
          `${tier.rate}%`,
          `${applicable.toFixed(2)}万`,
          `${rebate.toFixed(4)}万`,
        ]);
        remaining -= applicable;
      }
    }
    return { totalRebate, details };
  }, []);

  const handleGenerateRebate = useCallback(() => {
    const gmvYuan = rebateGMV;
    if (gmvYuan <= 0) return;
    const gmvWan = gmvYuan / 10000;
    const tiers = customTiers.length > 0 ? customTiers : rebateTiers;
    const { totalRebate, details } = calculateRebate(gmvWan, tiers);
    const headers = [
      "阶梯区间",
      "区间范围(万)",
      "返利比例",
      "适用GMV(万)",
      "返利金额(万)",
    ];
    const data = [
      headers,
      ...details,
      ["", "", "", "返利合计(万)", totalRebate.toFixed(4)],
      ["", "", "", "折合人民币", `¥${(totalRebate * 10000).toFixed(2)}`],
    ];
    setRebateResult(data);
    setCurrentData(data);
    setCurrentHeaders(headers);
    saveHistory(data, headers);
  }, [
    rebateGMV,
    rebateBrand,
    customTiers,
    rebateTiers,
    calculateRebate,
    saveHistory,
  ]);

  const handleExportRebate = useCallback(async () => {
    if (!rebateResult || rebateResult.length === 0) return;
    try {
      const result = await saveDataFile(
        `品牌返利计算_${rebateBrand || "通用"}_${new Date().toISOString().slice(0, 7)}.xlsx`,
      );
      if (!result.canceled && result.filePath)
        await exportToExcel(rebateResult, result.filePath);
    } catch (error) {
      reportError("导出品牌返利表", error);
    }
  }, [rebateResult, rebateBrand, reportError]);

  const handleExportWithPanel = useCallback(() => {
    if (currentData.length === 0) return;
    setShowExportPanel(true);
  }, [currentData]);

  const handleDoExport = useCallback(async (format: "xlsx" | "csv", encoding?: "utf-8" | "gbk", delimiter?: string) => {
    if (currentData.length === 0) return;
    setShowExportPanel(false);
    try {
      const result = await saveDataFile(`清洗后数据.${format === "csv" ? "csv" : "xlsx"}`);
      if (!result.canceled && result.filePath) {
        if (format === "csv") {
          await exportToCSV(currentData, result.filePath, encoding, delimiter);
        } else {
          await exportToExcel(currentData, result.filePath);
        }
        showToast(`导出成功`, "success");
      }
    } catch (error) {
      reportError("导出数据", error);
    }
  }, [currentData, reportError]);

  const handleClear = useCallback(() => {
    setFiles([]);
    setSelectedFileIndex(null);
    setCurrentData([]);
    setCurrentHeaders([]);
    setMergedData(null);
    setIsMerged(false);
    setSearchText("");
    setHistory([]);
    setHistoryIndex(-1);
    setOrderStats(null);
    setSkuMappings([]);
    setMappingFile(null);
    setPaymentFile(null);
    setBillRecords([]);
    setAccrualData([]);
    setRefundFile(null);
    setRefundRecords([]);
    setRefundLossData([]);
    setRebateResult(null);
    setRebateGMV(0);
    setRebateBrand("");
    setCustomTiers([]);
  }, []);

  const filteredData = useMemo(() => {
    if (!searchText.trim()) return currentData;
    const lower = searchText.toLowerCase();
    return [
      currentData[0],
      ...currentData
        .slice(1)
        .filter((row) =>
          row.some((cell) => String(cell).toLowerCase().includes(lower)),
        ),
    ];
  }, [currentData, searchText]);

  const platformColor: Record<string, string> = {
    淘宝: "bg-orange-100 text-orange-700",
    天猫: "bg-red-100 text-red-700",
    京东: "bg-blue-100 text-blue-700",
    抖音电商: "bg-pink-100 text-pink-700",
    快手电商: "bg-purple-100 text-purple-700",
    拼多多: "bg-yellow-100 text-yellow-700",
  };
  const color = (p: string) => platformColor[p] || "bg-gray-100 text-gray-700";

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {runtimeNotice && (
        <div
          className={`px-4 py-2 text-sm border-b ${desktopReady ? "bg-red-50 text-red-700 border-red-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}
        >
          {runtimeNotice}
        </div>
      )}

      <div className="bg-white border-b border-gray-200 px-4 py-1.5 flex items-center gap-1 flex-wrap">
        {[
          { key: "data", label: "📊 数据处理" },
          { key: "mapping", label: "🏷️ SKU映射" },
          { key: "reconcile", label: "🧾 收款对账" },
          { key: "bill", label: "📄 账单对账" },
          { key: "rebate", label: "💰 品牌返利" },
          { key: "monthly", label: "📅 月度汇总" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as Tab)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeTab === tab.key ? "bg-blue-100 text-blue-700 border border-blue-300" : "text-gray-600 hover:bg-gray-100"}`}
          >
            {tab.label}
          </button>
        ))}

        {orderStats && activeTab === "data" && (
          <div className="ml-3 flex items-center gap-3 text-xs text-gray-600">
            <span>
              📦 <strong>{orderStats.totalOrders}</strong>
            </span>
            <span>
              💰 <strong>¥{orderStats.totalAmount.toFixed(0)}</strong>
            </span>
            {Object.entries(orderStats.platformBreakdown).map(([p, s]) => (
              <span
                key={p}
                className={`px-1.5 py-0.5 rounded text-xs ${color(p)}`}
              >
                {p}: {s.count}单
              </span>
            ))}
          </div>
        )}
        <div className="flex-1" />
        <div className="flex items-center gap-1 border border-gray-300 rounded-lg px-2 py-1 bg-gray-50">
          <span className="text-gray-400 text-xs">🔍</span>
          <input
            type="text"
            placeholder="搜索..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="border-none outline-none bg-transparent text-xs w-28"
          />
          {searchText && (
            <button
              onClick={() => setSearchText("")}
              className="text-gray-400 text-xs"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* ========== SKU映射 ========== */}
      {activeTab === "mapping" && (
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-xl shadow p-6">
              <h2 className="font-semibold text-gray-800 mb-1">
                🏷️ SKU 映射表
              </h2>
              <p className="text-sm text-gray-500 mb-4">平台品名 → 内部编码</p>
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center mb-4">
                {mappingFile ? (
                  <div className="text-green-600">
                    <div className="text-2xl mb-2">✅</div>
                    <div className="font-medium">{mappingFile.name}</div>
                    <div className="text-sm text-gray-500 mt-1">
                      {skuMappings.length} 条规则
                    </div>
                    <button
                      onClick={() => {
                        setMappingFile(null);
                        setSkuMappings([]);
                      }}
                      className="mt-2 text-xs text-red-500 hover:underline"
                    >
                      移除
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="text-3xl mb-2">📤</div>
                    <div className="text-gray-600 mb-2">选择映射文件</div>
                    <button
                      onClick={handleImportMapping}
                      disabled={!desktopReady}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm disabled:opacity-40"
                    >
                      选择文件
                    </button>
                  </>
                )}
              </div>
              {skuMappings.length > 0 && (
                <button
                  onClick={handleApplyMapping}
                  disabled={currentData.length === 0}
                  className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm disabled:opacity-40 mb-4"
                >
                  应用到当前数据 ({currentData.length - 1}行)
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========== 收款对账 ========== */}
      {activeTab === "reconcile" && (
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-xl shadow p-6">
              <h2 className="font-semibold text-gray-800 mb-1">🧾 收款对账</h2>
              <p className="text-sm text-gray-500 mb-4">收款流水 vs 订单金额</p>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center">
                  {paymentFile ? (
                    <div className="text-green-600">
                      <div className="text-2xl mb-1">✅</div>
                      <div className="text-sm font-medium">
                        {paymentFile.name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {paymentFile.data.length - 1} 条
                      </div>
                      <button
                        onClick={() => setPaymentFile(null)}
                        className="mt-1 text-xs text-red-500 hover:underline"
                      >
                        移除
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="text-2xl mb-1">💳</div>
                      <div className="text-sm text-gray-600 mb-2">收款流水</div>
                      <button
                        onClick={handleImportPayment}
                        disabled={!desktopReady}
                        className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-40"
                      >
                        选择文件
                      </button>
                    </>
                  )}
                </div>
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center">
                  <div className="text-2xl mb-1">📦</div>
                  <div className="text-sm text-gray-600 mb-2">当前订单</div>
                  <div className="text-sm font-medium">
                    {currentData.length - 1} 行
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    ¥
                    {currentData
                      .slice(1)
                      .reduce((s, r) => s + findAmount(r), 0)
                      .toFixed(2)}
                  </div>
                </div>
              </div>
              <button
                onClick={handleReconcile}
                disabled={currentData.length === 0 || !paymentFile}
                className="w-full px-4 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 text-sm font-medium disabled:opacity-40"
              >
                开始对账 →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== 账单对账 ========== */}
      {activeTab === "bill" && (
        <div className="flex-1 overflow-auto p-6">
          <div className="space-y-6 max-w-5xl mx-auto">
            {/* 账单列表 */}
            <div className="bg-white rounded-xl shadow">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-gray-800">📄 平台账单</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    导入各平台月末账单，自动解析佣金/扣点/补贴
                  </p>
                </div>
                <button
                  onClick={handleImportBill}
                  disabled={!desktopReady}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm disabled:opacity-40"
                >
                  + 导入账单
                </button>
              </div>
              {billRecords.length === 0 ? (
                <div className="p-12 text-center text-gray-400">
                  <div className="text-4xl mb-3">📋</div>
                  <div className="text-sm">暂无账单</div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        {[
                          "平台",
                          "文件名",
                          "账期",
                          "账单金额",
                          "订单数",
                          "佣金",
                          "技术服务费",
                          "补贴",
                          "净收款",
                          "操作",
                        ].map((h) => (
                          <th
                            key={h}
                            className="px-4 py-2.5 text-left text-xs text-gray-500 font-medium"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {billRecords.map((b, i) => (
                        <tr key={i} className="border-t hover:bg-gray-50">
                          <td className="px-4 py-2.5">
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-medium ${color(b.platform)}`}
                            >
                              {b.platform}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-gray-600 max-w-[120px] truncate">
                            {b.fileName}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-gray-500">
                            {b.date}
                          </td>
                          <td className="px-4 py-2.5 text-right font-medium">
                            ¥{b.totalAmount.toFixed(0)}
                          </td>
                          <td className="px-4 py-2.5 text-right text-gray-500">
                            {b.orderCount}
                          </td>
                          <td className="px-4 py-2.5 text-right text-red-600">
                            -¥{b.commission.toFixed(0)}
                          </td>
                          <td className="px-4 py-2.5 text-right text-orange-600">
                            -¥{b.techFee.toFixed(0)}
                          </td>
                          <td className="px-4 py-2.5 text-right text-green-600">
                            +¥{b.subsidy.toFixed(0)}
                          </td>
                          <td className="px-4 py-2.5 text-right font-bold text-blue-700">
                            ¥{b.netAmount.toFixed(0)}
                          </td>
                          <td className="px-4 py-2.5">
                            <button
                              onClick={() => setShowBillDetail(b)}
                              className="text-xs text-blue-600 hover:underline mr-2"
                            >
                              查看
                            </button>
                            <button
                              onClick={() => handleRemoveBill(i)}
                              className="text-xs text-red-500 hover:underline"
                            >
                              移除
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {billRecords.length > 1 && (
                      <tfoot className="bg-gray-50 font-bold">
                        <tr>
                          <td
                            className="px-4 py-2.5 text-xs text-gray-500"
                            colSpan={3}
                          >
                            合计 ({billRecords.length}个平台)
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            ¥
                            {billRecords
                              .reduce((s, b) => s + b.totalAmount, 0)
                              .toFixed(0)}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            {billRecords.reduce((s, b) => s + b.orderCount, 0)}
                          </td>
                          <td className="px-4 py-2.5 text-right text-red-600">
                            -¥
                            {billRecords
                              .reduce((s, b) => s + b.commission, 0)
                              .toFixed(0)}
                          </td>
                          <td className="px-4 py-2.5 text-right text-orange-600">
                            -¥
                            {billRecords
                              .reduce((s, b) => s + b.techFee, 0)
                              .toFixed(0)}
                          </td>
                          <td className="px-4 py-2.5 text-right text-green-600">
                            +¥
                            {billRecords
                              .reduce((s, b) => s + b.subsidy, 0)
                              .toFixed(0)}
                          </td>
                          <td className="px-4 py-2.5 text-right text-blue-700">
                            ¥
                            {billRecords
                              .reduce((s, b) => s + b.netAmount, 0)
                              .toFixed(0)}
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              )}
            </div>

            {/* 佣金计提 */}
            {billRecords.length > 0 && (
              <div className="bg-white rounded-xl shadow">
                <div className="p-4 border-b border-gray-100 flex items-center justify-between">
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
                  <div className="flex gap-2">
                    <button
                      onClick={handleGenerateAccrual}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
                    >
                      🔄 重新生成
                    </button>
                    <button
                      onClick={handleImportCommissionDetails}
                      disabled={!desktopReady}
                      className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm disabled:opacity-40"
                    >
                      📋 导入佣金明细
                    </button>
                    {accrualData.length > 0 && (
                      <button
                        onClick={async () => {
                          try {
                            const result = await saveDataFile(
                              `佣金计提表_${new Date().toISOString().slice(0, 7)}.xlsx`,
                            );
                            if (!result.canceled && result.filePath)
                              await exportToExcel(accrualData, result.filePath);
                          } catch (error) {
                            reportError("导出佣金计提表", error);
                          }
                        }}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                      >
                        📥 导出Excel
                      </button>
                    )}
                  </div>
                </div>
                {accrualData.length > 0 ? (
                  <div className="overflow-x-auto max-h-80">
                    <table className="w-full text-sm">
                      <thead className="bg-purple-50 sticky top-0">
                        <tr>
                          {accrualData[0].map((h: string, i: number) => (
                            <th
                              key={i}
                              className="px-3 py-2 text-left text-xs text-purple-700 font-medium whitespace-nowrap"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {accrualData.slice(1).map((row: any[], i: number) => (
                          <tr
                            key={i}
                            className={`border-t ${i === accrualData.length - 2 ? "bg-yellow-50 font-medium" : ""}`}
                          >
                            {row.map((cell: any, j: number) => (
                              <td
                                key={j}
                                className={`px-3 py-2 text-xs ${j >= 2 && j <= 7 && typeof cell === "string" && cell.startsWith("-") ? "text-red-600" : ""}`}
                              >
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-8 text-center text-gray-400 text-sm">
                    点击「重新生成」
                  </div>
                )}
              </div>
            )}

            {/* 退款损失还原 */}
            <div className="bg-white rounded-xl shadow">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-gray-800">
                    🔴 退款损失还原
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {commissionDetails.length > 0
                      ? "已导入佣金明细，可精确计算退款损失"
                      : "导入佣金明细文件后可精确计算损失，否则使用估算"}
                  </p>
                </div>
                <button
                  onClick={handleImportRefund}
                  disabled={!desktopReady}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm disabled:opacity-40"
                >
                  + 导入退款单
                </button>
              </div>
              <div className="p-4">
                {refundRecords.length === 0 ? (
                  <div className="text-center text-gray-400 py-6 text-sm">
                    导入退款单后自动计算佣金损失
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex gap-3 text-xs">
                      <span className="bg-red-50 px-3 py-1.5 rounded">
                        退款笔数: <strong>{refundRecords.length}</strong>
                      </span>
                      <span className="bg-red-50 px-3 py-1.5 rounded">
                        退款总额:{" "}
                        <strong>
                          ¥
                          {refundRecords
                            .reduce((s, r) => s + r.refundAmount, 0)
                            .toFixed(2)}
                        </strong>
                      </span>
                      <span className="bg-orange-50 px-3 py-1.5 rounded">
                        预估佣金损失:{" "}
                        <strong>
                          ¥
                          {(
                            refundRecords.reduce(
                              (s, r) => s + r.refundAmount,
                              0,
                            ) *
                            (billRecords.length > 0
                              ? billRecords.reduce(
                                  (s, b) => s + b.commission,
                                  0,
                                ) /
                                Math.max(
                                  1,
                                  billRecords.reduce(
                                    (s, b) => s + b.totalAmount,
                                    0,
                                  ),
                                )
                              : 0.05)
                          ).toFixed(2)}
                        </strong>
                      </span>
                    </div>
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
                    <div className="flex gap-3">
                      <button
                        onClick={handleGenerateRefundLoss}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
                      >
                        📊 生成退款损失表
                      </button>
                      {refundLossData.length > 0 && (
                        <button
                          onClick={handleExportRefundLoss}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                        >
                          📥 导出
                        </button>
                      )}
                    </div>
                    {refundLossData.length > 0 && (
                      <div className="mt-3 overflow-x-auto max-h-60 border rounded">
                        <table className="w-full text-xs">
                          <thead className="bg-red-50 sticky top-0">
                            <tr>
                              {refundLossData[0].map((h: string, i: number) => (
                                <th
                                  key={i}
                                  className="px-3 py-2 text-left text-red-700"
                                >
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {refundLossData
                              .slice(1)
                              .map((row: any[], i: number) => (
                                <tr key={i} className="border-t">
                                  {row.map((cell: any, j: number) => (
                                    <td
                                      key={j}
                                      className={`px-3 py-1.5 ${j >= 3 && j <= 5 ? "text-right text-red-600 font-medium" : ""}`}
                                    >
                                      {cell}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========== 品牌返利 ========== */}
      {activeTab === "rebate" && (
        <div className="flex-1 overflow-auto p-6">
          <div className="space-y-6 max-w-4xl mx-auto">
            <div className="bg-white rounded-xl shadow p-6">
              <h2 className="font-semibold text-gray-800 mb-1">
                💰 品牌阶梯返利计算
              </h2>
              <p className="text-sm text-gray-500 mb-4">
                设置品牌月GMV，自动按阶梯计算返利金额
              </p>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    品牌名称
                  </label>
                  <input
                    type="text"
                    value={rebateBrand}
                    onChange={(e) => setRebateBrand(e.target.value)}
                    placeholder="如：海信、美的、TCL"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    月GMV（元）
                  </label>
                  <input
                    type="number"
                    value={rebateGMV || ""}
                    onChange={(e) =>
                      setRebateGMV(parseFloat(e.target.value) || 0)
                    }
                    placeholder="输入月GMV，如：3560000"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* 阶梯规则 */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">
                  返利阶梯规则
                </h3>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-blue-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs text-blue-700 font-medium">
                          阶梯
                        </th>
                        <th className="px-4 py-2 text-left text-xs text-blue-700 font-medium">
                          GMV范围(万)
                        </th>
                        <th className="px-4 py-2 text-left text-xs text-blue-700 font-medium">
                          返利比例
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(customTiers.length > 0 ? customTiers : rebateTiers).map(
                        (tier, i) => (
                          <tr key={i} className="border-t">
                            <td className="px-4 py-2 text-gray-700">
                              {tier.label}
                            </td>
                            <td className="px-4 py-2 text-gray-500">
                              {tier.min}万 ~{" "}
                              {tier.max === 0 ? "无上限" : `${tier.max}万`}
                            </td>
                            <td className="px-4 py-2">
                              <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-sm font-bold">
                                {tier.rate}%
                              </span>
                            </td>
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <button
                onClick={handleGenerateRebate}
                disabled={rebateGMV <= 0}
                className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 text-sm font-medium disabled:opacity-40 w-full mb-4"
              >
                🧮 计算返利
              </button>

              {/* 返利预览 */}
              {rebateResult && rebateResult.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-green-50 px-4 py-2 flex items-center justify-between">
                    <span className="text-sm font-semibold text-green-800">
                      返利计算结果
                    </span>
                    <button
                      onClick={handleExportRebate}
                      className="px-3 py-1 bg-green-600 text-white rounded-lg text-xs hover:bg-green-700"
                    >
                      📥 导出Excel
                    </button>
                  </div>
                  <div className="overflow-x-auto max-h-60">
                    <table className="w-full text-sm">
                      <thead className="bg-green-50 sticky top-0">
                        <tr>
                          {rebateResult[0].map((h: string, i: number) => (
                            <th
                              key={i}
                              className="px-3 py-2 text-left text-xs text-green-700"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rebateResult.slice(1).map((row: any[], i: number) => (
                          <tr
                            key={i}
                            className={`border-t ${i === rebateResult.length - 2 || i === rebateResult.length - 1 ? "bg-green-50 font-bold" : ""}`}
                          >
                            {row.map((cell: any, j: number) => (
                              <td
                                key={j}
                                className={`px-3 py-2 text-xs ${j >= 3 ? "text-right" : ""}`}
                              >
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
                💡 提示：返利金额按阶梯累进计算，例如 GMV 120万 = 50万×2% +
                50万×3% + 20万×4%
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========== 月度汇总Tab ========== */}
      {activeTab === "monthly" && (
        <MonthlySummary
          billRecords={billRecords}
          refundRecords={refundRecords}
          onImportBill={handleImportBill}
          desktopReady={desktopReady}
        />
      )}

      {/* ========== 数据处理Tab ========== */}
      {activeTab === "data" && (
        <>
          <Toolbar
            onImport={handleImportOrders}
            onShowExportPanel={handleExportWithPanel}
            onMerge={handleMergeWithPreview}
            onDeduplicate={handleDeduplicateWithConfirm}
            onCleanEmpty={handleCleanEmptyWithConfirm}
            onTrimWhitespace={handleTrimWhitespaceWithConfirm}
            onClear={handleClear}
            onUndo={handleUndo}
            onStandardizeDate={handleStandardizeDateWithConfirm}
            onFillEmpty={handleFillEmptyWithConfirm}
            onSelectColumns={handleSelectColumnsWithConfirm}
            onOneClickClean={handleOneClickCleanWithConfirm}
            hasData={currentData.length > 0}
            canMerge={files.length >= 2}
            headers={currentHeaders}
            canUndo={historyIndex > 0}
            desktopReady={desktopReady}
          />
          <div className="flex-1 flex overflow-hidden">
            <FileSidebar
              files={files}
              selectedIndex={selectedFileIndex}
              onSelect={handleFileSelect}
              onRemove={handleRemoveFile}
              isMerged={isMerged}
            />
            <DataTable data={filteredData} headers={currentHeaders} />
          </div>
          <StatusBar
            rowCount={currentData.length - 1}
            filteredRowCount={filteredData.length - 1}
            fileCount={files.length}
            selectedFile={
              selectedFileIndex !== null ? files[selectedFileIndex]?.name : null
            }
            isMerged={isMerged}
            isFiltered={searchText.trim().length > 0}
          />
        </>
      )}

      {/* 账单详情弹窗 */}
      {showBillDetail && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setShowBillDetail(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-[90vw] max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-800">
                  {showBillDetail.fileName}
                </h3>
                <p className="text-xs text-gray-500">
                  {showBillDetail.platform} · {showBillDetail.date}
                </p>
              </div>
              <button
                onClick={() => setShowBillDetail(null)}
                className="text-gray-400 hover:text-gray-600 text-xl"
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <div className="mb-4 flex gap-4 text-sm flex-wrap">
                <div className="bg-gray-50 rounded-lg px-4 py-2 text-center">
                  <div className="text-xs text-gray-500">账单金额</div>
                  <div className="font-bold text-lg">
                    ¥{showBillDetail.totalAmount.toFixed(2)}
                  </div>
                </div>
                <div className="bg-red-50 rounded-lg px-4 py-2 text-center">
                  <div className="text-xs text-gray-500">佣金</div>
                  <div className="font-bold text-lg text-red-600">
                    -¥{showBillDetail.commission.toFixed(2)}
                  </div>
                </div>
                <div className="bg-orange-50 rounded-lg px-4 py-2 text-center">
                  <div className="text-xs text-gray-500">技术服务费</div>
                  <div className="font-bold text-lg text-orange-600">
                    -¥{showBillDetail.techFee.toFixed(2)}
                  </div>
                </div>
                <div className="bg-green-50 rounded-lg px-4 py-2 text-center">
                  <div className="text-xs text-gray-500">补贴/返点</div>
                  <div className="font-bold text-lg text-green-600">
                    +¥{showBillDetail.subsidy.toFixed(2)}
                  </div>
                </div>
                <div className="bg-blue-50 rounded-lg px-4 py-2 text-center">
                  <div className="text-xs text-gray-500">净收款</div>
                  <div className="font-bold text-lg text-blue-700">
                    ¥{showBillDetail.netAmount.toFixed(2)}
                  </div>
                </div>
              </div>
              <DataTable
                data={showBillDetail.rawData}
                headers={showBillDetail.rawData[0] || []}
              />
            </div>
          </div>
        </div>
      )}
      <Toast toasts={toasts} onDismiss={dismissToast} />
      <ConfirmDialog
        open={confirmDialog !== null}
        title={confirmDialog?.title || ""}
        message={confirmDialog?.message || ""}
        confirmLabel={confirmDialog?.confirmLabel}
        confirmClassName={confirmDialog?.confirmClassName}
        disabled={confirmDialog?.disabled}
        onConfirm={confirmDialog?.onConfirm || (() => {})}
        onCancel={() => setConfirmDialog(null)}
      />
      <ExportPanel
        open={showExportPanel}
        onExport={handleDoExport}
        onCancel={() => setShowExportPanel(false)}
      />
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
    </div>
  );
}

export default App;
