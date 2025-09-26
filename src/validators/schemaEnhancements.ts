import { SheetDefinition } from '../types';
import { ImporterValidatorDefinition, ImporterValidationError } from './types';

/**
 * Augment sheet definitions with validators derived from JSON Schema like structure
 * Supports:
 *  - schema.required (already usually mapped during blueprint, but ensure presence)
 *  - anyOf groups: if JSON schema produced anyOf arrays of object schemas each with required list
 *    we turn them into group validation: at least one of the required sets must be satisfied per row.
 */

export interface AnyOfGroup {
  groupId: string;
  requiredSets: string[][]; // each set is a list of column ids; one full set must be present
}

export interface SchemaEnhancementResult {
  anyOfGroups: AnyOfGroup[];
}

/** Extract anyOf groups from a raw schema (already flattened blueprint likely removed, but attempt). */
export function extractAnyOfGroups(rawSchema: any): AnyOfGroup[] {
  if (!rawSchema || !Array.isArray(rawSchema.anyOf)) return [];

  const groups: AnyOfGroup[] = [];
  rawSchema.anyOf.forEach((subSchema: any) => {
    if (subSchema && Array.isArray(subSchema.required)) {
      // unify into single group for now: all anyOf required arrays belong to one group
      let group = groups[0];
      if (!group) {
        group = { groupId: 'anyOfGroup_0', requiredSets: [] };
        groups.push(group);
      }
      group.requiredSets.push(subSchema.required.slice());
    }
  });
  return groups;
}

/**
 * Validate anyOf groups for given sheet rows.
 * For each row, at least one required set must be completely non-empty (not null/undefined/empty string).
 */
export function validateAnyOfGroups(
  sheet: SheetDefinition,
  rows: { [k: string]: any }[],
  groups: AnyOfGroup[]
): ImporterValidationError[] {
  const errors: ImporterValidationError[] = [];
  if (groups.length === 0) return errors;

  rows.forEach((row, rowIndex) => {
    groups.forEach(group => {
      const satisfies = group.requiredSets.some(set =>
        set.every(field => {
          const v = row[field];
          return !(v === undefined || v === null || v === '');
        })
      );
      if (!satisfies) {
        // Build message describing sets
        const setsDesc = group.requiredSets
          .map(set => `[${set.join(', ')}]`)
          .join(' OR ');
        errors.push({
          sheetId: sheet.id,
            // We attach error to first field of first set for visibility; could duplicate across all
          columnId: group.requiredSets[0][0],
          rowIndex,
          message: `Debe cumplirse al menos uno de los conjuntos de campos: ${setsDesc}`,
        });
      }
    });
  });
  return errors;
}

/**
 * Merge required arrays into column validators if blueprint didn't already add them.
 */
export function ensureRequiredValidators(
  sheet: SheetDefinition,
  rawSheetSchema?: any
): void {
  const required = rawSheetSchema?.required;
  if (!Array.isArray(required)) return;
  required.forEach((fieldId: string) => {
    const col = sheet.columns.find(c => c.id === fieldId);
    if (col) {
      const already = col.validators?.some(v => v.validate === 'required');
      if (!already) {
        col.validators = [...(col.validators || []), { validate: 'required' } as ImporterValidatorDefinition];
      }
    }
  });
}

/** Convenience to run schema based augmentations */
export function applySchemaEnhancements(
  sheetDefinitions: SheetDefinition[],
  rawSchema: any
): { anyOfGroupsBySheet: Record<string, AnyOfGroup[]> } {
  const anyOfGroups = extractAnyOfGroups(rawSchema);
  // For now we assume single sheet mapping of raw schema root
  if (sheetDefinitions.length === 1) {
    ensureRequiredValidators(sheetDefinitions[0], rawSchema);
  }
  return { anyOfGroupsBySheet: sheetDefinitions.reduce((acc, s) => { acc[s.id] = anyOfGroups; return acc; }, {} as Record<string, AnyOfGroup[]>) };
}
