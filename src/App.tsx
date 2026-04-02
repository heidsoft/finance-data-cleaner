import { useState, useCallback } from 'react'
import Toolbar from './components/Toolbar'
import FileSidebar from './components/FileSidebar'
import DataTable from './components/DataTable'
import StatusBar from './components/StatusBar'
import { FileData, processFile, exportToExcel, exportToCSV } from './utils/excel'

function App() {
  const [files, setFiles] = useState<FileData[]>([])
  const [selectedFileIndex, setSelectedFileIndex] = useState<number | null>(null)
  const [currentData, setCurrentData] = useState<any[][]>([])
  const [currentHeaders, setCurrentHeaders] = useState<string[]>([])
  const [mergedData, setMergedData] = useState<any[][] | null>(null)
  const [isMerged, setIsMerged] = useState(false)

  const handleImport = useCallback(async () => {
    try {
      const result = await window.electronAPI.openFile()
      if (!result.canceled && result.filePaths.length > 0) {
        const newFiles: FileData[] = []
        for (const filePath of result.filePaths) {
          const fileData = await processFile(filePath)
          if (fileData) {
            newFiles.push(fileData)
          }
        }
        setFiles(prev => [...prev, ...newFiles])
        if (selectedFileIndex === null && newFiles.length > 0) {
          setSelectedFileIndex(files.length)
          setCurrentHeaders(newFiles[0].headers)
          setCurrentData(newFiles[0].data)
          setIsMerged(false)
        }
      }
    } catch (error) {
      console.error('导入文件失败:', error)
    }
  }, [files.length, selectedFileIndex])

  const handleFileSelect = useCallback((index: number) => {
    setSelectedFileIndex(index)
    if (index < files.length) {
      setCurrentHeaders(files[index].headers)
      setCurrentData(files[index].data)
      setIsMerged(false)
    }
  }, [files])

  const handleRemoveFile = useCallback((index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
    if (selectedFileIndex === index) {
      setSelectedFileIndex(null)
      setCurrentData([])
      setCurrentHeaders([])
    } else if (selectedFileIndex !== null && selectedFileIndex > index) {
      setSelectedFileIndex(selectedFileIndex - 1)
    }
  }, [selectedFileIndex])

  const handleMerge = useCallback(() => {
    if (files.length < 2) return
    
    // 找到所有文件的公共列或使用第一个文件的列
    const allHeaders = files.map(f => f.headers)
    const mergedHeaders = allHeaders[0]
    
    // 合并所有数据
    const merged: any[][] = [mergedHeaders]
    files.forEach(file => {
      // 跳过表头，从数据行开始
      const dataRows = file.data.slice(1)
      merged.push(...dataRows)
    })
    
    setMergedData(merged)
    setCurrentHeaders(mergedHeaders)
    setCurrentData(merged)
    setIsMerged(true)
  }, [files])

  const handleDeduplicate = useCallback((columnIndex?: number) => {
    if (currentData.length === 0) return
    
    const headers = currentData[0]
    const dataRows = currentData.slice(1)
    
    let uniqueRows: any[][]
    if (columnIndex !== undefined && columnIndex >= 0) {
      // 按指定列去重
      const seen = new Set()
      uniqueRows = dataRows.filter(row => {
        const key = row[columnIndex]
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
    } else {
      // 全行去重
      const seen = new Set()
      uniqueRows = dataRows.filter(row => {
        const key = JSON.stringify(row)
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
    }
    
    setCurrentData([headers, ...uniqueRows])
    
    // 更新文件数据
    if (selectedFileIndex !== null && !isMerged) {
      const newFiles = [...files]
      newFiles[selectedFileIndex] = {
        ...files[selectedFileIndex],
        data: [headers, ...uniqueRows]
      }
      setFiles(newFiles)
    } else if (isMerged) {
      setMergedData([headers, ...uniqueRows])
    }
  }, [currentData, selectedFileIndex, isMerged, files])

  const handleCleanEmpty = useCallback(() => {
    if (currentData.length === 0) return
    
    const headers = currentData[0]
    const dataRows = currentData.slice(1)
    
    // 移除空行
    const nonEmptyRows = dataRows.filter(row => 
      row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== '')
    )
    
    // 移除空列
    const nonEmptyCols = headers.map((_, colIndex) => {
      return dataRows.some(row => {
        const cell = row[colIndex]
        return cell !== null && cell !== undefined && String(cell).trim() !== ''
      })
    })
    
    const cleanedHeaders = headers.filter((_, i) => nonEmptyCols[i])
    const cleanedRows = nonEmptyRows.map(row => 
      row.filter((_, i) => nonEmptyCols[i])
    )
    
    setCurrentData([cleanedHeaders, ...cleanedRows])
    
    if (selectedFileIndex !== null && !isMerged) {
      const newFiles = [...files]
      newFiles[selectedFileIndex] = {
        ...files[selectedFileIndex],
        headers: cleanedHeaders,
        data: [cleanedHeaders, ...cleanedRows]
      }
      setFiles(newFiles)
    } else if (isMerged) {
      setMergedData([cleanedHeaders, ...cleanedRows])
    }
  }, [currentData, selectedFileIndex, isMerged, files])

  const handleTrimWhitespace = useCallback(() => {
    if (currentData.length === 0) return
    
    const headers = currentData[0]
    const dataRows = currentData.slice(1)
    
    const trimmedRows = dataRows.map(row => 
      row.map(cell => {
        if (typeof cell === 'string') return cell.trim()
        return cell
      })
    )
    
    setCurrentData([headers, ...trimmedRows])
    
    if (selectedFileIndex !== null && !isMerged) {
      const newFiles = [...files]
      newFiles[selectedFileIndex] = {
        ...files[selectedFileIndex],
        data: [headers, ...trimmedRows]
      }
      setFiles(newFiles)
    }
  }, [currentData, selectedFileIndex, isMerged, files])

  const handleExport = useCallback(async (format: 'xlsx' | 'csv') => {
    if (currentData.length === 0) return
    
    try {
      const defaultName = `清洗后数据.${format}`
      const result = await window.electronAPI.saveFile(defaultName)
      
      if (!result.canceled && result.filePath) {
        if (format === 'xlsx') {
          await exportToExcel(currentData, result.filePath)
        } else {
          await exportToCSV(currentData, result.filePath)
        }
      }
    } catch (error) {
      console.error('导出失败:', error)
    }
  }, [currentData])

  const handleClear = useCallback(() => {
    setFiles([])
    setSelectedFileIndex(null)
    setCurrentData([])
    setCurrentHeaders([])
    setMergedData(null)
    setIsMerged(false)
  }, [])

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <Toolbar 
        onImport={handleImport}
        onExport={handleExport}
        onMerge={handleMerge}
        onDeduplicate={handleDeduplicate}
        onCleanEmpty={handleCleanEmpty}
        onTrimWhitespace={handleTrimWhitespace}
        onClear={handleClear}
        hasData={currentData.length > 0}
        canMerge={files.length >= 2}
        isMerged={isMerged}
      />
      <div className="flex-1 flex overflow-hidden">
        <FileSidebar 
          files={files}
          selectedIndex={selectedFileIndex}
          onSelect={handleFileSelect}
          onRemove={handleRemoveFile}
          isMerged={isMerged}
        />
        <DataTable 
          data={currentData}
          headers={currentHeaders}
        />
      </div>
      <StatusBar 
        rowCount={currentData.length - 1}
        fileCount={files.length}
        selectedFile={selectedFileIndex !== null ? files[selectedFileIndex]?.name : null}
        isMerged={isMerged}
      />
    </div>
  )
}

export default App