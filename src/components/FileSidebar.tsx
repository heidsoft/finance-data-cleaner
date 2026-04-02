import { FileText, X, Users } from 'lucide-react'
import { FileData } from '../utils/excel'

interface FileSidebarProps {
  files: FileData[]
  selectedIndex: number | null
  onSelect: (index: number) => void
  onRemove: (index: number) => void
  isMerged: boolean
}

export default function FileSidebar({ 
  files, 
  selectedIndex, 
  onSelect, 
  onRemove,
  isMerged 
}: FileSidebarProps) {
  if (isMerged) {
    return (
      <div className="w-56 bg-gray-100 border-r border-gray-200 p-4">
        <div className="flex items-center gap-2 text-gray-600 mb-4">
          <Users size={18} />
          <span className="font-medium">已合并</span>
        </div>
        <div className="text-sm text-gray-500">
          {files.length} 个文件已合并
        </div>
      </div>
    )
  }

  return (
    <div className="w-56 bg-gray-100 border-r border-gray-200 flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <h2 className="font-semibold text-gray-700">文件列表 ({files.length})</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {files.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            <FileText size={48} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">暂无文件</p>
            <p className="text-xs mt-1">点击"导入文件"添加</p>
          </div>
        ) : (
          <div className="space-y-2">
            {files.map((file, index) => (
              <div
                key={index}
                onClick={() => onSelect(index)}
                className={`p-3 rounded-lg cursor-pointer transition-colors ${
                  selectedIndex === index 
                    ? 'bg-blue-100 border border-blue-300' 
                    : 'bg-white border border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText size={16} className="text-gray-500 flex-shrink-0" />
                    <span className="text-sm text-gray-700 truncate" title={file.name}>
                      {file.name}
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onRemove(index)
                    }}
                    className="text-gray-400 hover:text-red-500 flex-shrink-0"
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="text-xs text-gray-400 mt-1 ml-6">
                  {file.data.length - 1} 行 × {file.headers.length} 列
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}