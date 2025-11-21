import { useRef, useMemo, useState } from 'preact/hooks';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  ColumnDef,
  flexRender,
  SortingState,
  ColumnFiltersState,
} from '@tanstack/react-table';
import type {
  SheetRow,
  SheetColumnDefinition,
  ImporterValidationError,
} from '@/types';

interface Props {
  data: SheetRow[];
  columns: SheetColumnDefinition[];
  onCellChange: (rowIndex: number, columnId: string, value: any) => void;
  validationErrors?: ImporterValidationError[];
  height?: string;
  rowHeight?: number;
  columnWidth?: number;
}

/**
 * High-performance virtualized table using TanStack Table + TanStack Virtual
 * Supports:
 * - 2D virtualization (rows and columns)
 * - Inline cell editing
 * - Sorting and filtering
 * - Validation error highlighting
 * - Optimized for 100k+ rows
 */
export default function VirtualizedTableTanStack({
  data,
  columns: sheetColumns,
  onCellChange,
  validationErrors = [],
  height = '600px',
  rowHeight = 36,
  columnWidth = 150,
}: Props) {
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [editingCell, setEditingCell] = useState<{ row: number; col: string } | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  // Create error lookup for fast access O(1)
  const errorMap = useMemo(() => {
    const map = new Map<string, string>();
    validationErrors.forEach((error) => {
      map.set(`${error.rowIndex}-${error.columnId}`, error.message);
    });
    return map;
  }, [validationErrors]);

  // Convert SheetColumnDefinition to TanStack ColumnDef
  const tableColumns = useMemo<ColumnDef<SheetRow>[]>(() => {
    return sheetColumns.map((col) => ({
      accessorKey: col.id,
      id: col.id,
      header: col.label || col.id,
      size: columnWidth,
      minSize: 100,
      maxSize: 500,
      cell: (info) => {
        const rowIndex = info.row.index;
        const columnId = col.id;
        const value = info.getValue();
        const errorKey = `${rowIndex}-${columnId}`;
        const hasError = errorMap.has(errorKey);
        const isEditing = editingCell?.row === rowIndex && editingCell?.col === columnId;

        if (isEditing) {
          return (
            <input
              className="vtable-input"
              defaultValue={(value as any) || ''}
              autoFocus
              onBlur={(e) => {
                handleCellEdit(rowIndex, columnId, (e.target as HTMLInputElement).value);
              }}
              onKeyDown={(e) => {
                if ((e as any).key === 'Enter') {
                  handleCellEdit(rowIndex, columnId, (e.target as HTMLInputElement).value);
                } else if ((e as any).key === 'Escape') {
                  setEditingCell(null);
                }
              }}
            />
          );
        }

        return (
          <div
            className={`vtable-cell-content ${hasError ? 'error' : ''}`}
            {...({
              onDoubleClick: () => setEditingCell({ row: rowIndex, col: columnId }),
            } as any)}
            title={hasError ? errorMap.get(errorKey) : ''}
          >
            {value as any}
          </div>
        );
      },
    }));
  }, [sheetColumns, errorMap, editingCell, columnWidth]);

  // Initialize TanStack Table
  const table = useReactTable({
    data,
    columns: tableColumns,
    state: {
      sorting,
      columnFilters,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    debugTable: false,
  });

  const { rows } = table.getRowModel();

  // Row virtualizer
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => rowHeight,
    overscan: 10,
  });

  // Column virtualizer
  const columnVirtualizer = useVirtualizer({
    horizontal: true,
    count: table.getVisibleLeafColumns().length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => columnWidth,
    overscan: 5,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const virtualColumns = columnVirtualizer.getVirtualItems();

  // Handle cell edit
  const handleCellEdit = (rowIndex: number, columnId: string, value: string) => {
    onCellChange(rowIndex, columnId, value);
    setEditingCell(null);
  };

  // Total sizes for scroll container
  const totalHeight = rowVirtualizer.getTotalSize();
  const totalWidth = columnVirtualizer.getTotalSize();

  return (
    <div className="vtable-container">
      <style>{`
        .vtable-container {
          width: 100%;
          height: ${height};
          overflow: auto;
          position: relative;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
        }
        
        .vtable-wrapper {
          position: relative;
        }
        
        .vtable-header {
          display: flex;
          position: sticky;
          top: 0;
          z-index: 10;
          background: #f9fafb;
          border-bottom: 2px solid #d1d5db;
        }
        
        .vtable-header-cell {
          display: flex;
          align-items: center;
          padding: 12px 8px;
          font-weight: 600;
          font-size: 13px;
          color: #374151;
          border-right: 1px solid #e5e7eb;
          user-select: none;
          cursor: pointer;
          background: #f9fafb;
        }
        
        .vtable-header-cell:hover {
          background: #f3f4f6;
        }
        
        .vtable-header-cell.sortable {
          cursor: pointer;
        }
        
        .vtable-sort-icon {
          margin-left: 4px;
          font-size: 10px;
          opacity: 0.5;
        }
        
        .vtable-body {
          position: relative;
        }
        
        .vtable-row {
          display: flex;
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
        }
        
        .vtable-cell {
          display: flex;
          align-items: center;
          padding: 8px;
          border-right: 1px solid #e5e7eb;
          border-bottom: 1px solid #f3f4f6;
          background: white;
          font-size: 13px;
          color: #1f2937;
        }
        
        .vtable-cell:hover {
          background: #f9fafb;
        }
        
        .vtable-cell-content {
          width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        
        .vtable-cell-content.error {
          color: #dc2626;
          font-weight: 500;
        }
        
        .vtable-cell.has-error {
          background: #fef2f2 !important;
          border-color: #fecaca;
        }
        
        .vtable-input {
          width: 100%;
          height: 100%;
          border: 2px solid #3b82f6;
          padding: 6px;
          font-size: 13px;
          outline: none;
          border-radius: 4px;
        }
        
        .vtable-input:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }
      `}</style>

      <div
        ref={tableContainerRef}
        className="vtable-container"
        style={{ height, width: '100%', overflow: 'auto' }}
      >
        <div
          className="vtable-wrapper"
          style={{
            height: `${totalHeight + 40}px`, // +40 for header
            width: `${totalWidth}px`,
          }}
        >
          {/* Header */}
          <div className="vtable-header">
            {virtualColumns.map((virtualColumn) => {
              const column = table.getVisibleLeafColumns()[virtualColumn.index];
              const isSorted = column.getIsSorted();
              
              return (
                <div
                  key={column.id}
                  className="vtable-header-cell sortable"
                  style={{
                    width: `${virtualColumn.size}px`,
                    transform: `translateX(${virtualColumn.start}px)`,
                  }}
                  {...({ onClick: column.getToggleSortingHandler() } as any)}
                >
                  {typeof column.columnDef.header === 'function'
                    ? column.columnDef.header({} as any)
                    : column.columnDef.header}
                  {isSorted && (
                    <span className="vtable-sort-icon">
                      {isSorted === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Body */}
          <div className="vtable-body">
            {virtualRows.map((virtualRow) => {
              const row = rows[virtualRow.index];
              const visibleCells = row.getVisibleCells();

              return (
                <div
                  key={row.id}
                  className="vtable-row"
                  style={{
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start + 40}px)`, // +40 for header
                  }}
                >
                  {virtualColumns.map((virtualColumn) => {
                    const cell = visibleCells[virtualColumn.index];
                    const errorKey = `${row.index}-${cell.column.id}`;
                    const hasError = errorMap.has(errorKey);

                    return (
                      <div
                        key={cell.id}
                        className={`vtable-cell ${hasError ? 'has-error' : ''}`}
                        style={{
                          width: `${virtualColumn.size}px`,
                          transform: `translateX(${virtualColumn.start}px)`,
                        }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
