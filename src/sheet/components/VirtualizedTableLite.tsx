import { useRef, useMemo, useState } from 'preact/hooks';
import { useVirtualizer } from '@tanstack/react-virtual';
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
}

/**
 * ULTRA-LIGHTWEIGHT virtualized table for 140k+ rows
 * Only renders visible cells with minimal overhead
 */
export default function VirtualizedTableLite({
  data,
  columns,
  onCellChange,
  validationErrors = [],
}: Props) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [editingCell, setEditingCell] = useState<{ row: number; col: string } | null>(null);
  
  // Create error lookup for fast access
  const errorMap = useMemo(() => {
    const map = new Map<string, string>();
    validationErrors.forEach((error) => {
      map.set(`${error.rowIndex}-${error.columnId}`, error.message);
    });
    return map;
  }, [validationErrors]);

  // Row virtualizer - MINIMAL CONFIG
  const rowVirtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36,
    overscan: 5, // Only 5 rows buffer
  });

  // Column virtualizer - MINIMAL CONFIG  
  const columnVirtualizer = useVirtualizer({
    horizontal: true,
    count: columns.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 150,
    overscan: 3, // Only 3 columns buffer
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const virtualColumns = columnVirtualizer.getVirtualItems();

  // Handle cell edit
  const handleCellEdit = (rowIndex: number, columnId: string, value: string) => {
    onCellChange(rowIndex, columnId, value);
    setEditingCell(null);
  };

  return (
    <div
      ref={parentRef}
      style={{
        height: '600px',
        width: '100%',
        overflow: 'auto',
        position: 'relative',
      }}
    >
      <style>{`
        .vtable { position: relative; }
        .vtable-row { position: absolute; display: flex; top: 0; left: 0; }
        .vtable-cell {
          border: 1px solid #e5e7eb;
          padding: 8px;
          background: white;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 13px;
        }
        .vtable-cell:hover { background: #f9fafb; }
        .vtable-cell.error {
          background: #fee2e2 !important;
          color: #991b1b;
          border-color: #ef4444;
        }
        .vtable-header {
          position: sticky;
          top: 0;
          z-index: 100;
          background: #f3f4f6;
          font-weight: 600;
          border-bottom: 2px solid #d1d5db;
        }
        .vtable-input {
          width: 100%;
          height: 100%;
          border: 2px solid #3b82f6;
          padding: 6px;
          font-size: 13px;
          box-sizing: border-box;
        }
      `}</style>

      <div
        className="vtable"
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: `${columnVirtualizer.getTotalSize()}px`,
        }}
      >
        {/* Header */}
        <div className="vtable-row vtable-header" style={{ position: 'sticky', top: 0, zIndex: 100 }}>
          {columns.map((col) => (
            <div
              key={col.id}
              className="vtable-cell"
              style={{
                width: '150px',
                minWidth: '150px',
                maxWidth: '150px',
              }}
            >
              {col.label || col.id}
            </div>
          ))}
        </div>

        {/* Virtual Rows */}
        {virtualRows.map((vRow) => {
          const rowIndex = vRow.index;
          const row = data[rowIndex];
          
          return (
            <div
              key={vRow.key}
              className="vtable-row"
              style={{
                height: `${vRow.size}px`,
                transform: `translateY(${vRow.start + 40}px)`, // +40 for header
              }}
            >
              {virtualColumns.map((vCol) => {
                const colIndex = vCol.index;
                const column = columns[colIndex];
                const value = row?.[column.id];
                const errorKey = `${rowIndex}-${column.id}`;
                const hasError = errorMap.has(errorKey);
                const isEditing = editingCell?.row === rowIndex && editingCell?.col === column.id;

                return (
                  <div
                    key={vCol.key}
                    className={`vtable-cell ${hasError ? 'error' : ''}`}
                    style={{
                      width: '150px',
                      minWidth: '150px',
                      maxWidth: '150px',
                    }}
                    {...({ onDoubleClick: () => setEditingCell({ row: rowIndex, col: column.id }) } as any)}
                    title={hasError ? errorMap.get(errorKey) : ''}
                  >
                    {isEditing ? (
                      <input
                        className="vtable-input"
                        defaultValue={value || ''}
                        autoFocus
                        onBlur={(e) => handleCellEdit(rowIndex, column.id, (e.target as HTMLInputElement).value)}
                        onKeyDown={(e) => {
                          if ((e as any).key === 'Enter') {
                            handleCellEdit(rowIndex, column.id, ((e.target as HTMLInputElement).value));
                          } else if ((e as any).key === 'Escape') {
                            setEditingCell(null);
                          }
                        }}
                      />
                    ) : (
                      <span>{value ?? ''}</span>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
