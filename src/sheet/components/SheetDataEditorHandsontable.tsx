import { useMemo, useCallback, useRef } from 'preact/hooks';
import { HotTable } from '@handsontable/react';
import Handsontable from 'handsontable';
import 'handsontable/dist/handsontable.full.min.css';

import type {
  SheetDefinition,
  SheetState,
  CellChangedPayload,
  ImporterValidationError,
} from '@/types';

interface Props {
  sheetDefinition: SheetDefinition;
  data: SheetState;
  sheetValidationErrors: ImporterValidationError[];
  setRowData: (payload: CellChangedPayload) => void;
}

export default function SheetDataEditorHandsontable({
  sheetDefinition,
  data,
  sheetValidationErrors,
  setRowData,
}: Props) {
  const hotTableRef = useRef<any>(null);
  
  // Build column definitions from sheet definition
  const columns = useMemo(() => {
    if (!sheetDefinition?.columns) return [];

    return sheetDefinition.columns.map((column) => {
      const colDef: Handsontable.ColumnSettings = {
        data: column.id,
        title: column.label || column.id,
        type: 'text',
      };

      // Configure column type based on definition
      if (column.type === 'number') {
        colDef.type = 'numeric';
      } else if (column.type === 'enum' && column.typeArguments?.values) {
        colDef.type = 'dropdown';
        colDef.source = column.typeArguments.values.map((v: any) =>
          typeof v === 'object' ? v.value : v
        );
      }

      return colDef;
    });
  }, [sheetDefinition]);

  // Prepare row data
  const rowData = useMemo(() => {
    if (!data?.rows) return [];
    return data.rows;
  }, [data.rows]);

  // Create error lookup map for faster access
  const errorMap = useMemo(() => {
    const map = new Map<string, ImporterValidationError>();
    sheetValidationErrors.forEach((error) => {
      const key = `${error.rowIndex}-${error.columnId}`;
      map.set(key, error);
    });
    return map;
  }, [sheetValidationErrors]);

  // OPTIMIZED: Simplified cell renderer with minimal overhead
  const cellRenderer = useCallback(function(
    this: any,
    instance: Handsontable.Core,
    td: HTMLTableCellElement,
    row: number,
    col: number,
    prop: string | number,
    value: any,
    cellProperties: Handsontable.CellProperties
  ) {
    // Use fastest default renderer
    Handsontable.renderers.TextRenderer.apply(this, [instance, td, row, col, prop, value, cellProperties] as any);

    // FAST ERROR LOOKUP: Only check if we have errors
    if (errorMap.size > 0) {
      const columnId = typeof prop === 'string' ? prop : sheetDefinition.columns[col]?.id;
      const errorKey = `${row}-${columnId}`;
      const error = errorMap.get(errorKey);

      if (error) {
        // Use CSS class instead of inline styles (faster)
        td.className = (td.className || '') + ' cell-error';
        td.title = error.message;
      }
    }

    return td;
  }, [errorMap, sheetDefinition]);

  // Handle cell changes
  const handleAfterChange = useCallback((
    changes: Handsontable.CellChange[] | null,
    source: Handsontable.ChangeSource
  ) => {
    // Ignore changes from initial load or internal operations
    if (!changes || source === 'loadData' || source === 'updateData') {
      return;
    }

    changes.forEach(([row, prop, oldValue, newValue]) => {
      if (oldValue === newValue) return;

      const rowIndex = row as number;
      const columnId = prop as string;
      
      // Get the entire row data and update the changed cell
      const rowValue = { ...data.rows[rowIndex] };
      rowValue[columnId] = newValue;

      setRowData({
        sheetId: sheetDefinition.id,
        value: rowValue,
        rowIndex,
      });
    });
  }, [data, sheetDefinition, setRowData]);

  // ULTRA PERFORMANCE: Minimal Handsontable config for 14k+ rows
  const settings: Handsontable.GridSettings = useMemo(() => ({
    data: rowData,
    columns,
    colHeaders: true,
    rowHeaders: true,
    width: '100%',
    height: '600px',
    licenseKey: 'non-commercial-and-evaluation',
    
    // CRITICAL: Virtual rendering with minimal overhead
    renderAllRows: false,
    renderAllColumns: false,
    viewportRowRenderingOffset: 10, // Further reduced to 10 rows
    viewportColumnRenderingOffset: 2, // Only 2 columns buffer
    
    // PERFORMANCE: Disable ALL non-essential features
    autoWrapRow: false,
    autoWrapCol: false,
    stretchH: 'none',
    columnSorting: false,
    filters: false,
    dropdownMenu: false,
    contextMenu: false,
    search: false,
    undo: false,
    manualColumnResize: false, // Disabled - reduces calculations
    manualRowResize: false, // Disabled - reduces calculations
    
    // CRITICAL: Disable observers and watchers
    observeChanges: false, // Don't watch for external changes
    observeDOMVisibility: false, // Don't watch DOM visibility
    
    // PERFORMANCE: Minimize validation overhead
    allowInvalid: true, // Allow invalid data without blocking
    
    // PERFORMANCE: Disable automatic table size calculations
    autoRowSize: false,
    autoColumnSize: false,
    
    // Simple cell renderer (no validation styling for now)
    cells: () => {
      return {
        renderer: cellRenderer as any,
      };
    },
    
    // Debounced change handler to batch edits
    afterChange: handleAfterChange as any,
  }), [rowData, columns, cellRenderer, handleAfterChange]);

  return (
    <div style={{ width: '100%', height: '600px', overflow: 'auto' }}>
      <style>{`
        .cell-error {
          background-color: #ffebee !important;
          color: #c62828 !important;
          border-color: #f44336 !important;
        }
      `}</style>
      <HotTable
        ref={hotTableRef}
        settings={settings}
      />
    </div>
  );
}
