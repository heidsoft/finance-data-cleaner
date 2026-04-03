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

interface SKUMapping {
  platformName: string
  internalCode: string
  price: number
}

type Tab = 'data' | 'mapping' | 'reconcile'

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
  const [activeTab, setActiveTab] = useState<Tab>('data')

  // SKU映射表
  const [skuMappings, setSkuMappings] = useState<SKUMapping[]>([])
  const [showMappingModal, setShowMappingModal] = useState(false)
  const [mappingFile, setMappingFile] = useState<FileData | null>(null)

  // 对账相关
  const [paymentFile, setPaymentFile] = useState<FileData | null>(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)

  // 统计
  const [orderStats, setOrderStats] = useState<{
    totalOrders: number
    totalAmount: number
    platformBreakdown: Record<string, { count: number; amount: number }>
  } | null>(null)

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

  const handleImportOrders = useCallback(async () => {
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
        computeStats([...files, ...newFiles])
      }
    } catch (error) {
      console.error('导入失败:', error)
    }
  }, [files.length, selectedFileIndex, saveHistory])

  const computeStats = (allFiles: FileData[]) => {
    const allRows: any[][] = []
    const platformMap: Record<string, { count: number; amount: number }> = {}

    allFiles.forEach(file => {
      const dataRows = file.data.slice(1)
      allRows.push(...dataRows)

      // 尝试识别平台
      const platform = detectPlatform(file.name, file.headers)
      if (!platformMap[platform]) platformMap[platform] = { count: 0, amount: 0 }
      platformMap[platform].count += dataRows.length

      dataRows.forEach(row => {
        const amount = findAmount(row)
        if (!isNaN(amount)) platformMap[platform].amount += amount
      })
    })

    const totalAmount = allRows.reduce((sum, row) => sum + findAmount(row), 0)
    setOrderStats({
      totalOrders: allRows.length,
      totalAmount,
      platformBreakdown: platformMap
    })
  }

  const detectPlatform = (fileName: string, headers: string[]): string => {
    const name = fileName.toLowerCase()
    const headerStr = headers.join('').toLowerCase()
    if (name.includes('taobao') || name.includes('淘宝')) return '淘宝'
    if (name.includes('jd') || name.includes('jingdong') || name.includes('京东')) return '京东'
    if (name.includes('pinduoduo') || name.includes('拼多多')) return '拼多多'
    if (name.includes('douyin') || name.includes('抖音')) return '抖音'
    if (name.includes('kuaishou') || name.includes('快手')) return '快手'
    if (name.includes('tmall') || name.includes('天猫')) return '天猫'
    if (name.includes('alipay') || name.includes('支付宝')) return '支付宝'
    if (name.includes('wechat') || name.includes('微信')) return '微信支付'
    return '其他'
  }

  const findAmount = (row: any[]): number => {
    for (const cell of row) {
      const num = parseFloat(String(cell).replace(/[¥$,，￥]/g, ''))
      if (!isNaN(num) && num > 0) return num
    }
    return 0
  }

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
    computeStats(files)
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
        ...files[selectedFileIndex], headers: cleanedHeaders, data: newData
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

  // SKU映射处理
  const handleImportMapping = useCallback(async () => {
    try {
      const result = await window.electronAPI.openFile()
      if (!result.canceled && result.filePaths.length > 0) {
        const fileData = await processFile(result.filePaths[0])
        if (fileData) {
          setMappingFile(fileData)
          // 解析映射表：假设第一列是平台品名，第二列是内部编码
          const mappings: SKUMapping[] = fileData.data.slice(1).map(row => ({
            platformName: String(row[0] || '').trim(),
            internalCode: String(row[1] || '').trim(),
            price: parseFloat(String(row[2] || 0).replace(/[¥$,]/g, '')) || 0
          })).filter(m => m.platformName && m.internalCode)
          setSkuMappings(mappings)
        }
      }
    } catch (error) {
      console.error('导入映射表失败:', error)
    }
  }, [])

  const handleApplyMapping = useCallback(() => {
    if (currentData.length === 0 || skuMappings.length === 0) return
    const headers = currentData[0]
    const dataRows = currentData.slice(1)
    const mappedRows = dataRows.map(row => {
      const newRow = [...row]
      // 遍历所有单元格，匹配映射
      for (let i = 0; i < newRow.length; i++) {
        const cell = String(newRow[i] || '').trim()
        const mapping = skuMappings.find(m => m.platformName === cell)
        if (mapping) {
          // 在内部编码列后面插入映射结果（假设第i列是品名）
          if (!newRow.includes(mapping.internalCode)) {
            newRow.push(mapping.internalCode)
          }
        }
      }
      return newRow
    })
    const newData = [
      [...headers, '内部编码'],
      ...mappedRows
    ]
    setCurrentData(newData)
    saveHistory(newData, [...headers, '内部编码'])
  }, [currentData, skuMappings, saveHistory])

  // 收款对账处理
  const handleImportPayment = useCallback(async () => {
    try {
      const result = await window.electronAPI.openFile()
      if (!result.canceled && result.filePaths.length > 0) {
        const fileData = await processFile(result.filePaths[0])
        if (fileData) setPaymentFile(fileData)
      }
    } catch (error) {
      console.error('导入收款流水失败:', error)
    }
  }, [])

  const handleReconcile = useCallback(() => {
    if (currentData.length === 0 || !paymentFile) return

    const orderRows = currentData.slice(1)
    const paymentRows = paymentFile.data.slice(1)

    // 简单对账逻辑：按金额匹配
    const reconciled: any[][] = [['订单金额', '收款金额', '状态', '说明']]
    const unmatchedPayments = [...paymentRows]

    orderRows.forEach(order => {
      const orderAmount = findAmount(order)
      if (orderAmount === 0) return

      const matchIdx = unmatchedPayments.findIndex(pay => {
        const payAmount = findAmount(pay)
        return Math.abs(payAmount - orderAmount) < 0.01
      })

      if (matchIdx >= 0) {
        reconciled.push([orderAmount, findAmount(unmatchedPayments[matchIdx]), '已核销', '匹配成功'])
        unmatchedPayments.splice(matchIdx, 1)
      } else {
        reconciled.push([orderAmount, '', '未匹配', '无对应收款记录'])
      }
    })

    // 未匹配的收款
    unmatchedPayments.forEach(pay => {
      reconciled.push(['', findAmount(pay), '未认领', '无对应订单'])
    })

    setCurrentData(reconciled)
    setCurrentHeaders(reconciled[0])
    setIsMerged(false)
    saveHistory(reconciled, reconciled[0])
  }, [currentData, paymentFile, saveHistory])

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
    setOrderStats(null)
    setSkuMappings([])
    setMappingFile(null)
    setPaymentFile(null)
  }, [])

  const filteredData = useMemo(() => {
    if (!searchText.trim()) return currentData
    const lower = searchText.toLowerCase()
    return [currentData[0], ...currentData.slice(1).filter(row =>
      row.some(cell => String(cell).toLowerCase().includes(lower))
    )]
  }, [currentData, searchText])

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Tab 切换 */}
      <div className="bg-white border-b border-gray-200 px-4 py-1.5 flex items-center gap-1">
        {[
          { key: 'data', label: '📊 数据处理' },
          { key: 'mapping', label: '🏷️ SKU映射' },
          { key: 'reconcile', label: '🧾 收款对账' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as Tab)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-blue-100 text-blue-700 border border-blue-300'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {tab.label}
          </button>
        ))}

        {/* 订单统计 */}
        {orderStats && activeTab === 'data' && (
          <div className="ml-4 flex items-center gap-4 text-xs text-gray-600">
            <span>📦 总订单: <strong>{orderStats.totalOrders}</strong></span>
            <span>💰 总金额: <strong>¥{orderStats.totalAmount.toFixed(2)}</strong></span>
            {Object.entries(orderStats.platformBreakdown).map(([platform, stats]) => (
              <span key={platform} className="bg-gray-100 px-2 py-0.5 rounded">
                {platform}: {stats.count}单 ¥{stats.amount.toFixed(0)}
              </span>
            ))}
          </div>
        )}

        <div className="flex-1" />

        {/* 搜索 */}
        <div className="flex items-center gap-1 border border-gray-300 rounded-lg px-2 py-1 bg-gray-50">
          <span className="text-gray-400 text-xs">🔍</span>
          <input
            type="text"
            placeholder="搜索..."
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            className="border-none outline-none bg-transparent text-xs w-28"
          />
          {searchText && (
            <button onClick={() => setSearchText('')} className="text-gray-400 text-xs">✕</button>
          )}
        </div>
      </div>

      {/* SKU映射面板 */}
      {activeTab === 'mapping' && (
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="bg-white rounded-xl shadow p-6">
              <h2 className="font-semibold text-gray-800 mb-1">🏷️ SKU 映射表</h2>
              <p className="text-sm text-gray-500 mb-4">上传映射表（平台品名 → 内部编码），应用到订单数据</p>

              <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center mb-4">
                {mappingFile ? (
                  <div className="text-green-600">
                    <div className="text-2xl mb-2">✅</div>
                    <div className="font-medium">{mappingFile.name}</div>
                    <div className="text-sm text-gray-500 mt-1">{mappingFile.data.length - 1} 条映射规则</div>
                    <button
                      onClick={() => { setMappingFile(null); setSkuMappings([]) }}
                      className="mt-2 text-xs text-red-500 hover:underline"
                    >
                      移除
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="text-3xl mb-2">📤</div>
                    <div className="text-gray-600 mb-2">拖拽上传或点击选择映射文件</div>
                    <div className="text-xs text-gray-400 mb-4">支持 CSV / Excel，格式：平台品名 | 内部编码 | 价格（可选）</div>
                    <button
                      onClick={handleImportMapping}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                    >
                      选择文件
                    </button>
                  </>
                )}
              </div>

              {skuMappings.length > 0 && (
                <div className="flex gap-3">
                  <button
                    onClick={handleApplyMapping}
                    disabled={currentData.length === 0}
                    className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm disabled:opacity-40"
                  >
                    应用到当前数据 ({currentData.length - 1}行)
                  </button>
                </div>
              )}

              {skuMappings.length > 0 && (
                <div className="mt-4 max-h-48 overflow-y-auto border rounded-lg">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left text-gray-500">#</th>
                        <th className="px-3 py-2 text-left text-gray-500">平台品名</th>
                        <th className="px-3 py-2 text-left text-gray-500">内部编码</th>
                        <th className="px-3 py-2 text-right text-gray-500">价格</th>
                      </tr>
                    </thead>
                    <tbody>
                      {skuMappings.slice(0, 20).map((m, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-3 py-1.5 text-gray-400">{i + 1}</td>
                          <td className="px-3 py-1.5">{m.platformName}</td>
                          <td className="px-3 py-1.5 font-mono text-blue-700">{m.internalCode}</td>
                          <td className="px-3 py-1.5 text-right text-gray-600">¥{m.price}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {skuMappings.length > 20 && (
                    <div className="text-center text-xs text-gray-400 py-2 bg-gray-50">
                      ...还有 {skuMappings.length - 20} 条
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 收款对账面板 */}
      {activeTab === 'reconcile' && (
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="bg-white rounded-xl shadow p-6">
              <h2 className="font-semibold text-gray-800 mb-1">🧾 收款对账</h2>
              <p className="text-sm text-gray-500 mb-4">导入收款流水（支付宝/微信/银行），与订单金额自动核销</p>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center">
                  {paymentFile ? (
                    <div className="text-green-600">
                      <div className="text-2xl mb-1">✅</div>
                      <div className="font-medium text-sm">{paymentFile.name}</div>
                      <div className="text-xs text-gray-500">{paymentFile.data.length - 1} 条记录</div>
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
                      <div className="text-sm text-gray-600 mb-2">收款流水文件</div>
                      <button
                        onClick={handleImportPayment}
                        className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                      >
                        选择文件
                      </button>
                    </>
                  )}
                </div>

                <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center">
                  <div className="text-2xl mb-1">📦</div>
                  <div className="text-sm text-gray-600 mb-2">当前订单数据</div>
                  <div className="text-sm font-medium text-gray-700">{currentData.length - 1} 行</div>
                  <div className="text-xs text-gray-400 mt-1">
                    金额合计: ¥{currentData.slice(1).reduce((s, r) => s + findAmount(r), 0).toFixed(2)}
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

              <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-800">
                💡 对账逻辑：按金额一一匹配，误差&lt;0.01元视为匹配成功
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 数据处理Tab */}
      {activeTab === 'data' && (
        <>
          <Toolbar
            onImport={handleImportOrders}
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
        </>
      )}
    </div>
  )
}

export default App