import { useEffect, useMemo, useCallback, useRef } from 'preact/hooks';
// IMPORTANTE: asegurar CSS estructural base del grid
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry, themeQuartz } from 'ag-grid-community';
// Import AG-Grid v34 CSS themes
import 'ag-grid-community/styles/ag-grid.min.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';
// import { sheetGridTheme } from '../theme/agGridTheme';
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
  
  // Create custom theme configuration for v34
  const customTheme = useMemo(() => {
    return themeQuartz.withParams({
      fontSize: 14,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      rowHeight: 36,
      headerHeight: 40,
      borderRadius: 4,
    });
  }, []);

  // Debug logging with more detailed info
  useEffect(() => {
    console.log('🔍 SheetDataEditorAGGridDebug - Props received:', {
      sheetDefinition: sheetDefinition ? {
        id: sheetDefinition.id,
        columns: sheetDefinition.columns?.length || 0,
        columnsDetails: sheetDefinition.columns?.map(c => ({ id: c.id, label: c.label, type: c.type })) || []
      } : 'undefined',
      dataRowsCount: data?.rows?.length || 0,
      dataRowsPreview: data?.rows?.slice(0, 2) || 'no rows',
      validationErrorsCount: sheetValidationErrors?.length || 0,
      enumLabelDict: enumLabelDict ? Object.keys(enumLabelDict) : 'undefined',
      wrapperRefCurrent: !!wrapperRef.current
    });
    
    // Check if this component is actually receiving valid data
    if (!sheetDefinition || !sheetDefinition.columns || sheetDefinition.columns.length === 0) {
      console.error('❌ CRITICAL: No sheetDefinition or columns - AG Grid cannot render');
    }
    if (!data || !data.rows || data.rows.length === 0) {
      console.error('❌ CRITICAL: No data rows - AG Grid will be empty');
    }
  }, [sheetDefinition, data, sheetValidationErrors, enumLabelDict]);

  // Simple column definitions - minimal for debugging
  const columnDefs = useMemo<ColDef[]>(() => {
    console.log('🔧 Creating column definitions...');

    if (!sheetDefinition?.columns || sheetDefinition.columns.length === 0) {
      console.error('❌ No sheet definition or columns found. Usando columnas dummy para diagnóstico.');
      return [
        { headerName: 'Dummy A', field: 'dummyA', editable: true, sortable: true, filter: true, resizable: true, width: 200 },
        { headerName: 'Dummy B', field: 'dummyB', editable: true, sortable: true, filter: true, resizable: true, width: 200 }
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
        width: 150, // Fixed width to ensure visibility
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
    console.log('🎯 Grid API available:', !!params.api);
    
    // Verify AG Grid DOM structure is properly initialized
    setTimeout(() => {
      try {
        const gridElement = wrapperRef.current?.querySelector('.ag-root');
        const gridWrapper = wrapperRef.current?.querySelector('.ag-root-wrapper');
        const agGridReact = wrapperRef.current?.querySelector('.ag-root');
        
        console.log('🔍 AG Grid DOM elements:', {
          agRoot: !!gridElement,
          agRootWrapper: !!gridWrapper,
          agTheme: !!agGridReact,
          wrapperChildren: wrapperRef.current?.children.length
        });
        
        if (gridElement) {
          const styles = getComputedStyle(gridElement as HTMLElement);
          console.log('✅ AG Grid DOM structure initialized successfully', {
            width: (gridElement as HTMLElement).clientWidth,
            height: (gridElement as HTMLElement).clientHeight,
            display: styles.display,
            visibility: styles.visibility,
            opacity: styles.opacity
          });
          
          // Try to get row and column info
          const rowCount = params.api.getDisplayedRowCount();
          console.log('📊 Grid content info:', {
            displayedRows: rowCount
          });
          
          params.api.sizeColumnsToFit();
        } else {
          console.warn('⚠️ AG Grid DOM not found after grid ready - retrying...');
          // Retry after a longer delay
          setTimeout(() => {
            const retryElement = wrapperRef.current?.querySelector('.ag-root');
            if (retryElement) {
              console.log('✅ AG Grid DOM found on retry');
              params.api.sizeColumnsToFit();
            } else {
              console.error('❌ AG Grid DOM still not found on retry - possible rendering issue');
            }
          }, 200);
        }
      } catch (e) {
        console.warn('⚠️ Grid ready check failed:', e);
      }
    }, 50); // Slightly longer delay to ensure DOM is ready
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

  // AG Grid diagnostic - only run after grid is ready and has data
  useEffect(() => {
    if (!wrapperRef.current || rowData.length === 0) return;
    
    // Use a timeout to ensure AG Grid has finished rendering
    const timeoutId = setTimeout(() => {
      const el = wrapperRef.current?.querySelector('.ag-root');
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
        console.debug('[AGGridDebug] .ag-root not found - grid may still be initializing');
      }
    }, 100); // Small delay to allow AG Grid to finish rendering

    return () => clearTimeout(timeoutId);
  }, [rowData.length]); // Only run when row data changes

  try {
    return (
      <div ref={wrapperRef} style={{ height: '600px', width: '100%', position: 'relative', border: '1px solid #ddd' }} className="hello-csv-grid-debug-v34">
        {/* Enhanced debug info */}
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
          <span>Wrapper: {wrapperRef.current ? '✅' : '❌'}</span>
          {sheetValidationErrors.length > 0 && (
            <span style={{ color: '#d32f2f', fontWeight: 'bold' }}>
              ⚠️ Hay celdas con errores (fondo rojo)
            </span>
          )}
        </div>

        {/* AG Grid with explicit height container and v34 theme */}
        <div style={{ height: '500px', width: '100%' }} className="ag-theme-quartz">
          <AgGridReact
            theme={customTheme}
            columnDefs={columnDefs}
            rowData={rowData}
            onGridReady={onGridReady}
            onCellValueChanged={onCellValueChangedHandler}
            defaultColDef={{
              sortable: true,
              filter: true,
              resizable: true,
              editable: true,
              minWidth: 100,
              width: 150,
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
              console.log('📊 First data rendered - rows:', params.api.getDisplayedRowCount());
              // Auto-resize columns en dispositivos grandes
              if (window.innerWidth > 1024) {
                params.api.sizeColumnsToFit();
              }
            }}

            // Responsive breakpoints
            onGridSizeChanged={(params) => {
              console.log('📏 Grid size changed');
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
        {/* Show overlay if there's truly no data to display */}
        {(columnDefs.length === 0 || rowData.length === 0) && (
          <div style={{
            position: 'absolute',
            top: '80px',
            left: '10px',
            right: '10px',
            bottom: '10px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'repeating-linear-gradient(45deg,#f8fafc,#f8fafc 10px,#f1f5f9 10px,#f1f5f9 20px)',
            color: '#334155',
            fontSize: 14,
            gap: 8,
            textAlign: 'center',
            borderRadius: '4px',
            border: '2px solid #e2e8f0'
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
          .hello-csv-grid-debug-v34 .ag-root-wrapper { 
            min-height: 400px; 
          }
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