import { useMemo } from 'preact/hooks';
import {
  SheetDefinition,
  SheetState,
  ImporterValidationError,
  CellChangedPayload,
} from '@/types';
import VirtualizedTableLite from './VirtualizedTableLite';

interface Props {
  sheetDefinition: SheetDefinition;
  data: SheetState;
  sheetValidationErrors: ImporterValidationError[];
  setRowData: (payload: CellChangedPayload) => void;
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
}: Props) {
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
      <VirtualizedTableLite
        data={data.rows}
        columns={sheetDefinition.columns}
        onCellChange={handleCellChange}
        validationErrors={filteredErrors}
      />
    </div>
  );
}
