import { ReactNode, createContext, useContext, useCallback, useRef } from 'preact/compat';
import { ImporterDefinitionWithDefaults } from './types';
import { useImporterStateDispatch } from './reducer';
import { debounce } from '@/utils/debounce';
import { ImporterOutputFieldType } from '@/types';

const ServiceContext = createContext<ImporterDefinitionWithDefaults>(
  {} as ImporterDefinitionWithDefaults
);

export function ImporterDefinitionProvider({
  importerDefintion,
  children,
}: {
  importerDefintion: ImporterDefinitionWithDefaults;
  children: ReactNode;
}) {
  return (
    <ServiceContext.Provider value={importerDefintion}>
      {children}
    </ServiceContext.Provider>
  );
}

export function useImporterDefinition(): ImporterDefinitionWithDefaults {
  return useContext(ServiceContext);
}

/**
 * Optimized hook for handling cell changes with debouncing and batching
 * Reduces the number of state updates and re-renders for large datasets
 */
export function useOptimizedCellChange(sheetId: string) {
  const dispatch = useImporterStateDispatch();
  const pendingChangesRef = useRef<Map<string, { rowIndex: number; value: Record<string, ImporterOutputFieldType> }>>(
    new Map()
  );

  // Debounce flush to batch multiple changes together
  const flushChanges = useCallback(
    debounce(() => {
      const changes = Array.from(pendingChangesRef.current.entries());

      changes.forEach(([, { rowIndex, value }]) => {
        dispatch({
          type: 'CELL_CHANGED',
          payload: { sheetId, rowIndex, value },
        });
      });

      pendingChangesRef.current.clear();
    }, 100), // 100ms debounce window
    [dispatch, sheetId]
  );

  const handleCellChange = useCallback(
    (rowIndex: number, columnId: string, newValue: ImporterOutputFieldType) => {
      const key = `${rowIndex}`;

      // Get or create row change entry
      const existing = pendingChangesRef.current.get(key);
      const currentValue = existing?.value ?? {};

      // Update only the changed column
      const updatedValue = {
        ...currentValue,
        [columnId]: newValue,
      };

      pendingChangesRef.current.set(key, { rowIndex, value: updatedValue });
      flushChanges();
    },
    [flushChanges]
  );

  return handleCellChange;
}
