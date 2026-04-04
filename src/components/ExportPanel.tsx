import { useState } from "react";
import { Download } from "lucide-react";

interface ExportPanelProps {
  open: boolean;
  onExport: (format: "xlsx" | "csv", encoding?: "utf-8", delimiter?: string) => void;
  onCancel: () => void;
}

export default function ExportPanel({ open, onExport, onCancel }: ExportPanelProps) {
  const [format, setFormat] = useState<"xlsx" | "csv">("xlsx");
  const [encoding, setEncoding] = useState<"utf-8">("utf-8");
  // Store delimiter as descriptive string, convert to actual char when exporting
  const [delimiter, setDelimiter] = useState<"," | "tab">(",");

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
                onChange={(e) => setEncoding(e.target.value as "utf-8")}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="utf-8">UTF-8</option>
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
                  <input type="radio" value="tab" checked={delimiter === "tab"} onChange={() => setDelimiter("tab")} />
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
            onClick={() => {
              // Convert delimiter string to actual character
              const actualDelimiter = delimiter === "tab" ? "\t" : ",";
              onExport(format, encoding, actualDelimiter);
            }}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
          >
            导出
          </button>
        </div>
      </div>
    </div>
  );
}
