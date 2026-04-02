import * as XLSX from 'xlsx'
import fs from 'fs'
import path from 'path'

export interface FileData {
  name: string
  path: string
  headers: string[]
  data: any[][]
}

export async function processFile(filePath: string): Promise<FileData | null> {
  try {
    const buffer = fs.readFileSync(filePath)
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    
    // Get first sheet
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    
    // Convert to JSON (array of arrays)
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]
    
    if (jsonData.length === 0) {
      return null
    }
    
    // First row is headers
    const headers = jsonData[0].map((h: any) => String(h || ''))
    const data = jsonData
    
    return {
      name: path.basename(filePath),
      path: filePath,
      headers,
      data
    }
  } catch (error) {
    console.error('处理文件失败:', error)
    return null
  }
}

export async function exportToExcel(data: any[][], filePath: string): Promise<void> {
  const worksheet = XLSX.utils.aoa_to_sheet(data)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, '数据')
  XLSX.writeFile(workbook, filePath)
}

export async function exportToCSV(data: any[][], filePath: string): Promise<void> {
  const worksheet = XLSX.utils.aoa_to_sheet(data)
  const csv = XLSX.utils.sheet_to_csv(worksheet)
  fs.writeFileSync(filePath, '\ufeff' + csv, 'utf-8') // BOM for Excel
}