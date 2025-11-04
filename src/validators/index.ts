import { hasData, eachWithObject } from '../utils/functional';
import { ImporterValidationError, ImporterValidatorDefinition } from './types';
import { SheetColumnDefinition, SheetDefinition, SheetState } from '../types';
import { AnyOfGroup, validateAnyOfGroups } from './schemaEnhancements';
import { Validator } from './validator_definitions/base';
import { buildValidatorFromDefinition } from './validator_definitions';
import { extractReferenceColumnPossibleValues } from '../sheet/utils';

export function fieldIsRequired(columnDefinition: SheetColumnDefinition) {
  if (columnDefinition.validators && columnDefinition.validators.length > 0) {
    const isRequired = columnDefinition.validators.find(
      (v) => v.validate === 'required'
    );
    return !!isRequired;
  }
  return false;
}

function automaticFieldValidators(
  columnDefinition: SheetColumnDefinition,
  allData: SheetState[]
): ImporterValidatorDefinition[] {
  const result: ImporterValidatorDefinition[] = [];

  if (columnDefinition.type === 'enum') {
    result.push({
      values: columnDefinition.typeArguments.values.map((v) => v.value),
      validate: 'includes',
    });
  }

  if (columnDefinition.type === 'reference') {
    const referenceData = extractReferenceColumnPossibleValues(
      columnDefinition,
      allData
    );

    result.push({
      values: referenceData,
      validate: 'includes',
    });
  }

  return result;
}

function validateSheet(
  sheetDefinition: SheetDefinition,
  sheetData: SheetState,
  allData: SheetState[]
) {
  const validationErrors: ImporterValidationError[] = [];

  const validatorsByColumnId = eachWithObject<
    SheetColumnDefinition,
    Validator[]
  >(sheetDefinition.columns, (columnDefinition, obj) => {
    obj[columnDefinition.id] = [];

    const validatorDefinitions = [
      ...(columnDefinition.validators ?? []),
      ...automaticFieldValidators(columnDefinition, allData),
    ];

    validatorDefinitions.forEach((validatorDefinition) => {
      obj[columnDefinition.id].push(
        buildValidatorFromDefinition(validatorDefinition)
      );
    });
  });

  sheetDefinition.columns.forEach((columnDefinition) => {
    sheetData.rows.forEach((row, rowIndex) => {
      if (!hasData(row)) {
        return;
      }
      if (!(columnDefinition.id in row) && !fieldIsRequired(columnDefinition)) {
        return;
      }
      const value = row[columnDefinition.id];
      const validators = validatorsByColumnId[columnDefinition.id];

      validators.forEach((v) => {
        const result = v.isValid(value, row);
        if (result != null) {
          validationErrors.push({
            sheetId: sheetDefinition.id,
            columnId: columnDefinition.id,
            rowIndex,
            message: result,
          });
        }
      });
    });
  });

  return validationErrors;
}

/**
 * Validates a single row for a specific sheet (optimized for single cell edits)
 * @param sheetDefinition The sheet definition with validation rules
 * @param row The row data to validate
 * @param rowIndex The index of the row being validated
 * @param allData All sheet states (for reference columns)
 * @returns Array of validation errors for this specific row
 */
export function validateSingleRow(
  sheetDefinition: SheetDefinition,
  row: Record<string, any>,
  rowIndex: number,
  allData: SheetState[]
): ImporterValidationError[] {
  const validationErrors: ImporterValidationError[] = [];

  if (!hasData(row)) {
    return validationErrors;
  }

  // Build validators for all columns (same as validateSheet)
  const validatorsByColumnId = eachWithObject<
    SheetColumnDefinition,
    Validator[]
  >(sheetDefinition.columns, (columnDefinition, obj) => {
    obj[columnDefinition.id] = [];

    const validatorDefinitions = [
      ...(columnDefinition.validators ?? []),
      ...automaticFieldValidators(columnDefinition, allData),
    ];

    validatorDefinitions.forEach((validatorDefinition) => {
      obj[columnDefinition.id].push(
        buildValidatorFromDefinition(validatorDefinition)
      );
    });
  });

  // Validate only this row's columns
  sheetDefinition.columns.forEach((columnDefinition) => {
    if (!(columnDefinition.id in row) && !fieldIsRequired(columnDefinition)) {
      return;
    }
    const value = row[columnDefinition.id];
    const validators = validatorsByColumnId[columnDefinition.id];

    validators.forEach((v) => {
      const result = v.isValid(value, row);
      if (result != null) {
        validationErrors.push({
          sheetId: sheetDefinition.id,
          columnId: columnDefinition.id,
          rowIndex,
          message: result,
        });
      }
    });
  });

  return validationErrors;
}

export function applyValidations(
  sheetDefinitions: SheetDefinition[],
  sheetStates: SheetState[],
  anyOfGroupsBySheet?: Record<string, AnyOfGroup[]>
) {
  const validationErrors: ImporterValidationError[] = [];

  sheetDefinitions.forEach((sheetDefinition) => {
    const sheetData = sheetStates.find(
      (state) => state.sheetId === sheetDefinition.id
    );

    if (sheetData) {
      const errors = validateSheet(sheetDefinition, sheetData, sheetStates);
      validationErrors.push(...errors);
      if (anyOfGroupsBySheet && anyOfGroupsBySheet[sheetDefinition.id]?.length) {
        validationErrors.push(
          ...validateAnyOfGroups(sheetDefinition, sheetData.rows, anyOfGroupsBySheet[sheetDefinition.id])
        );
      }
    }
  });

  return validationErrors;
}
