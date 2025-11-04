import {
  useReducer,
  useEffect,
  Dispatch,
  useContext,
  useRef,
} from 'preact/hooks';
import { applyTransformations } from '../transformers';
import {
  CellChangedPayload,
  ImporterAction,
  ImporterState,
  PersistenceConfig,
  SheetDefinition,
  SheetRow,
} from '../types';
import { setIndexedDBState } from './storage';
import { applyValidations, validateSingleRow } from '../validators';
// Future: supply anyOf groups via context or state extension
const emptyAnyOfMap: Record<string, any[]> | undefined = undefined;
import { createContext } from 'preact';
import { ReactNode } from 'preact/compat';
import { buildInitialState, buildState } from './state';

function recalculateCalculatedColumns(
  row: SheetRow,
  payload: CellChangedPayload,
  state: ImporterState
): SheetRow {
  const sheetDefinition = state.sheetDefinitions.find(
    (s) => s.id === payload.sheetId
  );

  if (sheetDefinition == null) return row;

  const calculatedColumns = sheetDefinition.columns.filter(
    (column) => column.type === 'calculated'
  );

  // Early return if no calculated columns
  if (calculatedColumns.length === 0) return row;

  const newRow = { ...row };

  calculatedColumns.forEach((column) => {
    // Only recalculate if dependencies might have changed
    // For now, always recalculate (could be optimized with dependency tracking)
    newRow[column.id] = column.typeArguments.getValue(newRow);
  });

  return newRow;
}

export const reducer = (
  state: ImporterState,
  action: ImporterAction
): ImporterState => {
  switch (action.type) {
    case 'ENTER_DATA_MANUALLY': {
      const emptyData = state.sheetDefinitions.map((sheet) => ({
        sheetId: sheet.id,
        rows: Array.from(
          { length: action.payload.amountOfEmptyRowsToAdd },
          () => ({})
        ),
      }));

      return { ...state, mode: 'preview', sheetData: emptyData };
    }
    case 'FILE_PARSED':
      return {
        ...state,
        parsedFile: action.payload.parsed,
        rowFile: action.payload.rowFile,
        mode: 'mapping',
      };
    case 'UPLOAD':
      return { ...state, mode: 'upload' };
    case 'COLUMN_MAPPING_CHANGED': {
      return {
        ...state,
        columnMappings: action.payload.mappings,
      };
    }
    case 'DATA_MAPPED': {
      // Use optimized sheet definitions if provided (after column optimization)
      const sheetDefinitionsToUse = action.payload.sheetDefinitions ?? state.sheetDefinitions;
      
      return {
        ...state,
        sheetDefinitions: sheetDefinitionsToUse,
        sheetData: applyTransformations(
          sheetDefinitionsToUse,
          action.payload.mappedData
        ),
        mode: 'preview',
        validationErrors: applyValidations(
          sheetDefinitionsToUse,
          action.payload.mappedData,
          emptyAnyOfMap
        ),
      };
    }
    case 'CELL_CHANGED': {
      const currentData = state.sheetData;
      const { sheetId, rowIndex, value } = action.payload;

      // Only update the specific row, not the entire array
      const newData = currentData.map((sheet) => {
        if (sheet.sheetId !== sheetId) return sheet;

        const newRows = [...sheet.rows];
        const currentRow = newRows[rowIndex] || {};
        
        // Merge the changed values with existing row data
        const updatedRow = { ...currentRow, ...value };
        
        // Recalculate calculated columns for this row only
        newRows[rowIndex] = recalculateCalculatedColumns(
          updatedRow,
          action.payload,
          state
        );

        return { ...sheet, rows: newRows };
      });

      // Apply transformations and validations only to the changed sheet
      const sheetDefinition = state.sheetDefinitions.find(
        (s) => s.id === sheetId
      );

      if (sheetDefinition) {
        // Apply transformations only to the changed sheet
        const changedSheetData = newData.filter((s) => s.sheetId === sheetId);
        const transformedSheetData = applyTransformations(
          [sheetDefinition],
          changedSheetData
        );
        
        // Merge back with unchanged sheets
        const finalData = newData.map((sheet) =>
          sheet.sheetId === sheetId ? transformedSheetData[0] : sheet
        );

        // OPTIMIZED: Validate only the changed row instead of all data
        const changedSheet = finalData.find((s) => s.sheetId === sheetId);
        const changedRow = changedSheet?.rows[rowIndex];
        
        if (changedRow) {
          // Get validation errors for only this specific row
          const newRowErrors = validateSingleRow(
            sheetDefinition,
            changedRow,
            rowIndex,
            finalData
          );

          // Remove old errors for this row and add new ones
          const updatedErrors = [
            ...state.validationErrors.filter(
              (err) => !(err.sheetId === sheetId && err.rowIndex === rowIndex)
            ),
            ...newRowErrors,
          ];

          return {
            ...state,
            sheetData: finalData,
            validationErrors: updatedErrors,
          };
        }

        // Fallback: if row not found, validate all (shouldn't happen)
        return {
          ...state,
          sheetData: finalData,
          validationErrors: applyValidations(
            state.sheetDefinitions,
            finalData,
            emptyAnyOfMap
          ),
        };
      }

      return {
        ...state,
        sheetData: newData,
        validationErrors: applyValidations(
          state.sheetDefinitions,
          newData,
          emptyAnyOfMap
        ),
      };
    }

    case 'REMOVE_ROWS': {
      const newData = state.sheetData.map((sheet) => {
        if (sheet.sheetId === action.payload.sheetId) {
          return {
            ...sheet,
            rows: sheet.rows.filter(
              (row) => !action.payload.rows.includes(row)
            ),
          };
        }

        return sheet;
      });

      return {
        ...state,
        sheetData: newData,
  validationErrors: applyValidations(state.sheetDefinitions, newData, emptyAnyOfMap),
      };
    }

    case 'ADD_EMPTY_ROW': {
      const newData = state.sheetData.map((data) => {
        if (data.sheetId !== state.currentSheetId) {
          return data;
        }

        return {
          ...data,
          rows: [...data.rows, {}],
        };
      });

      return { ...state, sheetData: newData };
    }

    case 'SHEET_CHANGED':
      return { ...state, currentSheetId: action.payload.sheetId };
    case 'SUBMIT':
      return { ...state, mode: 'submit' };
    case 'PROGRESS':
      return { ...state, importProgress: action.payload.progress };
    case 'COMPLETED':
      return {
        ...state,
        mode: 'completed',
        importStatistics: action.payload.importStatistics,
      };
    case 'FAILED':
      return { ...state, mode: 'failed' };
    case 'PREVIEW':
      return { ...state, mode: 'preview' };
    case 'MAPPING':
      return { ...state, mode: 'mapping' };
    case 'RESET':
      return buildInitialState(state.sheetDefinitions);
    case 'SET_STATE':
      return action.payload.state;
    default:
      return state;
  }
};

