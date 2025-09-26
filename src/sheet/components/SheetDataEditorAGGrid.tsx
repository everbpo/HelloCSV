import { useEffect, useMemo, useState, useCallback } from 'preact/hooks';
import { AgGridReact } from '@ag-grid-community/react';
import { AllModules } from '@ag-grid-enterprise/all-modules';
// Import types from the correct AG-Grid packages
import type { 
  ColDef, 
  GridReadyEvent, 
  CellValueChangedEvent,
  GridApi
} from '@ag-grid-community/core';

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
            suppressResize: true,
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

      <div className="min-h-0 flex-1 ag-theme-balham">
        <AgGridReact
          modules={AllModules}
          rowData={rowData}
          columnDefs={columnDefs}
          onGridReady={onGridReady}
          onCellValueChanged={onCellValueChanged}
          onSelectionChanged={onSelectionChanged}
          rowSelection="multiple"
          suppressRowClickSelection={true}
          defaultColDef={{
            sortable: true,
            filter: true,
            resizable: true,
            editable: false,
          }}
          animateRows={true}
          enableRangeSelection={true}
          suppressCellSelection={false}
          enableCellTextSelection={true}
        />
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .ag-cell-error {
          background-color: #fee2e2 !important;
          border: 1px solid #dc2626 !important;
        }
        
        .ag-cell-error:hover {
          background-color: #fecaca !important;
        }
        
        .ag-theme-balham {
          --ag-grid-size: 4px;
          --ag-list-size: 4px;
        }
        
        .ag-theme-balham .ag-header-cell-label {
          font-weight: 600;
        }
        
        .ag-theme-balham .ag-row-hover {
          background-color: #f9fafb;
        }
        
        .ag-theme-balham .ag-row-selected {
          background-color: #dbeafe !important;
        }
        
        .ag-theme-balham .ag-cell-focus {
          border: 2px solid #3b82f6 !important;
        }
      `}} />
    </div>
  );
}