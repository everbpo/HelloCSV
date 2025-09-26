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
  const [errorColumnFilter, setErrorColumnFilter] = useState<string | null>('');
  const [viewMode, setViewMode] = useState<SheetViewMode>('all');

  // Clear selection when data changes
  useEffect(() => {
    setSelectedRows([]);
  }, [data]);

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

      <div className="min-h-0 flex-1 overflow-auto ag-theme-balham" ref={tableContainerRef}>
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
      </div>
    </div>
  );
}