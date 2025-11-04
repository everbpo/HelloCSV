import { useEffect, useMemo, useRef, useState, useCallback } from 'preact/hooks';
import {
  SheetDefinition,
  SheetState,
  SheetRow,
  SheetViewMode,
  EnumLabelDict,
  CellChangedPayload,
  ImporterValidationError,
  RemoveRowsPayload,
} from '@/types';
import SheetDataEditorAGGrid from './SheetDataEditorAGGrid';
import SheetDataEditorVirtualized from './SheetDataEditorVirtualized';
import SheetDataEditorActions from './SheetDataEditorActions';
import { useFilteredRowData } from '../utils';
import { useImporterState } from '@/importer/reducer';

interface Props {
  sheetDefinition: SheetDefinition;
  data: SheetState;
  sheetValidationErrors: ImporterValidationError[];
  setRowData: (payload: CellChangedPayload) => void;
  removeRows: (payload: RemoveRowsPayload) => void;
  addEmptyRow: () => void;
  resetState: () => void;
  enumLabelDict: EnumLabelDict;
}

export default function SheetDataEditor({
  sheetDefinition,
  data,
  sheetValidationErrors,
  setRowData,
  removeRows,
  addEmptyRow,
  resetState,
  enumLabelDict,
}: Props) {
  const { sheetData: allData } = useImporterState();

  // States for filtering and view mode
  const [selectedRows, setSelectedRows] = useState<SheetRow[]>([]);
  const [searchPhrase, setSearchPhrase] = useState<string>('');
  const [errorColumnFilter, setErrorColumnFilter] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<SheetViewMode>('all');
  
  // Toggle between AG-Grid and Virtualized table
  const [useVirtualized, setUseVirtualized] = useState<boolean>(
    sheetDefinition.columns.length > 100 // Auto-enable for 100+ columns
  );

  // Clear selection when data changes
  useEffect(() => {
    setSelectedRows([]);
    setViewMode('all');
  }, [sheetDefinition, data]);

  // Filtered row data based on current filters
  const rowData = useFilteredRowData(
    data,
    allData,
    viewMode,
    sheetValidationErrors,
    errorColumnFilter,
    sheetDefinition,
    searchPhrase
  );

  // Row validation summary
  const rowValidationSummary = useMemo(() => {
    const allRows = data.rows;
    const validRows = allRows.filter(
      (_, index) =>
        !sheetValidationErrors.some((error) => error.rowIndex === index)
    );
    const invalidRows = allRows.filter((_, index) =>
      sheetValidationErrors.some((error) => error.rowIndex === index)
    );
    return {
      all: allRows.length,
      valid: validRows.length,
      errors: invalidRows.length,
    };
  }, [data, sheetValidationErrors]);

  // Adaptador para usar setRowData directamente con AG-Grid
  const adaptedSetRowData = useCallback((payload: CellChangedPayload) => {
    setRowData(payload);
  }, [setRowData]);

  const tableContainerRef = useRef<HTMLDivElement>(null);

  return (
    <div className="flex h-full flex-col">
      <div className="flex-none">
        <SheetDataEditorActions
          sheetDefinition={sheetDefinition}
          rowData={rowData}
          selectedRows={selectedRows}
          setSelectedRows={setSelectedRows}
          viewMode={viewMode}
          setViewMode={setViewMode}
          searchPhrase={searchPhrase}
          setSearchPhrase={setSearchPhrase}
          errorColumnFilter={errorColumnFilter}
          setErrorColumnFilter={(mode: string | null) => setErrorColumnFilter(mode)}
          removeRows={removeRows}
          addEmptyRow={addEmptyRow}
          sheetValidationErrors={sheetValidationErrors}
          rowValidationSummary={rowValidationSummary}
          resetState={resetState}
          enumLabelDict={enumLabelDict}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-auto" ref={tableContainerRef}>
        {/* Toggle button for switching between renderers */}
        <div className="flex items-center gap-2 border-b border-gray-200 bg-gray-50 px-4 py-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={useVirtualized}
              onChange={(e) => setUseVirtualized((e.target as HTMLInputElement).checked)}
              className="rounded"
            />
            <span>Use high-performance virtualized table ({sheetDefinition.columns.length} columns)</span>
          </label>
          <span className="ml-auto text-xs text-gray-500">
            {useVirtualized ? 'Virtualized mode: Optimized for 600+ columns' : 'AG-Grid mode: Full features'}
          </span>
        </div>

        {useVirtualized ? (
          <SheetDataEditorVirtualized
            sheetDefinition={sheetDefinition}
            data={data}
            sheetValidationErrors={sheetValidationErrors}
            setRowData={adaptedSetRowData}
          />
        ) : (
          <SheetDataEditorAGGrid
            sheetDefinition={sheetDefinition}
            data={data}
            sheetValidationErrors={sheetValidationErrors}
            setRowData={adaptedSetRowData}
            removeRows={removeRows}
            addEmptyRow={addEmptyRow}
            resetState={resetState}
            enumLabelDict={enumLabelDict}
          />
        )}
      </div>
    </div>
  );
}
