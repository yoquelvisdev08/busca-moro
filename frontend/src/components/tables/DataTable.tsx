import * as React from "react"
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type RowSelectionState,
  type PaginationState,
  type FilterFn,
} from "@tanstack/react-table"
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"

export type TableDensity = "compact" | "normal" | "comfortable"

const densityRowClass: Record<TableDensity, string> = {
  compact: "h-8 [&>td]:py-1 [&>th]:py-1",
  normal: "h-10 [&>td]:py-2 [&>th]:py-2",
  comfortable: "h-12 [&>td]:py-3 [&>th]:py-3",
}

export interface FilterConfig {
  id: string
  label: string
  type: "text" | "select" | "date-range"
  options?: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
}

export interface BulkAction<T> {
  label: string
  icon?: React.ReactNode
  action: (rows: T[]) => void
  variant?: "default" | "destructive" | "outline"
}

export interface DataTableProps<T> {
  data: T[]
  columns: ColumnDef<T, unknown>[]
  loading?: boolean
  pageCount?: number
  pagination?: PaginationState
  onPaginationChange?: (pagination: PaginationState) => void
  search?: {
    value: string
    onChange: (value: string) => void
    placeholder?: string
  }
  filters?: FilterConfig[]
  bulkActions?: BulkAction<T>[]
  density?: TableDensity
  rowSelection?: RowSelectionState
  onRowSelectionChange?: (selection: RowSelectionState) => void
  /** First column sticky for horizontal scroll */
  stickyFirstColumn?: boolean
  /** Row ID accessor */
  getRowId?: (row: T) => string
  className?: string
}

// Case-insensitive text filter
const textFilter: FilterFn<unknown> = (row, columnId, filterValue: string) => {
  if (!filterValue) return true
  const value = String(row.getValue(columnId) ?? "").toLowerCase()
  return value.includes(filterValue.toLowerCase())
}

function SortIcon({ sorted }: { sorted: false | "asc" | "desc" }) {
  if (sorted === "asc") return <ChevronUp className="ml-1 size-3.5" aria-hidden="true" />
  if (sorted === "desc") return <ChevronDown className="ml-1 size-3.5" aria-hidden="true" />
  return <ChevronsUpDown className="ml-1 size-3.5 text-text-dim opacity-50" aria-hidden="true" />
}

