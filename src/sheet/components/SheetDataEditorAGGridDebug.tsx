import { useEffect, useMemo, useCallback } from 'preact/hooks';
import { AgGridReact } from 'ag-grid-react';
import { 
  AllCommunityModule, 
  ModuleRegistry, 
  themeBalham 
} from 'ag-grid-community';
import type {
  ColDef,
  GridReadyEvent,
  CellValueChangedEvent
} from 'ag-grid-community';

import {
  SheetDefinition,
  SheetState,
  EnumLabelDict,
  CellChangedPayload,
  ImporterValidationError,
  RemoveRowsPayload,
} from '@/types';

// Register all Community features
ModuleRegistry.registerModules([AllCommunityModule]);

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

    const columns: ColDef[] = sheetDefinition.columns.map((column) => {
      // Configurar el editor según el tipo de campo
      let cellEditor = 'agTextCellEditor';
      let cellEditorParams: any = {};

      if (column.type === 'enum' && column.typeArguments?.values) {
        cellEditor = 'agSelectCellEditor';
        cellEditorParams = {
          values: column.typeArguments.values.map((v: any) =>
            typeof v === 'object' ? v.value : v
          )
        };
      }

      return {
        headerName: column.label || column.id,
        field: column.id,
        editable: true,
        sortable: true,
        filter: true,
        resizable: true,
        flex: 1, // Responsive: columnas se ajustan al ancho disponible
        minWidth: 120,
        maxWidth: 300,
        cellEditor,
        cellEditorParams,

        // Función para pintar celdas con errores de rojo
        cellStyle: (params: any) => {
          const rowIndex = params.node?.rowIndex;
          const columnId = params.colDef?.field;

          // Buscar si hay errores para esta celda específica
          const hasError = sheetValidationErrors.some(error =>
            error.rowIndex === rowIndex &&
            (error.columnId === columnId || !error.columnId)
          );

          if (hasError) {
            return {
              backgroundColor: '#ffebee',
              border: '1px solid #f44336',
              color: '#c62828'
            };
          }

          return null;
        },

        // Tooltip con información del error si existe
        tooltipValueGetter: (params: any) => {
          const rowIndex = params.node?.rowIndex;
          const columnId = params.colDef?.field;

          const error = sheetValidationErrors.find(error =>
            error.rowIndex === rowIndex &&
            (error.columnId === columnId || !error.columnId)
          );

          if (error) {
            return `❌ Error: ${error.message}`;
          }

          return params.value;
        }
      };
    });

    console.log('✅ Column definitions created:', columns.length);
    return columns;
  }, [sheetDefinition, sheetValidationErrors]);

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
      <div style={{ height: '600px', width: '100%' }}>
        <div style={{
          padding: '10px',
          backgroundColor: '#e3f2fd',
          marginBottom: '10px',
          fontSize: '12px',
          borderRadius: '4px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '10px',
          alignItems: 'center'
        }}>
          <strong>🔍 AG-Grid Debug Info:</strong>
          <span>Columnas: {columnDefs.length}</span>
          <span>Filas: {rowData.length}</span>
          <span>Errores: {sheetValidationErrors.length}</span>
          {sheetValidationErrors.length > 0 && (
            <span style={{ color: '#d32f2f', fontWeight: 'bold' }}>
              ⚠️ Hay celdas con errores (fondo rojo)
            </span>
          )}
        </div>

        <AgGridReact
          columnDefs={columnDefs}
          rowData={rowData}
          onGridReady={onGridReady}
          onCellValueChanged={onCellValueChangedHandler}
          theme={themeBalham}
          defaultColDef={{
            sortable: true,
            filter: true,
            resizable: true,
            editable: true,
            minWidth: 100,
          }}

          // Selección y edición (sintaxis moderna AG-Grid v34)
          rowSelection={{
            mode: 'multiRow',
            enableClickSelection: false
          }}

          // Animaciones y UX
          animateRows={true}
          enableBrowserTooltips={true}

          // Configuración responsive adicional
          domLayout="normal"

          // Estilos para mejor responsive
          onFirstDataRendered={(params) => {
            // Auto-resize columns en dispositivos grandes
            if (window.innerWidth > 1024) {
              params.api.sizeColumnsToFit();
            }
          }}

          // Responsive breakpoints
          onGridSizeChanged={(params) => {
            if (window.innerWidth <= 768) {
              // En móviles, usar scroll horizontal
              params.api.sizeColumnsToFit();
            } else {
              // En desktop, ajustar columnas
              params.api.sizeColumnsToFit();
            }
          }}
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