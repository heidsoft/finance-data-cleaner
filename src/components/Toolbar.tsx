import { useState } from 'react'
import { Upload, Download, Merge, Trash2, Scissors, Eraser, Undo2, Calendar, Columns, Pill } from 'lucide-react'

interface ToolbarProps {
  onImport: () => void
  onExport: (format: 'xlsx' | 'csv') => void
  onMerge: () => void
  onDeduplicate: (columnIndex?: number) => void
  onCleanEmpty: () => void
  onTrimWhitespace: () => void
  onClear: () => void
  onUndo: () => void
  onStandardizeDate: () => void
  onFillEmpty: (value: string) => void
  onSelectColumns: (selectedCols: number[]) => void
  hasData: boolean
  canMerge: boolean
  isMerged: boolean
  headers: string[]
  canUndo: boolean
}

export default function Toolbar({
  onImport,
  onExport,
  onMerge,
  onDeduplicate,
  onCleanEmpty,
  onTrimWhitespace,
  onClear,
  onUndo,
  onStandardizeDate,
  onFillEmpty,
  onSelectColumns,
  hasData,
  canMerge,
  headers,
  canUndo,
}: ToolbarProps) {
  const [showColPicker, setShowColPicker] = useState(false)
  const [showFillModal, setShowFillModal] = useState(false)
  const [fillValue, setFillValue] = useState('0')
  const [selectedCols, setSelectedCols] = useState<number[]>([])
  const [dedupCol, setDedupCol] = useState<number>(-1)

  const handleColToggle = (i: number) => {
    setSelectedCols(prev =>
      prev.includes(i) ? prev.filter(c => c !== i) : [...prev, i].sort((a, b) => a - b)
    )
  }

  return (
    <>
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-2 flex-wrap shadow-sm">
        {/* 导入 */}
        <button
          onClick={onImport}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
        >
          <Upload size={15} />
          <span>导入</span>
        </button>

        <div className="h-5 w-px bg-gray-300" />

        {/* 导出 */}
        <button
          onClick={() => onExport('xlsx')}
          disabled={!hasData}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm disabled:opacity-40"
        >
          <Download size={15} />
          <span>Excel</span>
        </button>
        <button
          onClick={() => onExport('csv')}
          disabled={!hasData}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm disabled:opacity-40"
        >
          <span>CSV</span>
        </button>

        <div className="h-5 w-px bg-gray-300" />

        {/* 合并 */}
        <button
          onClick={onMerge}
          disabled={!canMerge}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm disabled:opacity-40"
        >
          <Merge size={15} />
          <span>合并</span>
        </button>

        <div className="h-5 w-px bg-gray-300" />

        {/* 去重 */}
        <div className="relative">
          <button
            onClick={() => {
              if (dedupCol === -1) {
                onDeduplicate()
              } else {
                onDeduplicate(dedupCol)
              }
            }}
            disabled={!hasData}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors text-sm disabled:opacity-40"
          >
            <Scissors size={15} />
            <span>去重</span>
          </button>
          {hasData && (
            <select
              value={dedupCol}
              onChange={e => setDedupCol(Number(e.target.value))}
              className="absolute inset-0 opacity-0 cursor-pointer w-full"
              title="选择去重列"
            >
              <option value={-1}>全行去重</option>
              {headers.map((h, i) => (
                <option key={i} value={i}>{h || `列${i + 1}`}</option>
              ))}
            </select>
          )}
        </div>

        {/* 清空白 */}
        <button
          onClick={onCleanEmpty}
          disabled={!hasData}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors text-sm disabled:opacity-40"
          title="清除空行空列"
        >
          <Eraser size={15} />
          <span>清空</span>
        </button>

        {/* 日期规范化 */}
        <button
          onClick={onStandardizeDate}
          disabled={!hasData}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors text-sm disabled:opacity-40"
          title="将各种日期格式统一为 YYYY-MM-DD"
        >
          <Calendar size={15} />
          <span>日期格式</span>
        </button>

        {/* Trim */}
        <button
          onClick={onTrimWhitespace}
          disabled={!hasData}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm disabled:opacity-40"
          title="去除首尾空格"
        >
          <span>Trim</span>
        </button>

        {/* 填充空值 */}
        <button
          onClick={() => setShowFillModal(true)}
          disabled={!hasData}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors text-sm disabled:opacity-40"
          title="用指定值填充空单元格"
        >
          <Pill size={15} />
          <span>填空值</span>
        </button>

        {/* 列筛选 */}
        <button
          onClick={() => setShowColPicker(true)}
          disabled={!hasData}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-pink-500 text-white rounded-lg hover:bg-pink-600 transition-colors text-sm disabled:opacity-40"
        >
          <Columns size={15} />
          <span>选列</span>
        </button>

        <div className="h-5 w-px bg-gray-300" />

        {/* 撤销 */}
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm disabled:opacity-40"
        >
          <Undo2 size={15} />
          <span>撤销</span>
        </button>

        <div className="flex-1" />

        {/* 清空全部 */}
        <button
          onClick={onClear}
          disabled={!hasData}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm disabled:opacity-40"
        >
          <Trash2 size={15} />
          <span>清空</span>
        </button>

      </div>

      {/* 列筛选弹窗 */}
      {showColPicker && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-96 max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">选择保留的列</h3>
              <button onClick={() => { setSelectedCols(headers.map((_, i) => i)); setShowColPicker(false); onSelectColumns(headers.map((_, i) => i)); }} className="text-sm text-blue-600 hover:underline">全选并保留</button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 space-y-2">
              {headers.map((h, i) => (
                <label key={i} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                  <input
                    type="checkbox"
                    checked={selectedCols.includes(i)}
                    onChange={() => handleColToggle(i)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-gray-700">{h || `列${i + 1}`}</span>
                </label>
              ))}
            </div>
            <div className="p-4 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => setShowColPicker(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
              >
                取消
              </button>
              <button
                onClick={() => {
                  setShowColPicker(false)
                  onSelectColumns(selectedCols.length > 0 ? selectedCols : headers.map((_, i) => i))
                }}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
              >
                确定 ({selectedCols.length} 列)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 填空值弹窗 */}
      {showFillModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-80 p-6">
            <h3 className="font-semibold text-gray-800 mb-4">填充空单元格</h3>
            <input
              type="text"
              value={fillValue}
              onChange={e => setFillValue(e.target.value)}
              placeholder="输入填充值，如：0、N/A"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4 outline-none focus:border-blue-500"
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  setShowFillModal(false)
                  onFillEmpty(fillValue)
                }
              }}
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowFillModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
              >
                取消
              </button>
              <button
                onClick={() => {
                  setShowFillModal(false)
                  onFillEmpty(fillValue)
                }}
                className="flex-1 px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 text-sm"
              >
                填充
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}