"use client"

import { cn } from "@/lib/utils"

interface Column<T> {
  key: string
  header: string
  render?: (row: T) => React.ReactNode
  className?: string
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  keyField?: string
  emptyMessage?: string
  onRowClick?: (row: T) => void
}

export function DataTable<T extends Record<string, any>>({ columns, data, keyField = "id", emptyMessage = "No data found.", onRowClick }: DataTableProps<T>) {
  if (data.length === 0) {
    return <div className="text-center py-12 text-surface-500 text-sm">{emptyMessage}</div>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-surface-100">
            {columns.map(col => (
              <th key={col.key} className={cn("text-left py-3 px-4 text-xs font-medium text-surface-500 uppercase tracking-wider", col.className)}>{col.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map(row => (
            <tr key={row[keyField]} onClick={() => onRowClick?.(row)} className={cn("border-b border-surface-50 transition-colors", onRowClick && "cursor-pointer hover:bg-surface-50")}>
              {columns.map(col => (
                <td key={col.key} className={cn("py-3 px-4 text-surface-700", col.className)}>
                  {col.render ? col.render(row) : String(row[col.key] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
