export function deduplicateData(data: any[][], columnIndex?: number): any[][] {
  if (data.length === 0) return []
  const headers = data[0]
  const dataRows = data.slice(1)
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
  return [headers, ...uniqueRows]
}

export function cleanEmptyRowsAndCols(data: any[][]): { headers: string[], data: any[][] } {
  if (data.length === 0) return { headers: [], data: [] }
  const headers = data[0]
  const dataRows = data.slice(1)

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

  return {
    headers: cleanedHeaders,
    data: [cleanedHeaders, ...cleanedRows]
  }
}

export function trimWhitespace(data: any[][]): any[][] {
  if (data.length === 0) return []
  const headers = data[0]
  const dataRows = data.slice(1)

  const trimmedRows = dataRows.map(row =>
    row.map(cell => (typeof cell === 'string' ? cell.trim() : cell))
  )

  return [headers, ...trimmedRows]
}

export function standardizeDates(data: any[][]): any[][] {
  if (data.length === 0) return []
  const headers = data[0]
  const dataRows = data.slice(1)

  const standardizedRows = dataRows.map(row =>
    row.map(cell => {
      if (typeof cell !== 'string') return cell
      const trimmed = cell.trim()
      const patterns = [
        { regex: /^(\d{4})[年/-](\d{1,2})[月/-](\d{1,2})日?$/ },
        { regex: /^(\d{1,2})[月/-](\d{1,2})[日/-](\d{4})$/ },
        { regex: /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/ },
        { regex: /^(\d{4})(\d{2})(\d{2})$/ },
      ]
      for (const p of patterns) {
        const match = trimmed.match(p.regex as any)
        if (match) {
          try {
            let y = '', m = '', d = ''
            if (match[1].length === 4) {
              y = match[1]
              m = match[2].padStart(2, '0')
              d = match[3].padStart(2, '0')
            } else {
              y = match[3]
              m = match[1].padStart(2, '0')
              d = match[2].padStart(2, '0')
            }
            const date = new Date(`${y}-${m}-${d}`)
            if (!isNaN(date.getTime())) {
              return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
            }
          } catch {
            // ignore error
          }
        }
      }
      return cell
    })
  )

  return [headers, ...standardizedRows]
}

export function fillEmptyCells(data: any[][], fillValue: string): any[][] {
  if (data.length === 0) return []
  const headers = data[0]
  const dataRows = data.slice(1)

  const filledRows = dataRows.map(row =>
    row.map(cell => {
      if (cell === null || cell === undefined || String(cell).trim() === '') {
        return fillValue
      }
      return cell
    })
  )

  return [headers, ...filledRows]
}

export function selectColumns(data: any[][], selectedCols: number[]): { headers: string[], data: any[][] } {
  if (data.length === 0) return { headers: [], data: [] }
  const headers = data[0]
  const dataRows = data.slice(1)

  const newHeaders = selectedCols.map(i => headers[i])
  const newRows = dataRows.map(row => selectedCols.map(i => row[i]))

  return {
    headers: newHeaders,
    data: [newHeaders, ...newRows]
  }
}

export interface MergeColumnInfo {
  columnName: string;
  sources: string[];
  sourceIndices: number[];
}

export interface MergePreviewResult {
  unifiedHeaders: string[];
  columnInfo: MergeColumnInfo[];
  totalRows: number;
  fileStats: { name: string; rows: number; columns: number }[];
}

export function smartMergeHeaders(files: { headers: string[]; data: any[][]; name: string }[]): MergePreviewResult {
  const columnMap = new Map<string, { sources: string[]; sourceIndices: number[] }>();

  files.forEach((file, fileIdx) => {
    file.headers.forEach((col, colIdx) => {
      const key = col.trim();
      if (!columnMap.has(key)) {
        columnMap.set(key, { sources: [], sourceIndices: [] });
      }
      const entry = columnMap.get(key)!;
      entry.sources.push(file.name);
      entry.sourceIndices.push(colIdx);
    });
  });

  const unifiedHeaders = Array.from(columnMap.keys());
  const columnInfo: MergeColumnInfo[] = unifiedHeaders.map(name => {
    const entry = columnMap.get(name)!;
    return {
      columnName: name,
      sources: entry.sources,
      sourceIndices: entry.sourceIndices,
    };
  });

  const totalRows = files.reduce((sum, f) => sum + f.data.length - 1, 0);
  const fileStats = files.map(f => ({
    name: f.name,
    rows: f.data.length - 1,
    columns: f.headers.length,
  }));

  return { unifiedHeaders, columnInfo, totalRows, fileStats };
}

export function executeSmartMerge(
  files: { headers: string[]; data: any[][]; name: string }[],
  columnInfo: MergeColumnInfo[]
): any[][] {
  if (files.length === 0) return [];

  const merged: any[][] = [columnInfo.map(c => c.columnName)];

  files.forEach((file, _fileIdx) => {
    const fileRows = file.data.slice(1);
    fileRows.forEach(row => {
      const newRow = columnInfo.map(col => {
        const sourceIdx = col.sourceIndices[col.sources.indexOf(file.name)];
        return sourceIdx !== undefined ? row[sourceIdx] : "";
      });
      merged.push(newRow);
    });
  });

  return merged;
}
