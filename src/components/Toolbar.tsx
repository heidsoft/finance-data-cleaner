import { Upload, Download, Merge, Trash2, Scissors, Eraser, FileSpreadsheet } from 'lucide-react'

interface ToolbarProps {
  onImport: () => void
  onExport: (format: 'xlsx' | 'csv') => void
  onMerge: () => void
  onDeduplicate: (columnIndex?: number) => void
  onCleanEmpty: () => void
  onTrimWhitespace: () => void
  onClear: () => void
  hasData: boolean
  canMerge: boolean
  isMerged: boolean
}

export default function Toolbar({ 
  onImport, 
  onExport, 
  onMerge, 
  onDeduplicate,
  onCleanEmpty,
  onTrimWhitespace,
  onClear, 
  hasData, 
  canMerge,
  isMerged
}: ToolbarProps) {
  return (
    <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-4 shadow-sm">
      <button
        onClick={onImport}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        <Upload size={18} />
        <span>导入文件</span>
      </button>

      <div className="h-8 w-px bg-gray-300" />

      <button
        onClick={() => onExport('xlsx')}
        disabled={!hasData}
        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Download size={18} />
        <span>导出Excel</span>
      </button>

      <button
        onClick={() => onExport('csv')}
        disabled={!hasData}
        className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <FileSpreadsheet size={18} />
        <span>导出CSV</span>
      </button>

      <div className="h-8 w-px bg-gray-300" />

      <button
        onClick={onMerge}
        disabled={!canMerge}
        className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Merge size={18} />
        <span>合并文件</span>
      </button>

      <div className="h-8 w-px bg-gray-300" />

      <button
        onClick={() => onDeduplicate()}
        disabled={!hasData}
        className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="去除重复行"
      >
        <Scissors size={18} />
        <span>去重</span>
      </button>

      <button
        onClick={onCleanEmpty}
        disabled={!hasData}
        className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="清除空行空列"
      >
        <Eraser size={18} />
        <span>清空</span>
      </button>

      <button
        onClick={onTrimWhitespace}
        disabled={!hasData}
        className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="去除首尾空格"
      >
        <span>Trim</span>
      </button>

      <div className="flex-1" />

      <button
        onClick={onClear}
        disabled={!hasData}
        className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Trash2 size={18} />
        <span>清空全部</span>
      </button>
    </div>
  )
}