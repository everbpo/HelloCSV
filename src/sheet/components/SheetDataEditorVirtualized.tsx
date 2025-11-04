import { useMemo } from 'preact/hooks';
import {
  SheetDefinition,
  SheetState,
  ImporterValidationError,
  EnumLabelDict,
  RemoveRowsPayload,
} from '@/types';
import VirtualizedTable from './VirtualizedTable';
import { useOptimizedCellChange } from '@/importer/hooks';

interface Props {
  sheetDefinition: SheetDefinition;
  data: SheetState;
  sheetValidationErrors: ImporterValidationError[];
  removeRows: (payload: RemoveRowsPayload) => void;
  addEmptyRow: () => void;
  resetState: () => void;
  enumLabelDict: EnumLabelDict;
}

/**
 * High-performance sheet editor using bidimensional virtualization
 * Optimized for handling 600+ columns with minimal re-renders
 */
export default function SheetDataEditorVirtualized({
  sheetDefinition,
  data,
  sheetValidationErrors,
}: Props) {
  // Use optimized cell change handler with debouncing
  const handleCellChange = useOptimizedCellChange(data.sheetId);

  // Filter validation errors for current sheet
  const filteredErrors = useMemo(() => {
    return sheetValidationErrors.filter((error) => 
      sheetDefinition.columns.some((col) => col.id === error.columnId)
    );
  }, [sheetValidationErrors, sheetDefinition.columns]);

  return (
    <div className="flex h-full flex-col">
      <VirtualizedTable
        data={data.rows}
        columns={sheetDefinition.columns}
        onCellChange={handleCellChange}
        validationErrors={filteredErrors}
        height={600}
        rowHeight={40}
        defaultColumnWidth={150}
      />
    </div>
  );
}
