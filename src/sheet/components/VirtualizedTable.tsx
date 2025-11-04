import { useRef, useMemo } from 'preact/hooks';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  SheetRow,
  SheetColumnDefinition,
  ImporterOutputFieldType,
  ImporterValidationError,
} from '@/types';
import CellRenderer from './VirtualizedCellRenderer';

interface VirtualizedTableProps {
  data: SheetRow[];
  columns: SheetColumnDefinition[];
  onCellChange: (rowIndex: number, columnId: string, value: ImporterOutputFieldType) => void;
  validationErrors?: ImporterValidationError[];
  height?: number;
  width?: number;
  rowHeight?: number;
  defaultColumnWidth?: number;
  /** Enable performance mode for very large datasets (>50k rows) */
  performanceMode?: boolean;
}

/**
 * High-performance virtualized table component using @tanstack/react-virtual
 * Supports bidimensional virtualization (rows and columns) for handling large datasets
 * Optimized for 600+ columns and 140k+ rows with minimal re-renders
 */
export default function VirtualizedTable({
  data,
  columns,
  onCellChange,
  validationErrors = [],
  height = 600,
  width,
  rowHeight = 40,
  defaultColumnWidth = 150,
  performanceMode = false,
}: VirtualizedTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  // Auto-enable performance mode for very large datasets
  const isLargeDataset = data.length > 50000;
  const effectivePerformanceMode = performanceMode || isLargeDataset;

  // Create error lookup map for O(1) access
  const errorMap = useMemo(() => {
    const map = new Map<string, ImporterValidationError[]>();
    validationErrors.forEach((error) => {
      const key = `${error.rowIndex}-${error.columnId}`;
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(error);
    });
    return map;
  }, [validationErrors]);

  // Row virtualizer with optimized settings for large datasets
  const rowVirtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    // Reduce overscan for performance mode
    overscan: effectivePerformanceMode ? 2 : 5,
    // Enable smooth scrolling even for large lists
    measureElement:
      typeof window !== 'undefined' && window.ResizeObserver
        ? (element) => element.getBoundingClientRect().height
        : undefined,
  });

  // Column virtualizer with optimized settings
  const columnVirtualizer = useVirtualizer({
    horizontal: true,
    count: columns.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      // Use custom width if available, otherwise default
      const column = columns[index];
      return (column as any).width ?? defaultColumnWidth;
    },
    // Reduce overscan for performance mode
    overscan: effectivePerformanceMode ? 2 : 3,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const virtualColumns = columnVirtualizer.getVirtualItems();

  const totalHeight = rowVirtualizer.getTotalSize();
  const totalWidth = columnVirtualizer.getTotalSize();

  // Auto-calculate width if not provided
  const containerWidth = width ?? (typeof window !== 'undefined' ? window.innerWidth - 100 : 1200);

  return (
    <div className="flex h-full flex-col border border-gray-200">
      {/* Header Row */}
      <div
        className="flex-none border-b border-gray-300 bg-gray-50"
        style={{
          width: containerWidth,
          height: rowHeight,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div
          style={{
            width: totalWidth,
            height: rowHeight,
            position: 'relative',
          }}
        >
          {virtualColumns.map((virtualColumn) => {
            const column = columns[virtualColumn.index];
            return (
              <div
                key={virtualColumn.key}
                className="absolute left-0 top-0 flex items-center border-r border-gray-300 px-2 font-semibold"
                style={{
                  width: virtualColumn.size,
                  height: rowHeight,
                  transform: `translateX(${virtualColumn.start}px)`,
                }}
              >
                <span className="truncate" title={column.label}>
                  {column.label}
                </span>
                {column.type === 'calculated' && (
                  <span className="ml-1 text-xs text-gray-500">(calc)</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Data Rows */}
      <div
        ref={parentRef}
        className="flex-1 overflow-auto"
        style={{
          height,
          width: containerWidth,
        }}
      >
        <div
          style={{
            height: totalHeight,
            width: totalWidth,
            position: 'relative',
          }}
        >
          {virtualRows.map((virtualRow) => {
            const row = data[virtualRow.index];
            
            return (
              <div
                key={virtualRow.key}
                className="absolute left-0 top-0"
                style={{
                  height: virtualRow.size,
                  transform: `translateY(${virtualRow.start}px)`,
                  width: '100%',
                }}
              >
                {virtualColumns.map((virtualColumn) => {
                  const column = columns[virtualColumn.index];
                  const value = row[column.id];
                  const errorKey = `${virtualRow.index}-${column.id}`;
                  const hasError = errorMap.has(errorKey);

                  return (
                    <div
                      key={virtualColumn.key}
                      className="absolute left-0 top-0 border-b border-r border-gray-200"
                      style={{
                        width: virtualColumn.size,
                        height: virtualRow.size,
                        transform: `translateX(${virtualColumn.start}px)`,
                      }}
                    >
                      <CellRenderer
                        value={value}
                        column={column}
                        rowIndex={virtualRow.index}
                        columnIndex={virtualColumn.index}
                        onChange={(newValue) =>
                          onCellChange(virtualRow.index, column.id, newValue)
                        }
                        hasError={hasError}
                      />
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer with stats */}
      <div className="flex-none border-t border-gray-300 bg-gray-50 px-4 py-2 text-sm text-gray-600">
        <div className="flex justify-between">
          <span>
            {data.length} rows × {columns.length} columns
          </span>
          <span>
            {validationErrors.length > 0 && (
              <span className="text-red-600">
                {validationErrors.length} error(s)
              </span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
