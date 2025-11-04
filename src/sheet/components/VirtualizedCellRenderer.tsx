import { memo } from 'preact/compat';
import { SheetColumnDefinition, ImporterOutputFieldType } from '@/types';

interface CellRendererProps {
  value: ImporterOutputFieldType;
  column: SheetColumnDefinition;
  rowIndex: number;
  columnIndex: number;
  onChange: (value: ImporterOutputFieldType) => void;
  hasError?: boolean;
  isReadOnly?: boolean;
}

/**
 * Optimized cell renderer with memoization to prevent unnecessary re-renders
 * Only re-renders when value, hasError, or isReadOnly changes
 */
const CellRenderer = memo<CellRendererProps>(
  ({ value, column, onChange, hasError, isReadOnly }) => {
    const isCalculated = column.type === 'calculated';
    const effectiveReadOnly = isReadOnly || isCalculated || column.isReadOnly;

    // Custom render if provided
    if (column.customRender) {
      return (
        <div className="flex h-full items-center px-2">
          {column.customRender(value, value)}
        </div>
      );
    }

    // Calculated or read-only cells
    if (effectiveReadOnly) {
      return (
        <div
          className={`flex h-full items-center px-2 ${
            isCalculated ? 'text-gray-500 italic' : ''
          } ${hasError ? 'bg-red-50 text-red-900' : ''}`}
        >
          {value?.toString() ?? ''}
        </div>
      );
    }

    // Enum type with select
    if (column.type === 'enum') {
      return (
        <select
          value={value?.toString() ?? ''}
          onChange={(e) => onChange((e.target as HTMLSelectElement).value)}
          className={`h-full w-full border-none px-2 outline-none focus:ring-2 focus:ring-blue-500 ${
            hasError ? 'bg-red-50 text-red-900' : ''
          }`}
        >
          <option value="">Select...</option>
          {column.typeArguments.values.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    }

    // Number type
    if (column.type === 'number') {
      return (
        <input
          type="number"
          value={value?.toString() ?? ''}
          onChange={(e) => {
            const val = (e.target as HTMLInputElement).value;
            onChange(val === '' ? '' : Number(val));
          }}
          className={`h-full w-full border-none px-2 outline-none focus:ring-2 focus:ring-blue-500 ${
            hasError ? 'bg-red-50 text-red-900' : ''
          }`}
        />
      );
    }

    // Default: string input
    return (
      <input
        type="text"
        value={value?.toString() ?? ''}
        onChange={(e) => onChange((e.target as HTMLInputElement).value)}
        className={`h-full w-full border-none px-2 outline-none focus:ring-2 focus:ring-blue-500 ${
          hasError ? 'bg-red-50 text-red-900' : ''
        }`}
      />
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison: only re-render if these props change
    return (
      prevProps.value === nextProps.value &&
      prevProps.hasError === nextProps.hasError &&
      prevProps.isReadOnly === nextProps.isReadOnly &&
      prevProps.column.id === nextProps.column.id
    );
  }
);

CellRenderer.displayName = 'CellRenderer';

export default CellRenderer;
