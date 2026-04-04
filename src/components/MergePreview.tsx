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
