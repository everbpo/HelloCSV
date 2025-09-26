import { useEffect, useMemo, useCallback } from 'preact/hooks';
import { AgGridReact } from '@ag-grid-community/react';
import { AllModules } from '@ag-grid-enterprise/all-modules';
import type { 
  ColDef, 
  GridReadyEvent, 
  CellValueChangedEvent
} from '@ag-grid-community/core';

import {
  SheetDefinition,
  SheetState,
  EnumLabelDict,
  CellChangedPayload,
  ImporterValidationError,
  RemoveRowsPayload,
} from '@/types';

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

export default function SheetDataEditorAGGridDebug({
  sheetDefinition,
  data,
  sheetValidationErrors,
  setRowData,
  enumLabelDict,
}: Props) {
  // Debug logging
  useEffect(() => {
    console.log('🔍 SheetDataEditorAGGridDebug - Props received:', {
      sheetDefinition: sheetDefinition ? {
        id: sheetDefinition.id,
        columns: sheetDefinition.columns?.length || 0
      } : 'undefined',
      dataRowsCount: data?.rows?.length || 0,
      validationErrorsCount: sheetValidationErrors?.length || 0,
      enumLabelDict: enumLabelDict ? Object.keys(enumLabelDict) : 'undefined'
    });
  }, [sheetDefinition, data, sheetValidationErrors, enumLabelDict]);

  // Simple column definitions - minimal for debugging
  const columnDefs = useMemo<ColDef[]>(() => {
    console.log('🔧 Creating column definitions...');
    
    if (!sheetDefinition?.columns) {
      console.error('❌ No sheet definition or columns found');
      return [];
    }

    const columns: ColDef[] = sheetDefinition.columns.map((column) => ({
      headerName: column.label || column.id,
      field: column.id,
      editable: true,
      sortable: true,
      filter: true,
      resizable: true,
      width: 150,
      minWidth: 100,
    }));

    console.log('✅ Column definitions created:', columns.length);
    return columns;
  }, [sheetDefinition]);

  const rowData = useMemo(() => {
    console.log('🔧 Processing row data...');
    
    if (!data?.rows) {
      console.error('❌ No row data found');
      return [];
    }

    console.log('✅ Row data processed:', data.rows.length, 'rows');
    return data.rows;
  }, [data]);

  const onGridReady = useCallback((_params: GridReadyEvent) => {
    console.log('🎯 Grid ready event fired');
    // Grid API is available if needed later
  }, []);

  const onCellValueChangedHandler = useCallback((event: CellValueChangedEvent) => {
    console.log('📝 Cell value changed:', {
      rowIndex: event.node?.rowIndex,
      columnId: event.column?.getColId(),
      oldValue: event.oldValue,
      newValue: event.newValue
    });

    const rowIndex = event.node?.rowIndex;
    const columnId = event.column?.getColId();
    const newValue = event.newValue;

    if (rowIndex !== null && rowIndex !== undefined && columnId) {
      const rowValue = { ...data.rows[rowIndex] };
      rowValue[columnId] = newValue;

      const payload: CellChangedPayload = {
        sheetId: sheetDefinition.id,
        value: rowValue,
        rowIndex,
      };

      console.log('📤 Dispatching cell change:', payload);
      setRowData(payload);
    }
  }, [data, sheetDefinition, setRowData]);

  // Error boundary for debugging
  try {
    return (
      <div style={{ height: '400px', width: '100%' }} className="ag-theme-balham">
        <div style={{ 
          padding: '10px', 
          backgroundColor: '#e3f2fd', 
          marginBottom: '10px',
          fontSize: '12px',
          borderRadius: '4px'
        }}>
          <strong>🔍 AG-Grid Debug Info:</strong><br />
          Columns: {columnDefs.length} | Rows: {rowData.length} | 
          Validation Errors: {sheetValidationErrors.length}
        </div>
        
        <AgGridReact
          modules={AllModules}
          columnDefs={columnDefs}
          rowData={rowData}
          onGridReady={onGridReady}
          onCellValueChanged={onCellValueChangedHandler}
          defaultColDef={{
            sortable: true,
            filter: true,
            resizable: true,
            editable: true,
          }}
          rowSelection="multiple"
          suppressRowClickSelection={true}
          animateRows={true}
          enableBrowserTooltips={true}
          suppressDragLeaveHidesColumns={true}
          suppressMakeColumnVisibleAfterUnGroup={true}
        />
      </div>
    );
  } catch (error) {
    console.error('❌ Error rendering AG-Grid:', error);
    return (
      <div style={{ 
        padding: '20px', 
        backgroundColor: '#ffebee', 
        border: '1px solid #f44336',
        borderRadius: '4px',
        color: '#c62828'
      }}>
        <h4>❌ AG-Grid Render Error</h4>
        <p>Error: {String(error)}</p>
        <details>
          <summary>Debug Info</summary>
          <pre>{JSON.stringify({
            hasSheetDefinition: !!sheetDefinition,
            hasData: !!data,
            hasColumns: !!sheetDefinition?.columns,
            columnsCount: sheetDefinition?.columns?.length || 0,
            rowsCount: data?.rows?.length || 0
          }, null, 2)}</pre>
        </details>
      </div>
    );
  }
}