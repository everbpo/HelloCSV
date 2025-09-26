// JS runtime version (no TypeScript syntax) used when imported from outside TS toolchain
// Mirrors logic in schemaEnhancements.ts

/** @typedef {{groupId:string, requiredSets:string[][]}} AnyOfGroup */

/**
 * Extract anyOf groups from raw JSON schema (simplified single-group approach)
 * @param {any} rawSchema
 * @returns {AnyOfGroup[]}
 */
export function extractAnyOfGroups(rawSchema) {
  if (!rawSchema || !Array.isArray(rawSchema.anyOf)) return [];
  const groups = [];
  rawSchema.anyOf.forEach((subSchema) => {
    if (subSchema && Array.isArray(subSchema.required)) {
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
 * Validate anyOf groups: at least one required set must be fully present per row.
 * @param {import('../types').SheetDefinition} sheet
 * @param {Array<object>} rows
 * @param {AnyOfGroup[]} groups
 * @returns {import('./types').ImporterValidationError[]}
 */
export function validateAnyOfGroups(sheet, rows, groups) {
  const errors = [];
  if (!groups || groups.length === 0) return errors;
  rows.forEach((row, rowIndex) => {
    groups.forEach(group => {
      const satisfies = group.requiredSets.some(set =>
        set.every(field => {
          const v = row[field];
          return !(v === undefined || v === null || v === '');
        })
      );
      if (!satisfies) {
        const setsDesc = group.requiredSets.map(set => `[${set.join(', ')}]`).join(' OR ');
        errors.push({
          sheetId: sheet.id,
          columnId: group.requiredSets[0][0],
          rowIndex,
            message: `Debe cumplirse al menos uno de los conjuntos de campos: ${setsDesc}`
        });
      }
    });
  });
  return errors;
}

/** Ensure required validators appended into column definitions if missing */
export function ensureRequiredValidators(sheet, rawSheetSchema) {
  const required = rawSheetSchema && rawSheetSchema.required;
  if (!Array.isArray(required)) return;
  required.forEach(fieldId => {
    const col = sheet.columns.find(c => c.id === fieldId);
    if (col) {
      const already = Array.isArray(col.validators) && col.validators.some(v => v.validate === 'required');
      if (!already) {
        col.validators = [...(col.validators || []), { validate: 'required' }];
      }
    }
  });
}

/**
 * Apply schema enhancements and produce anyOfGroupsBySheet map
 * @param {import('../types').SheetDefinition[]} sheetDefinitions
 * @param {any} rawSchema
 */
export function applySchemaEnhancements(sheetDefinitions, rawSchema) {
  const anyOfGroups = extractAnyOfGroups(rawSchema);
  if (sheetDefinitions.length === 1) {
    ensureRequiredValidators(sheetDefinitions[0], rawSchema);
  }
  return { anyOfGroupsBySheet: sheetDefinitions.reduce((acc, s) => { acc[s.id] = anyOfGroups; return acc; }, {}) };
}
