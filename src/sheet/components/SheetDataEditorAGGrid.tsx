import { useEffect, useMemo, useState, useCallback, useRef } from 'preact/hooks';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry, type ColDef, type GridReadyEvent, type CellValueChangedEvent, type GridApi } from 'ag-grid-community';
import { sheetGridTheme } from '../theme/agGridTheme';

import {
  SheetDefinition,
  SheetState,
  SheetRow,
  SheetViewMode,
  EnumLabelDict,
  CellChangedPayload,
  ImporterOutputFieldType,
  ImporterValidationError,
  RemoveRowsPayload,
} from '@/types';
import SheetDataEditorActions from './SheetDataEditorActions';
import { useFilteredRowData } from '../utils';
import { useImporterState } from '@/importer/reducer';
import { useImporterDefinition } from '@/importer/hooks';

// Registrar módulos comunidad (solo una vez)
ModuleRegistry.registerModules([AllCommunityModule]);

// El tema ahora se centraliza en sheetGridTheme (Theming API v34)

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

export default function SheetDataEditorAGGrid({
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
  const { availableActions } = useImporterDefinition();

  const [selectedRows, setSelectedRows] = useState<SheetRow[]>([]);
  const [viewMode, setViewMode] = useState<SheetViewMode>('all');
  const [searchPhrase, setSearchPhrase] = useState('');
  const [errorColumnFilter, setErrorColumnFilter] = useState<string | null>(
    null
  );
  const [gridApi, setGridApi] = useState<GridApi | null>(null);
  const gridWrapperRef = useRef<HTMLDivElement | null>(null);

  // Debug: warn if container has zero height (grid would be invisible)
  useEffect(() => {
    if (gridWrapperRef.current && gridWrapperRef.current.clientHeight === 0) {
      // eslint-disable-next-line no-console
      console.warn('[SheetDataEditorAGGrid] El contenedor del grid tiene altura 0. Asegura que su ancestro tenga height definido.');
    }
  // eslint-disable-next-line no-console
  console.info('[SheetDataEditorAGGrid] Modo Theming API v34 activo (sin clase legacy).');
    const root = gridWrapperRef.current?.querySelector('.ag-root');
    if (root) {
      const styles = window.getComputedStyle(root);
      // eslint-disable-next-line no-console
      console.debug('[SheetDataEditorAGGrid] Root grid computed styles (extracto):', {
        fontFamily: styles.fontFamily,
        fontSize: styles.fontSize,
        backgroundColor: styles.backgroundColor
      });
    }
  }, []);

  useEffect(() => {
    setSelectedRows([]); // On changing sheets
    setViewMode('all');
  }, [sheetDefinition]);

  const rowData = useFilteredRowData(
    data,
    allData,
    viewMode,
    sheetValidationErrors,
    errorColumnFilter,
    sheetDefinition,
    searchPhrase
  );

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

  // Create column definitions for AG-Grid
  const columnDefs = useMemo<ColDef[]>(() => {
    const baseColumns: ColDef[] = availableActions.includes('removeRows')
      ? [
          {
            headerName: '',
            field: 'selection',
            checkboxSelection: true,
            headerCheckboxSelection: true,
            width: 50,
            pinned: 'left',
            lockPosition: true,
            suppressMovable: true,
            // suppressResize eliminado: usar resizable:false
            resizable: false,
            sortable: false,
            filter: false,
          },
        ]
      : [];

    const dataColumns: ColDef[] = sheetDefinition.columns.map((column) => {
      return {
        headerName: column.label,
        field: column.id,
        editable: column.type !== 'calculated',
        sortable: true,
        filter: true,
        resizable: true,
        width: 150,
        minWidth: 100,
        cellClass: (params: any) => {
          const errors = sheetValidationErrors.filter(
            (error) => 
              error.columnId === column.id && 
              error.rowIndex === params.node?.rowIndex
          );
          return errors.length > 0 ? 'ag-cell-error' : '';
        },
        cellEditor: column.type === 'number' ? 'agNumberCellEditor' : 'agTextCellEditor',
        cellEditorParams: column.type === 'number' ? { precision: 2 } : undefined,
        valueFormatter: (params: any) => {
          if (column.type === 'enum' && params.value) {
            return enumLabelDict[column.id]?.[params.value as string] || params.value;
          }
          return params.value;
        },
        tooltipValueGetter: (params: any) => {
          const errors = sheetValidationErrors.filter(
            (error) => 
              error.columnId === column.id && 
              error.rowIndex === params.node?.rowIndex
          );
          return errors.length > 0 ? errors.map(e => e.message).join(', ') : '';
        },
      };
    });

    return [...baseColumns, ...dataColumns];
  }, [sheetDefinition, sheetValidationErrors, enumLabelDict, availableActions]);

  const onGridReady = useCallback((params: GridReadyEvent) => {
    setGridApi(params.api);
  }, []);

  const onFirstDataRendered = useCallback(() => {
    // Ajuste de columnas al ancho disponible cuando haya datos o columnas
    if (gridApi) {
      try {
        gridApi.sizeColumnsToFit();
      } catch (e) {
        // eslint-disable-next-line no-console
        console.debug('sizeColumnsToFit no se pudo aplicar todavía:', e);
      }
    }
  }, [gridApi]);

  const onCellValueChanged = useCallback((event: CellValueChangedEvent) => {
    const rowIndex = event.node.rowIndex;
    const columnId = event.column.getColId();
    const newValue = event.newValue;

    if (rowIndex !== null && rowIndex !== undefined) {
      onCellValueChanged_Internal(rowIndex, columnId, newValue);
    }
  }, []);

  function onCellValueChanged_Internal(
    rowIndex: number,
    columnId: string,
    value: ImporterOutputFieldType
  ) {
    const rowValue = { ...data.rows[rowIndex] };
    rowValue[columnId] = value;

    setRowData({
      sheetId: sheetDefinition.id,
      value: rowValue,
      rowIndex,
    });
  }

  const onSelectionChanged = useCallback(() => {
    if (gridApi) {
      const selectedNodes = gridApi.getSelectedNodes();
      const selectedData = selectedNodes.map((node: any) => node.data);
      setSelectedRows(selectedData);
    }
  }, [gridApi]);

  const handleRemoveRows = useCallback((payload: RemoveRowsPayload) => {
    removeRows(payload);
    if (gridApi) {
      gridApi.deselectAll();
    }
  }, [removeRows, gridApi]);

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
          setErrorColumnFilter={setErrorColumnFilter}
          removeRows={handleRemoveRows}
          addEmptyRow={addEmptyRow}
          sheetValidationErrors={sheetValidationErrors}
          rowValidationSummary={rowValidationSummary}
          resetState={resetState}
          enumLabelDict={enumLabelDict}
        />
      </div>

    {/* Contenedor del grid: altura mínima para visibilidad. Theming aplicado sólo vía sheetGridTheme (API v34). */}
      <div
        ref={gridWrapperRef}
        className="min-h-0 flex-1 hello-csv-grid-v34"
        style={{
          // Fallback: si la cadena ascendente no define altura, esta minHeight asegura visibilidad
          minHeight: 400,
          // Si el ancestro tiene height:100% / flex growth, el 100% aquí lo aprovecha; si no, queda la minHeight
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <div style={{
            flex: '1 1 auto',
            width: '100%',
            minHeight: 0
          }}>
          <AgGridReact
            theme={sheetGridTheme}
          rowData={rowData}
          columnDefs={columnDefs}
          onGridReady={onGridReady}
          onCellValueChanged={onCellValueChanged}
          onSelectionChanged={onSelectionChanged}
          rowSelection={{ mode: 'multiRow', enableClickSelection: false }}
          defaultColDef={{
            sortable: true,
            filter: true,
            resizable: true,
            editable: false,
            minWidth: 100
          }}
          animateRows={true}
          enableBrowserTooltips={true}
          onFirstDataRendered={onFirstDataRendered}
          domLayout="normal"
          // enableRangeSelection eliminado (Enterprise); si se requiere, migrar a Enterprise bundle
        />
        </div>
      </div>
      <style dangerouslySetInnerHTML={{__html: `
        /* ERROR CELLS override scoped */
        .hello-csv-grid-v34 .ag-cell-error { background-color: #fee2e2 !important; border: 1px solid #dc2626 !important; }
        .hello-csv-grid-v34 .ag-cell-error:hover { background-color: #fecaca !important; }
        /* Inline editing height tweak (keep if needed) */
        .hello-csv-grid-v34 .ag-cell.ag-cell-inline-editing { height: 50px !important; padding: 4px !important; }
      `}} />
    </div>
  );
}
