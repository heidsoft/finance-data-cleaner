import * as XLSX from 'xlsx'
import { getBaseName, readLocalFile, writeLocalFile } from './desktop'

export interface FileData {
  name: string
  path: string
  headers: string[]
  data: any[][]
}

export async function processFile(filePath: string): Promise<FileData | null> {
  try {
    const result = await readLocalFile(filePath)
    if (!result.success || !result.buffer) {
      console.error('读取文件失败:', result.error)
      return null
    }
    
    const workbook = XLSX.read(result.buffer, { type: 'array' })
    
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]
    
    if (jsonData.length === 0) {
      return null
    }
    
    const headers = jsonData[0].map((h: any) => String(h || ''))
    const data = jsonData
    
    return {
      name: getBaseName(filePath),
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
  const output = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
  await writeLocalFile(filePath, output.buffer)
}

export async function exportToCSV(
  data: any[][],
  filePath: string,
  _encoding: "utf-8" = "utf-8",
  delimiter: string = ","
): Promise<void> {
  const csv = data.map(row =>
    row.map(cell => {
      const str = cell === null || cell === undefined ? "" : String(cell);
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(delimiter)
  ).join("\n");

  // Always use UTF-8 with BOM for Excel compatibility
  const bom = "\ufeff";
  const buffer = new TextEncoder().encode(bom + csv);
  await writeLocalFile(filePath, buffer.buffer);
}
