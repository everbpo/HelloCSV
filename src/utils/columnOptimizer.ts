import { SheetDefinition, SheetRow, SheetColumnDefinition } from '@/types';

/**
 * Optimization utilities for reducing memory usage and improving performance
 * by filtering out unnecessary columns before processing large datasets
 */

/**
 * Checks if a column has any non-empty values across all rows
 * @param rows - Array of data rows
 * @param columnId - Column identifier to check
 * @returns true if column has at least one non-empty value
 */
export function hasColumnData(rows: SheetRow[], columnId: string): boolean {
  return rows.some((row) => {
    const value = row[columnId];
    return value !== null && value !== undefined && value !== '';
  });
}

/**
 * Checks if a column is marked as required in the schema
 * @param column - Column definition
 * @returns true if column has required validator
 */
export function isColumnRequired(column: SheetColumnDefinition): boolean {
  return column.validators?.some((validator) => validator.validate === 'required') ?? false;
}

/**
 * Analyzes columns and identifies which ones can be safely removed
 * A column can be removed if:
 * 1. It's not required AND
 * 2. It has no data in any row
 * 
 * @param sheetDefinition - Sheet schema definition
 * @param rows - Data rows to analyze
 * @returns Array of column IDs that can be removed
 */
export function identifyEmptyColumns(
  sheetDefinition: SheetDefinition,
  rows: SheetRow[]
): string[] {
  if (!rows || rows.length === 0) {
    return [];
  }

  const emptyColumns: string[] = [];

  sheetDefinition.columns.forEach((column) => {
    // Skip required columns
    if (isColumnRequired(column)) {
      return;
    }

    // Skip calculated columns (they depend on other columns)
    if (column.type === 'calculated') {
      return;
    }

    // Check if column has any data
    if (!hasColumnData(rows, column.id)) {
      emptyColumns.push(column.id);
    }
  });

  return emptyColumns;
}

/**
 * Removes specified columns from row data
 * @param rows - Data rows
 * @param columnsToRemove - Array of column IDs to remove
 * @returns New array of rows without the specified columns
 */
export function removeColumnsFromRows(
  rows: SheetRow[],
  columnsToRemove: string[]
): SheetRow[] {
  if (columnsToRemove.length === 0) {
    return rows;
  }

  return rows.map((row) => {
    const newRow: SheetRow = {};
    Object.keys(row).forEach((key) => {
      if (!columnsToRemove.includes(key)) {
        newRow[key] = row[key];
      }
    });
    return newRow;
  });
}

/**
 * Removes empty columns from sheet definition
 * @param sheetDefinition - Sheet schema definition
 * @param columnsToRemove - Array of column IDs to remove
 * @returns New sheet definition without the specified columns
 */
export function removeColumnsFromDefinition(
  sheetDefinition: SheetDefinition,
  columnsToRemove: string[]
): SheetDefinition {
  if (columnsToRemove.length === 0) {
    return sheetDefinition;
  }

  return {
    ...sheetDefinition,
    columns: sheetDefinition.columns.filter(
      (column) => !columnsToRemove.includes(column.id)
    ),
  };
}

/**
 * Optimizes sheet data by removing empty non-required columns
 * This significantly reduces memory usage for large datasets with many empty columns
 * 
 * @param sheetDefinition - Sheet schema definition
 * @param rows - Data rows
 * @param options - Optimization options
 * @returns Optimized sheet definition and rows, plus info about removed columns
 */
export function optimizeSheetData(
  sheetDefinition: SheetDefinition,
  rows: SheetRow[],
  options: {
    removeEmptyColumns?: boolean;
    minDataThreshold?: number; // Minimum % of rows that must have data (0-100)
  } = {}
): {
  sheetDefinition: SheetDefinition;
  rows: SheetRow[];
  removedColumns: string[];
  stats: {
    originalColumnCount: number;
    optimizedColumnCount: number;
    originalRowCount: number;
    memoryReductionPercent: number;
  };
} {
  const {
    removeEmptyColumns = true,
    minDataThreshold = 0, // Remove columns with 0% data by default
  } = options;

  if (!removeEmptyColumns || !rows || rows.length === 0) {
    return {
      sheetDefinition,
      rows,
      removedColumns: [],
      stats: {
        originalColumnCount: sheetDefinition.columns.length,
        optimizedColumnCount: sheetDefinition.columns.length,
        originalRowCount: rows.length,
        memoryReductionPercent: 0,
      },
    };
  }

  const originalColumnCount = sheetDefinition.columns.length;
  
  // Identify columns that can be removed
  let columnsToRemove = identifyEmptyColumns(sheetDefinition, rows);

  // Apply threshold if specified
  if (minDataThreshold > 0) {
    columnsToRemove = columnsToRemove.filter((columnId) => {
      const rowsWithData = rows.filter((row) => {
        const value = row[columnId];
        return value !== null && value !== undefined && value !== '';
      }).length;
      
      const dataPercentage = (rowsWithData / rows.length) * 100;
      return dataPercentage < minDataThreshold;
    });
  }

  // Remove columns from definition and rows
  const optimizedDefinition = removeColumnsFromDefinition(
    sheetDefinition,
    columnsToRemove
  );
  const optimizedRows = removeColumnsFromRows(rows, columnsToRemove);

  const optimizedColumnCount = optimizedDefinition.columns.length;
  const memoryReductionPercent = originalColumnCount > 0
    ? ((originalColumnCount - optimizedColumnCount) / originalColumnCount) * 100
    : 0;

  return {
    sheetDefinition: optimizedDefinition,
    rows: optimizedRows,
    removedColumns: columnsToRemove,
    stats: {
      originalColumnCount,
      optimizedColumnCount,
      originalRowCount: rows.length,
      memoryReductionPercent,
    },
  };
}

/**
 * Batch processes large datasets in chunks to prevent memory overflow
 * @param rows - All rows to process
 * @param chunkSize - Number of rows to process at once
 * @param processor - Function to process each chunk
 * @returns Promise that resolves when all chunks are processed
 */
export async function processInChunks<T>(
  rows: T[],
  chunkSize: number,
  processor: (chunk: T[], startIndex: number) => Promise<void> | void
): Promise<void> {
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    await processor(chunk, i);
    
    // Allow browser to breathe between chunks
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}