function DataTableSkeleton({ columns }: { columns: number }) {
  return (
    <TableBody>
      {Array.from({ length: 5 }).map((_, rowIdx) => (
        <TableRow key={rowIdx}>
          {Array.from({ length: columns }).map((_, colIdx) => (
            <TableCell key={colIdx}>
              <div className="h-4 w-[60%] animate-pulse rounded bg-muted" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </TableBody>
  )
}

function DataTable<T>({
  data,
  columns,
  loading = false,
  pageCount,
  pagination,
  onPaginationChange,
  search,
  filters,
  bulkActions,
  density = "normal",
  rowSelection,
  onRowSelectionChange,
  stickyFirstColumn = true,
  getRowId,
  className,
}: DataTableProps<T>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])

  const filterFns = React.useMemo(() => {
    if (!filters) return {}
    const fns: Record<string, FilterFn<unknown>> = {}
    filters.forEach((f) => {
      if (f.type === "text") fns[f.id] = textFilter
    })
    return fns
  }, [filters])

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: pagination ? getPaginationRowModel() : undefined,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: onRowSelectionChange
      ? (updater) => {
          if (typeof updater === "function") {
            onRowSelectionChange(updater(table.getState().rowSelection))
          } else {
            onRowSelectionChange(updater)
          }
        }
      : undefined,
    onPaginationChange:
      onPaginationChange && pagination
        ? (updater) => {
            if (typeof updater === "function") {
              onPaginationChange(updater(table.getState().pagination))
            } else {
              onPaginationChange(updater)
            }
          }
        : undefined,
    filterFns: Object.keys(filterFns).length > 0 ? filterFns : undefined,
    state: {
      sorting,
      columnFilters,
      rowSelection: rowSelection ?? {},
      pagination: pagination ?? { pageIndex: 0, pageSize: 25 },
    },
    manualPagination: !!onPaginationChange,
    getRowId: getRowId as ((originalRow: T, index: number, parent?: unknown) => string) | undefined,
  })

  const selectedCount = Object.keys(table.getState().rowSelection).length
  const totalRows = pageCount ? pageCount * (pagination?.pageSize ?? 25) : data.length
  const pageIndex = table.getState().pagination.pageIndex
  const pageSize = table.getState().pagination.pageSize
  const showingFrom = totalRows === 0 ? 0 : pageIndex * pageSize + 1
  const showingTo = Math.min((pageIndex + 1) * pageSize, totalRows)

  return (
    <div
      data-slot="data-table"
      className={cn("flex flex-col gap-3", className)}
    >
      {/* Toolbar: search + filters */}
      {(search || (filters && filters.length > 0)) && (
        <div className="flex flex-wrap items-center gap-2">
          {search && (
            <Input
              placeholder={search.placeholder ?? "Search..."}
              value={search.value}
              onChange={(e) => search.onChange(e.target.value)}
              className="h-8 w-[240px] text-xs"
            />
          )}
          {filters?.map((f) => {
            if (f.type === "text") {
              return (
                <Input
                  key={f.id}
                  placeholder={f.label}
                  value={f.value}
                  onChange={(e) => f.onChange(e.target.value)}
                  className="h-8 w-[180px] text-xs"
                />
              )
            }
            if ((f.type === "select" || f.type === "date-range") && f.options) {
              return (
                <Select key={f.id} value={f.value} onValueChange={(value) => f.onChange(value ?? "")}>
                  <SelectTrigger className="h-8 w-[160px] text-xs">
                    <SelectValue placeholder={f.label} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{f.label}: All</SelectItem>
                    {f.options.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )
            }
            return null
          })}
        </div>
      )}

      {/* Bulk actions bar */}
      {bulkActions && selectedCount > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-primary-container/10 px-3 py-2">
          <Badge variant="default">{selectedCount} selected</Badge>
          {bulkActions.map((action, i) => (
            <Button
              key={i}
              size="sm"
              variant={action.variant ?? "outline"}
              onClick={() => {
                const selectedRows = table
                  .getSelectedRowModel()
                  .rows.map((r) => r.original)
                action.action(selectedRows)
              }}
              className="h-7 text-xs gap-1"
            >
              {action.icon}
              {action.label}
            </Button>
          ))}
        </div>
      )}

      {/* Table */}
      <div
        className="relative overflow-x-auto rounded-lg border border-border"
        role="grid"
        aria-label={loading ? "Loading data..." : "Data table"}
        aria-rowcount={totalRows}
      >
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="bg-surface-high hover:bg-surface-high">
                {headerGroup.headers.map((header, colIdx) => {
                  const isSorted = header.column.getIsSorted()
                  const canSort = header.column.getCanSort()

                  return (
                    <TableHead
                      key={header.id}
                      colSpan={header.colSpan}
                      aria-sort={
                        isSorted === "asc"
                          ? "ascending"
                          : isSorted === "desc"
                            ? "descending"
                            : undefined
                      }
                      className={cn(
                        densityRowClass[density],
                        stickyFirstColumn && colIdx === 0 && "sticky left-0 z-10 bg-surface-high"
                      )}
                      style={
                        stickyFirstColumn && colIdx === 0
                          ? { boxShadow: "2px 0 4px -2px rgba(0,0,0,0.3)" }
                          : undefined
                      }
                    >
                      {canSort ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="inline-flex items-center cursor-pointer select-none hover:text-text"
                          aria-label={`Sort by ${String(header.column.columnDef.header ?? "")}`}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          <SortIcon sorted={isSorted} />
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          {loading ? (
            <DataTableSkeleton columns={columns.length} />
          ) : (
            <TableBody>
              {table.getRowModel().rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center text-text-muted"
                  >
                    No results found.
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    aria-selected={row.getIsSelected()}
                    className={cn(
                      densityRowClass[density],
                      "hover:bg-surface-high/60 transition-colors"
                    )}
                  >
                    {row.getVisibleCells().map((cell, colIdx) => (
                      <TableCell
                        key={cell.id}
                        className={cn(
                          stickyFirstColumn && colIdx === 0 && "sticky left-0 z-[5] bg-surface"
                        )}
                        style={
                          stickyFirstColumn && colIdx === 0
                            ? { boxShadow: "2px 0 4px -2px rgba(0,0,0,0.2)" }
                            : undefined
                        }
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          )}
        </Table>
      </div>

      {/* Pagination footer */}
      {totalRows > 0 && (
        <div className="flex items-center justify-between text-xs text-text-muted">
          <span className="tabular-nums">
            Showing {showingFrom}–{showingTo} of {totalRows.toLocaleString()}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Previous
            </Button>
            <span className="px-2 tabular-nums">
              {pageIndex + 1} / {Math.max(1, table.getPageCount())}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DataTableUntyped = DataTable as <T>(props: DataTableProps<T>) => React.JSX.Element

export { DataTableUntyped as DataTable }
export { textFilter }
