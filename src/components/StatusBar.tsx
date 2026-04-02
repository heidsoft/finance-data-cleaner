import { Database, FileText, Layers } from 'lucide-react'

interface StatusBarProps {
  rowCount: number
  fileCount: number
  selectedFile: string | null
  isMerged: boolean
}

export default function StatusBar({ 
  rowCount, 
  fileCount, 
  selectedFile,
  isMerged 
}: StatusBarProps) {
  return (
    <div className="bg-gray-100 border-t border-gray-200 px-4 py-2 flex items-center gap-6 text-sm text-gray-600">
      <div className="flex items-center gap-2">
        <Database size={14} />
        <span>行数: <strong className="text-gray-800">{rowCount}</strong></span>
      </div>
      
      <div className="flex items-center gap-2">
        <FileText size={14} />
        <span>文件: <strong className="text-gray-800">{fileCount}</strong></span>
      </div>

      {isMerged && (
        <div className="flex items-center gap-2">
          <Layers size={14} className="text-purple-500" />
          <span className="text-purple-600 font-medium">已合并模式</span>
        </div>
      )}

      {selectedFile && !isMerged && (
        <div className="flex-1 text-right truncate">
          当前: {selectedFile}
        </div>
      )}
    </div>
  )
}