const usePersistedReducer = (
  sheets: SheetDefinition[],
  persistenceConfig: PersistenceConfig,
  initialState?: ImporterState
): [ImporterState, (action: ImporterAction) => void] => {
  const [state, dispatch] = useReducer(
    reducer,
    initialState ?? buildInitialState(sheets)
  );

  useEffect(() => {
    const fetchState = async () => {
      const newState = await buildState(sheets, persistenceConfig);
      dispatch({ type: 'SET_STATE', payload: { state: newState } });
    };
    if (initialState == null) {
      fetchState();
    }
    // We only want to fetch the state once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (persistenceConfig.enabled) {
      setIndexedDBState(state, persistenceConfig.customKey);
    }
  }, [state, persistenceConfig]);

  return [state, dispatch];
};

const ImporterStateContext = createContext<ImporterState>({} as ImporterState);

const ImporterStateDispatchContext = createContext<Dispatch<ImporterAction>>(
  {} as Dispatch<ImporterAction>
);

export function ReducerProvider({
  sheets,
  persistenceConfig,
  initialState,
  onStateChanged,
  children,
}: {
  sheets: SheetDefinition[];
  persistenceConfig: PersistenceConfig;
  initialState?: ImporterState;
  onStateChanged?: (prev: ImporterState, next: ImporterState) => void;
  children: ReactNode;
}) {
  const [state, dispatch] = usePersistedReducer(
    sheets,
    persistenceConfig,
    initialState
  );

  const previousStateRef = useRef(state);

  useEffect(() => {
    if (previousStateRef.current !== state) {
      onStateChanged?.(previousStateRef.current, state);
      previousStateRef.current = state;
    }
  }, [state, onStateChanged]);

  return (
    <ImporterStateContext.Provider value={state}>
      <ImporterStateDispatchContext.Provider value={dispatch}>
        {children}
      </ImporterStateDispatchContext.Provider>
    </ImporterStateContext.Provider>
  );
}

export function useImporterState(): ImporterState {
  return useContext(ImporterStateContext);
}

export function useImporterStateDispatch(): Dispatch<ImporterAction> {
  return useContext(ImporterStateDispatchContext);
}
