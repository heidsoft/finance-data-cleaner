import { Database, FileText, Layers, Filter } from 'lucide-react'

interface StatusBarProps {
  rowCount: number
  filteredRowCount: number
  fileCount: number
  selectedFile: string | null
  isMerged: boolean
  isFiltered: boolean
}

export default function StatusBar({
  rowCount,
  filteredRowCount,
  fileCount,
  selectedFile,
  isMerged,
  isFiltered,
}: StatusBarProps) {
  return (
    <div className="bg-gray-100 border-t border-gray-200 px-4 py-1.5 flex items-center gap-5 text-xs text-gray-600">
      <div className="flex items-center gap-1.5">
        <Database size={12} />
        <span>
          行数: <strong className="text-gray-800">{filteredRowCount}{isFiltered ? ` / ${rowCount}` : ''}</strong>
        </span>
        {isFiltered && <Filter size={12} className="text-blue-500" />}
      </div>

      <div className="flex items-center gap-1.5">
        <FileText size={12} />
        <span>文件: <strong className="text-gray-800">{fileCount}</strong></span>
      </div>

      {isMerged && (
        <div className="flex items-center gap-1.5">
          <Layers size={12} className="text-purple-500" />
          <span className="text-purple-600 font-medium">已合并</span>
        </div>
      )}

      {selectedFile && !isMerged && (
        <div className="flex-1 text-right truncate text-gray-500">
          当前: {selectedFile}
        </div>
      )}
    </div>
  )
}