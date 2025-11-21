import { useMemo, useState } from 'preact/hooks';
import {
  SheetDefinition,
  SheetState,
  ImporterValidationError,
  CellChangedPayload,
} from '@/types';
import VirtualizedTableLite from './VirtualizedTableLite';
import VirtualizedTableTanStack from './VirtualizedTableTanStack';

interface Props {
  sheetDefinition: SheetDefinition;
  data: SheetState;
  sheetValidationErrors: ImporterValidationError[];
  setRowData: (payload: CellChangedPayload) => void;
  useTanStack?: boolean; // New prop to toggle between implementations
}

/**
 * High-performance sheet editor using bidimensional virtualization
 * Optimized for handling 600+ columns with minimal re-renders
 */
export default function SheetDataEditorVirtualized({
  sheetDefinition,
  data,
  sheetValidationErrors,
  setRowData,
  useTanStack = true, // Default to TanStack implementation
}: Props) {
  const [showTanStack, setShowTanStack] = useState(useTanStack);
  // Cell change handler that wraps setRowData
  const handleCellChange = useMemo(() => (
    rowIndex: number,
    columnId: string,
    value: any
  ) => {
    const rowValue = { ...data.rows[rowIndex] };
    rowValue[columnId] = value;
    
    setRowData({
      sheetId: sheetDefinition.id,
      value: rowValue,
      rowIndex,
    });
  }, [data.rows, sheetDefinition.id, setRowData]);

  // Filter validation errors for current sheet
  const filteredErrors = useMemo(() => {
    return sheetValidationErrors.filter((error) => 
      sheetDefinition.columns.some((col) => col.id === error.columnId)
    );
  }, [sheetValidationErrors, sheetDefinition.columns]);

  return (
    <div className="flex h-full flex-col">
      {/* Toggle between implementations */}
      <div className="mb-2 flex items-center gap-2 px-4 py-2 bg-gray-50 border-b">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={showTanStack}
            onChange={(e) => setShowTanStack((e.target as HTMLInputElement).checked)}
            className="rounded"
          />
          <span className="font-medium">
            Use TanStack Table (with sorting & filtering)
          </span>
        </label>
        <span className="text-xs text-gray-500">
          {data.rows.length.toLocaleString()} rows × {sheetDefinition.columns.length} columns
        </span>
      </div>

      {showTanStack ? (
        <VirtualizedTableTanStack
          data={data.rows}
          columns={sheetDefinition.columns}
          onCellChange={handleCellChange}
          validationErrors={filteredErrors}
          height="calc(100vh - 250px)"
          rowHeight={36}
          columnWidth={150}
        />
      ) : (
        <VirtualizedTableLite
          data={data.rows}
          columns={sheetDefinition.columns}
          onCellChange={handleCellChange}
          validationErrors={filteredErrors}
        />
      )}
    </div>
  );
}
