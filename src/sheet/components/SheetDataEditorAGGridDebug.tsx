import { useEffect, useMemo, useCallback, useRef } from 'preact/hooks';
// IMPORTANTE: asegurar CSS estructural base del grid
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import { sheetGridTheme } from '../theme/agGridTheme';
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
  const wrapperRef = useRef<HTMLDivElement | null>(null);
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

    if (!sheetDefinition?.columns || sheetDefinition.columns.length === 0) {
      console.error('❌ No sheet definition or columns found. Usando columnas dummy para diagnóstico.');
      return [
        { headerName: 'Dummy A', field: 'dummyA', editable: true, sortable: true, filter: true, resizable: true },
        { headerName: 'Dummy B', field: 'dummyB', editable: true, sortable: true, filter: true, resizable: true }
      ];
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
      console.error('❌ No row data found. Usando filas dummy para diagnóstico.');
      return [
        { dummyA: '—', dummyB: 'Sin data (1)' },
        { dummyA: '—', dummyB: 'Sin data (2)' }
      ];
    }
    if (data.rows.length === 0) {
      console.warn('⚠️ data.rows vacío. Insertando filas dummy.');
      return [
        { dummyA: '—', dummyB: 'Vacio (1)' },
        { dummyA: '—', dummyB: 'Vacio (2)' }
      ];
    }

    console.log('✅ Row data processed:', data.rows.length, 'rows');
    return data.rows;
  }, [data]);

  const onGridReady = useCallback((params: GridReadyEvent) => {
    console.log('🎯 Grid ready event fired');
    // Re-intentar ajuste de columnas cuando se monta
    setTimeout(() => {
      try {
        params.api.sizeColumnsToFit();
      } catch (e) {
        console.warn('⚠️ sizeColumnsToFit fallo inicial', e);
      }
    }, 0);
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
  useEffect(() => {
    if (!wrapperRef.current) return;
    const el = wrapperRef.current.querySelector('.ag-root');
    if (el) {
      const cs = getComputedStyle(el as HTMLElement);
      console.debug('[AGGridDebug] root styles snippet', {
        width: (el as HTMLElement).clientWidth,
        height: (el as HTMLElement).clientHeight,
        fontFamily: cs.fontFamily,
        background: cs.backgroundColor
      });
      if ((el as HTMLElement).clientHeight === 0) {
        console.warn('[AGGridDebug] altura 0 -> probable falta de height en contenedor ancestro');
      }
    } else {
      console.warn('[AGGridDebug] .ag-root no encontrada todavía');
    }
  });

  const showEmptyOverlay = false; // ahora nunca mostramos overlay porque forzamos dummy

  try {
    return (
      <div ref={wrapperRef} style={{ height: '600px', width: '100%', position: 'relative', border: '1px solid #ddd' }} className="hello-csv-grid-debug-v34">
        {/* Wrapper sin clase legacy (ag-theme-balham) -> usando Theming API v34 únicamente */}
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
          theme={sheetGridTheme}
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
        {showEmptyOverlay && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'repeating-linear-gradient(45deg,#f8fafc,#f8fafc 10px,#f1f5f9 10px,#f1f5f9 20px)',
            color: '#334155',
            fontSize: 14,
            gap: 8,
            textAlign: 'center'
          }}>
            <strong>⚠️ Grid sin datos o columnas</strong>
            <div style={{ maxWidth: 420 }}>
              {columnDefs.length === 0 && 'No hay columnas (sheetDefinition.columns vacío o undefined). '} 
              {rowData.length === 0 && 'No hay filas para mostrar (data.rows vacío).'}
            </div>
            <code style={{ fontSize: 12, background: '#e2e8f0', padding: '2px 6px', borderRadius: 4 }}>
              sheetId: {sheetDefinition?.id || 'N/A'} | cols: {columnDefs.length} | rows: {rowData.length}
            </code>
          </div>
        )}
        <style dangerouslySetInnerHTML={{__html:`
          .hello-csv-grid-debug-v34 .ag-root-wrapper { min-height: 400px; }
          .hello-csv-grid-debug-v34 .ag-cell-inline-editing { background:#fff !important; }
        `}} />
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