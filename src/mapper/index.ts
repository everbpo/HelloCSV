import {
  CSVCell,
  CSVParsedData,
  ImporterOutputFieldType,
  ParsedFile,
  SheetColumnDefinition,
  SheetDefinition,
  SheetRow,
  ColumnMapping,
  MappedData,
} from '../types';
import { optimizeSheetData } from '../utils/columnOptimizer';

const FLOAT = /^\s*-?(\d+\.?|\.\d+|\d+\.\d+)([eE][-+]?\d+)?\s*$/;
const MAX_FLOAT = Math.pow(2, 53);
const MIN_FLOAT = -MAX_FLOAT;

export { default as HeaderMapper } from './components/HeaderMapper';

function mapAutomaticColumns(
  sheetDefinitions: SheetDefinition[],
  mappedData: MappedData,
  mapper: (
    columns: SheetColumnDefinition[],
    newRow: SheetRow,
    row: SheetRow,
    rowIndex: number
  ) => void
): MappedData {
  return mappedData.map((sheetData) => {
    const sheetDefinition = sheetDefinitions.find(
      (definition) => definition.id === sheetData.sheetId
    );

    if (sheetDefinition == null) {
      return sheetData;
    }

    const rows = sheetData.rows.map((row, rowIndex) => {
      const newRow: SheetRow = { ...row };

      mapper(sheetDefinition.columns, newRow, row, rowIndex);

      return newRow;
    });

    return {
      ...sheetData,
      rows,
    };
  });
}

function mapReferenceColumns(
  sheetDefinitions: SheetDefinition[],
  mappedData: MappedData
): MappedData {
  return mapAutomaticColumns(
    sheetDefinitions,
    mappedData,
    (columns, newRow, _, rowIndex) => {
      columns
        .filter((column) => column.type === 'reference')
        .forEach((column) => {
          const referenceSheetData = mappedData.find(
            (data) => data.sheetId === column.typeArguments.sheetId
          );

          if (referenceSheetData != null) {
            const referenceColumn = referenceSheetData.rows.map(
              (r) => r[column.typeArguments.sheetColumnId]
            );

            const referenceValue = referenceColumn[rowIndex];

            newRow[column.id] = referenceValue;
          }
        });
    }
  );
}

function mapCalculatedColumns(
  sheetDefinitions: SheetDefinition[],
  mappedData: MappedData
): MappedData {
  return mapAutomaticColumns(
    sheetDefinitions,
    mappedData,
    (columns, newRow, row) => {
      columns
        .filter((column) => column.type === 'calculated')
        .forEach((column) => {
          newRow[column.id] = column.typeArguments.getValue(row);
        });
    }
  );
}

function isFloat(value: string): boolean {
  if (FLOAT.test(value)) {
    const floatValue = parseFloat(value);
    if (floatValue > MIN_FLOAT && floatValue < MAX_FLOAT) {
      return true;
    }
  }
  return false;
}

function getCellTypedValue(
  csvColumnValue: CSVCell,
  columnDefinition: SheetColumnDefinition
): ImporterOutputFieldType {
  if (columnDefinition.type === 'number' && isFloat(csvColumnValue)) {
    return parseFloat(csvColumnValue);
  }

  return csvColumnValue;
}

/// Checks to see if CSV value doesn't match the enum label, if so converts it into enum value
function getCellValue(
  csvColumnValue: CSVCell,
  columnDefinition: SheetColumnDefinition
): ImporterOutputFieldType {
  if (columnDefinition.type === 'enum') {
    const enumDefinition = columnDefinition.typeArguments.values.find(
      (definition) => definition.label === csvColumnValue
    );

    if (enumDefinition != null) {
      return enumDefinition.value;
    }
  }

  return getCellTypedValue(csvColumnValue, columnDefinition);
}

function mapRegularColumns(
  sheetDefinitions: SheetDefinition[],
  mappings: ColumnMapping[],
  data: CSVParsedData[]
): MappedData {
  return sheetDefinitions.map((sheetDefinition) => {
    const rows: SheetRow[] = [];

    const sheetMappings = mappings.filter(
      (mapping) => mapping.sheetId === sheetDefinition.id
    );

    data.map((row) => {
      const newRow: SheetRow = {};

      sheetDefinition.columns.forEach((column) => {
        const mapping = sheetMappings.find(
          (mapping) => mapping.sheetColumnId === column.id
        );

        if (mapping != null) {
          newRow[mapping.sheetColumnId] = getCellValue(
            row[mapping.csvColumnName],
            column
          );
        }
      });

      rows.push(newRow);
    });

    return {
      sheetId: sheetDefinition.id,
      rows,
    };
  });
}

export function getMappedData(
  sheetDefinitions: SheetDefinition[],
  mappings: ColumnMapping[],
  parsedFile: ParsedFile,
  optimizationConfig?: {
    removeEmptyColumns?: boolean;
    minDataThreshold?: number;
  }
): {
  data: MappedData;
  sheetDefinitions: SheetDefinition[];
} {
  const data = parsedFile.data;

  const mappedData = mapRegularColumns(sheetDefinitions, mappings, data);

  const mappedDataWithCalculatedColumns = mapCalculatedColumns(
    sheetDefinitions,
    mappedData
  );

  const finalData = mapReferenceColumns(sheetDefinitions, mappedDataWithCalculatedColumns);

  // Apply optimization if configured
  if (optimizationConfig?.removeEmptyColumns) {
    const optimizedDefinitions: SheetDefinition[] = [];
    const optimizedData: MappedData = [];

    finalData.forEach((sheetState) => {
      const sheetDef = sheetDefinitions.find((def) => def.id === sheetState.sheetId);
      if (!sheetDef) {
        optimizedData.push(sheetState);
        return;
      }
      
      const optimized = optimizeSheetData(sheetDef, sheetState.rows, optimizationConfig);
      
      // Always log optimization stats
      // eslint-disable-next-line no-console
      console.log(
        `[HelloCSV] Optimized ${sheetState.sheetId}: removed ${optimized.removedColumns.length} empty columns (${optimized.stats.memoryReductionPercent.toFixed(1)}% reduction) - ${optimized.stats.optimizedColumnCount} of ${optimized.stats.originalColumnCount} columns remaining`
      );
      
      optimizedDefinitions.push(optimized.sheetDefinition);
      optimizedData.push({
        sheetId: sheetState.sheetId,
        rows: optimized.rows,
      });
    });

    return {
      data: optimizedData,
      sheetDefinitions: optimizedDefinitions,
    };
  }

  return {
    data: finalData,
    sheetDefinitions,
  };
}

export function allowUserToMapColumn(
  columnDefinition: SheetColumnDefinition
): boolean {
  return (
    columnDefinition.type !== 'reference' &&
    columnDefinition.type !== 'calculated'
  );
}
