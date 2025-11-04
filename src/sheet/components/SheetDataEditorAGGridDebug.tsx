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
}: Props) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const gridApiRef = useRef<any>(null);
  
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

  // Validation checks only (no verbose logging in production)
  useEffect(() => {
    if (!sheetDefinition?.columns?.length) {
      console.error('❌ No sheetDefinition or columns');
    }
    if (!data?.rows?.length) {
      console.error('❌ No data rows');
    }
  }, [sheetDefinition, data]);

  // OPTIMIZED: Column definitions WITHOUT validation errors dependency
  // Validation styling is applied via refreshCells() when errors change
  const columnDefs = useMemo<ColDef[]>(() => {
    if (!sheetDefinition?.columns || sheetDefinition.columns.length === 0) {
      console.error('❌ No sheet definition or columns found.');
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
        width: 150,
        cellEditor,
        cellEditorParams,
      };
    });

    return columns;
  }, [sheetDefinition]); // REMOVED sheetValidationErrors dependency

  // OPTIMIZED: Row data memoization using shallow comparison on data.rows reference
  const rowData = useMemo(() => {
    if (!data?.rows) return [];
    return data.rows;
  }, [data.rows]); // More specific dependency

  const onGridReady = useCallback((params: GridReadyEvent) => {
    // Store grid API reference for later use
    gridApiRef.current = params.api;
    
    // Fit columns after grid is ready
    setTimeout(() => {
      try {
        params.api.sizeColumnsToFit();
      } catch (e) {
        console.warn('⚠️ Grid ready error:', e);
      }
    }, 50);
  }, []);

  const onCellValueChangedHandler = useCallback((event: CellValueChangedEvent) => {
    const rowIndex = event.node?.rowIndex;
    const columnId = event.column?.getColId();
    const newValue = event.newValue;

    if (rowIndex !== null && rowIndex !== undefined && columnId) {
      const rowValue = { ...data.rows[rowIndex] };
      rowValue[columnId] = newValue;

      setRowData({
        sheetId: sheetDefinition.id,
        value: rowValue,
        rowIndex,
      });
    }
  }, [data, sheetDefinition, setRowData]);

  // OPTIMIZED: Refresh cells only when validation errors change (no full re-render)
  useEffect(() => {
    if (!gridApiRef.current) return;
    // Only refresh cells, not column definitions - this is much faster
    gridApiRef.current.refreshCells({ force: false });
  }, [sheetValidationErrors]);

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