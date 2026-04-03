import { useState, useCallback, useMemo } from 'react'
import Toolbar from './components/Toolbar'
import FileSidebar from './components/FileSidebar'
import DataTable from './components/DataTable'
import StatusBar from './components/StatusBar'
import { FileData, processFile, exportToExcel, exportToCSV } from './utils/excel'

interface HistoryState {
  data: any[][]
  headers: string[]
  fileIndex: number | null
  isMerged: boolean
}

function App() {
  const [files, setFiles] = useState<FileData[]>([])
  const [selectedFileIndex, setSelectedFileIndex] = useState<number | null>(null)
  const [currentData, setCurrentData] = useState<any[][]>([])
  const [currentHeaders, setCurrentHeaders] = useState<string[]>([])
  const [mergedData, setMergedData] = useState<any[][] | null>(null)
  const [isMerged, setIsMerged] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [history, setHistory] = useState<HistoryState[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)

  // 保存历史记录
  const saveHistory = useCallback((data: any[][], headers: string[]) => {
    const newEntry: HistoryState = {
      data: [...data.map(row => [...row])],
      headers: [...headers],
      fileIndex: selectedFileIndex,
      isMerged
    }
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1)
      newHistory.push(newEntry)
      return newHistory
    })
    setHistoryIndex(prev => prev + 1)
  }, [selectedFileIndex, isMerged, historyIndex])

  const handleUndo = useCallback(() => {
    if (historyIndex <= 0) return
    const prev = history[historyIndex - 1]
    setCurrentData(prev.data)
    setCurrentHeaders(prev.headers)
    setHistoryIndex(prev => prev - 1)
  }, [history, historyIndex])

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
          saveHistory(newFiles[0].data, newFiles[0].headers)
        }
      }
    } catch (error) {
      console.error('导入文件失败:', error)
    }
  }, [files.length, selectedFileIndex, saveHistory])

  const handleFileSelect = useCallback((index: number) => {
    setSelectedFileIndex(index)
    if (index < files.length) {
      setCurrentHeaders(files[index].headers)
      setCurrentData(files[index].data)
      setIsMerged(false)
      setSearchText('')
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
    const mergedHeaders = files[0].headers
    const merged: any[][] = [mergedHeaders]
    files.forEach(file => {
      merged.push(...file.data.slice(1))
    })
    setMergedData(merged)
    setCurrentHeaders(mergedHeaders)
    setCurrentData(merged)
    setIsMerged(true)
    saveHistory(merged, mergedHeaders)
  }, [files, saveHistory])

  const handleDeduplicate = useCallback((columnIndex?: number) => {
    if (currentData.length === 0) return
    const headers = currentData[0]
    const dataRows = currentData.slice(1)
    let uniqueRows: any[][]
    if (columnIndex !== undefined && columnIndex >= 0) {
      const seen = new Set()
      uniqueRows = dataRows.filter(row => {
        const key = row[columnIndex]
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
    } else {
      const seen = new Set()
      uniqueRows = dataRows.filter(row => {
        const key = JSON.stringify(row)
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
    }
    const newData = [headers, ...uniqueRows]
    setCurrentData(newData)
    if (selectedFileIndex !== null && !isMerged) {
      const newFiles = [...files]
      newFiles[selectedFileIndex] = { ...files[selectedFileIndex], data: newData }
      setFiles(newFiles)
    } else if (isMerged) {
      setMergedData(newData)
    }
    saveHistory(newData, headers)
  }, [currentData, selectedFileIndex, isMerged, files, saveHistory])

  const handleCleanEmpty = useCallback(() => {
    if (currentData.length === 0) return
    const headers = currentData[0]
    const dataRows = currentData.slice(1)
    const nonEmptyRows = dataRows.filter(row =>
      row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== '')
    )
    const nonEmptyCols = headers.map((_, colIndex) =>
      dataRows.some(row => {
        const cell = row[colIndex]
        return cell !== null && cell !== undefined && String(cell).trim() !== ''
      })
    )
    const cleanedHeaders = headers.filter((_, i) => nonEmptyCols[i])
    const cleanedRows = nonEmptyRows.map(row => row.filter((_, i) => nonEmptyCols[i]))
    const newData = [cleanedHeaders, ...cleanedRows]
    setCurrentData(newData)
    setCurrentHeaders(cleanedHeaders)
    if (selectedFileIndex !== null && !isMerged) {
      const newFiles = [...files]
      newFiles[selectedFileIndex] = {
        ...files[selectedFileIndex],
        headers: cleanedHeaders,
        data: newData
      }
      setFiles(newFiles)
    } else if (isMerged) {
      setMergedData(newData)
    }
    saveHistory(newData, cleanedHeaders)
  }, [currentData, selectedFileIndex, isMerged, files, saveHistory])

  const handleTrimWhitespace = useCallback(() => {
    if (currentData.length === 0) return
    const headers = currentData[0]
    const dataRows = currentData.slice(1)
    const trimmedRows = dataRows.map(row =>
      row.map(cell => typeof cell === 'string' ? cell.trim() : cell)
    )
    const newData = [headers, ...trimmedRows]
    setCurrentData(newData)
    if (selectedFileIndex !== null && !isMerged) {
      const newFiles = [...files]
      newFiles[selectedFileIndex] = { ...files[selectedFileIndex], data: newData }
      setFiles(newFiles)
    }
    saveHistory(newData, headers)
  }, [currentData, selectedFileIndex, isMerged, files, saveHistory])

  const handleStandardizeDate = useCallback(() => {
    if (currentData.length === 0) return
    const headers = currentData[0]
    const dataRows = currentData.slice(1)
    const standardizedRows = dataRows.map(row =>
      row.map(cell => {
        if (typeof cell !== 'string') return cell
        const trimmed = cell.trim()
        // 匹配多种日期格式并转为 YYYY-MM-DD
        const patterns = [
          { regex: /^(\d{4})[年/-](\d{1,2})[月/-](\d{1,2})日?$/, fmt: (m: RegExpMatchArray) => `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}` },
          { regex: /^(\d{1,2})[月/-](\d{1,2})[日/-](\d{4})$/, fmt: (m: RegExpMatchArray) => `${m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}` },
          { regex: /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/, fmt: (m: RegExpMatchArray) => `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}` },
          { regex: /^(\d{4})(\d{2})(\d{2})$/, fmt: (m: RegExpMatchArray) => `${m[1]}-${m[2]}-${m[3]}` },
        ]
        for (const p of patterns) {
          const match = trimmed.match(p.regex)
          if (match) {
            try {
              const d = new Date(`${match[1]}-${match[2].padStart(2,'0')}-${match[3].padStart(2,'0')}`)
              if (!isNaN(d.getTime())) {
                return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
              }
            } catch {}
          }
        }
        return cell
      })
    )
    const newData = [headers, ...standardizedRows]
    setCurrentData(newData)
    if (selectedFileIndex !== null && !isMerged) {
      const newFiles = [...files]
      newFiles[selectedFileIndex] = { ...files[selectedFileIndex], data: newData }
      setFiles(newFiles)
    }
    saveHistory(newData, headers)
  }, [currentData, selectedFileIndex, isMerged, files, saveHistory])

  const handleFillEmpty = useCallback((fillValue: string) => {
    if (currentData.length === 0) return
    const headers = currentData[0]
    const dataRows = currentData.slice(1)
    const filledRows = dataRows.map(row =>
      row.map(cell => {
        if (cell === null || cell === undefined || String(cell).trim() === '') return fillValue
        return cell
      })
    )
    const newData = [headers, ...filledRows]
    setCurrentData(newData)
    if (selectedFileIndex !== null && !isMerged) {
      const newFiles = [...files]
      newFiles[selectedFileIndex] = { ...files[selectedFileIndex], data: newData }
      setFiles(newFiles)
    }
    saveHistory(newData, headers)
  }, [currentData, selectedFileIndex, isMerged, files, saveHistory])

  const handleSelectColumns = useCallback((selectedCols: number[]) => {
    if (currentData.length === 0) return
    const headers = currentData[0]
    const dataRows = currentData.slice(1)
    const newHeaders = selectedCols.map(i => headers[i])
    const newRows = dataRows.map(row => selectedCols.map(i => row[i]))
    const newData = [newHeaders, ...newRows]
    setCurrentData(newData)
    setCurrentHeaders(newHeaders)
    if (selectedFileIndex !== null && !isMerged) {
      const newFiles = [...files]
      newFiles[selectedFileIndex] = { ...files[selectedFileIndex], headers: newHeaders, data: newData }
      setFiles(newFiles)
    } else if (isMerged) {
      setMergedData(newData)
    }
    saveHistory(newData, newHeaders)
  }, [currentData, selectedFileIndex, isMerged, files, saveHistory])

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
    setSearchText('')
    setHistory([])
    setHistoryIndex(-1)
  }, [])

  // 搜索过滤后的数据
  const filteredData = useMemo(() => {
    if (!searchText.trim()) return currentData
    const lower = searchText.toLowerCase()
    return [currentData[0], ...currentData.slice(1).filter(row =>
      row.some(cell => String(cell).toLowerCase().includes(lower))
    )]
  }, [currentData, searchText])

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
        onUndo={handleUndo}
        onStandardizeDate={handleStandardizeDate}
        onFillEmpty={handleFillEmpty}
        onSelectColumns={handleSelectColumns}
        hasData={currentData.length > 0}
        canMerge={files.length >= 2}
        isMerged={isMerged}
        headers={currentHeaders}
        searchText={searchText}
        onSearchChange={setSearchText}
        canUndo={historyIndex > 0}
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
          data={filteredData}
          headers={currentHeaders}
        />
      </div>
      <StatusBar
        rowCount={currentData.length - 1}
        filteredRowCount={filteredData.length - 1}
        fileCount={files.length}
        selectedFile={selectedFileIndex !== null ? files[selectedFileIndex]?.name : null}
        isMerged={isMerged}
        isFiltered={searchText.trim().length > 0}
      />
    </div>
  )
}

export default App