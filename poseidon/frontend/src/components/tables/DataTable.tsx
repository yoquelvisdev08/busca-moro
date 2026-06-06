import * as React from "react"
import { useCallback } from "react"
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
import { ChevronUp, ChevronDown, ChevronsUpDown, Search } from "lucide-react"
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
import { Checkbox } from "@/components/ui/checkbox"

export type TableDensity = "compact" | "normal" | "comfortable"

const densityRowClass: Record<TableDensity, string> = {
  compact: "h-8 [&>td]:py-1 [&>th]:py-1",
  normal: "h-10 [&>td]:py-2 [&>th]:py-2",
  comfortable: "h-12 [&>td]:py-3 [&>th]:py-3",
}

/** Sin relleno sólido: solo borde y marca (tabla de leads). */
const tableSelectCheckboxClass =
  "border-border/70 bg-transparent text-primary data-checked:border-primary data-checked:bg-transparent data-checked:text-primary data-indeterminate:border-primary data-indeterminate:bg-transparent data-indeterminate:text-primary"

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
  rowSelection: rowSelectionProp,
  onRowSelectionChange: onRowSelectionChangeProp,
  stickyFirstColumn = true,
  getRowId,
  className,
}: DataTableProps<T>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [internalRowSelection, setInternalRowSelection] =
    React.useState<RowSelectionState>({})

  const selectionEnabled = Boolean(bulkActions && bulkActions.length > 0)
  const rowSelection = rowSelectionProp ?? internalRowSelection
  const onRowSelectionChange =
    onRowSelectionChangeProp ?? (selectionEnabled ? setInternalRowSelection : undefined)

  const tableColumns = React.useMemo((): ColumnDef<T, unknown>[] => {
    if (!selectionEnabled) return columns

    const selectColumn: ColumnDef<T, unknown> = {
      id: "_select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          indeterminate={
            table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()
          }
          onCheckedChange={(checked) =>
            table.toggleAllPageRowsSelected(checked === true)
          }
          aria-label="Seleccionar todos en esta página"
          onClick={(e) => e.stopPropagation()}
          className={tableSelectCheckboxClass}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(checked) => row.toggleSelected(checked === true)}
          aria-label="Seleccionar fila"
          onClick={(e) => e.stopPropagation()}
          className={tableSelectCheckboxClass}
        />
      ),
      enableSorting: false,
      size: 44,
    }
    return [selectColumn, ...columns]
  }, [columns, selectionEnabled])

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
    columns: tableColumns,
    enableRowSelection: selectionEnabled,
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
    pageCount,
    getRowId: getRowId as ((originalRow: T, index: number, parent?: unknown) => string) | undefined,
  })

  const [focusedRowIndex, setFocusedRowIndex] = React.useState(-1)

  // Keyboard navigation: arrow keys for row focus
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const rows = table.getRowModel().rows
      if (rows.length === 0) return

      if (e.key === "ArrowDown") {
        e.preventDefault()
        setFocusedRowIndex((prev) => Math.min(prev + 1, rows.length - 1))
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setFocusedRowIndex((prev) => Math.max(prev - 1, 0))
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        if (focusedRowIndex >= 0 && onRowSelectionChange) {
          const row = rows[focusedRowIndex]
          const rowId = row.id
          const currentSelection = { ...table.getState().rowSelection }
          if (currentSelection[rowId]) {
            delete currentSelection[rowId]
          } else {
            currentSelection[rowId] = true
          }
          onRowSelectionChange(currentSelection)
        }
      }
    },
    [table, focusedRowIndex, onRowSelectionChange]
  )

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
        <div className="flex flex-wrap items-center gap-2.5">
          {search && (
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-text-dim"
                aria-hidden
              />
              <Input
                placeholder={search.placeholder ?? "Buscar..."}
                value={search.value}
                onChange={(e) => search.onChange(e.target.value)}
                className="h-9 w-[min(100%,280px)] pl-8 text-xs bg-surface-high/40 border-border/80"
                aria-label={search.placeholder ?? "Buscar en la tabla"}
              />
            </div>
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
                  aria-label={`Filter by ${f.label}`}
                />
              )
            }
            if ((f.type === "select" || f.type === "date-range") && f.options) {
              return (
                <Select key={f.id} value={f.value} onValueChange={(value) => f.onChange(value ?? "")}>
                  <SelectTrigger className="h-9 w-[160px] text-xs bg-surface-high/40 border-border/80" aria-label={`Filtrar por ${f.label}`}>
                    <SelectValue placeholder={f.label} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos · {f.label}</SelectItem>
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
      {selectionEnabled && selectedCount > 0 && bulkActions && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-primary-container/10 px-3 py-2">
          <Badge variant="default">
            {selectedCount} seleccionado{selectedCount === 1 ? "" : "s"}
          </Badge>
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
        className="relative overflow-x-auto rounded-lg border border-border/80 bg-surface/30 outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0"
        role="grid"
        aria-label={loading ? "Loading data..." : "Data table"}
        aria-rowcount={totalRows}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="border-b border-border/60 bg-surface-high/80 hover:bg-surface-high/80">
                {headerGroup.headers.map((header, colIdx) => {
                  const isSorted = header.column.getIsSorted()
                  const canSort = header.column.getCanSort()
                  const isSelectCol = header.column.id === "_select"
                  const stickyThisCol =
                    stickyFirstColumn && colIdx === 0 && !isSelectCol

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
                        "text-[11px] uppercase tracking-wider text-text-muted font-semibold",
                        isSelectCol && "w-11 max-w-11 px-2",
                        stickyThisCol && "sticky left-0 z-10 bg-surface-high/80",
                      )}
                      style={
                        stickyThisCol
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
            <DataTableSkeleton columns={tableColumns.length} />
          ) : (
            <TableBody>
              {table.getRowModel().rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={tableColumns.length}
                    role="gridcell"
                    className="h-24 text-center text-text-muted"
                  >
                    Sin resultados.
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row, rowIdx) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    aria-selected={row.getIsSelected()}
                    role="row"
                    tabIndex={rowIdx === focusedRowIndex ? 0 : -1}
                    className={cn(
                      densityRowClass[density],
                      "group border-b border-border/40 transition-colors",
                      "hover:bg-surface-high/50",
                      "data-[state=selected]:bg-surface-high/70 data-[state=selected]:border-l-2 data-[state=selected]:border-l-primary/60",
                      rowIdx === focusedRowIndex &&
                        "ring-1 ring-inset ring-border/80 bg-surface-high/40"
                    )}
                  >
                    {row.getVisibleCells().map((cell, colIdx) => {
                      const isSelectCol = cell.column.id === "_select"
                      const stickyThisCol =
                        stickyFirstColumn && colIdx === 0 && !isSelectCol

                      return (
                      <TableCell
                        key={cell.id}
                        role="gridcell"
                        className={cn(
                          isSelectCol && "w-11 max-w-11 px-2",
                          stickyThisCol && "sticky left-0 z-[5] bg-surface",
                        )}
                        style={
                          stickyThisCol
                            ? { boxShadow: "2px 0 4px -2px rgba(0,0,0,0.2)" }
                            : undefined
                        }
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    )})}
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
            {showingFrom}–{showingTo} de {totalRows.toLocaleString()}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Anterior
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
              Siguiente
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
