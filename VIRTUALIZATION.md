# Virtualización Bidimensional en HelloCSV

## Descripción

Se ha implementado virtualización bidimensional usando `@tanstack/react-virtual` para optimizar el rendimiento al manejar grandes conjuntos de datos, especialmente con 600+ columnas.

## Componentes Principales

### 1. `VirtualizedTable.tsx`
Componente principal que implementa virtualización bidimensional (filas y columnas):
- **Virtualización de filas**: Solo renderiza filas visibles en el viewport + overscan
- **Virtualización de columnas**: Solo renderiza columnas visibles + overscan
- **Performance**: Puede manejar millones de celdas (600+ columnas × 10,000+ filas)

#### Props:
```typescript
interface VirtualizedTableProps {
  data: SheetRow[];                    // Datos de las filas
  columns: SheetColumnDefinition[];    // Definición de columnas
  onCellChange: (rowIndex, columnId, value) => void; // Handler de cambios
  validationErrors?: ImporterValidationError[];      // Errores de validación
  height?: number;                     // Altura del viewport (default: 600)
  width?: number;                      // Ancho del viewport (auto si no se especifica)
  rowHeight?: number;                  // Altura de cada fila (default: 40)
  defaultColumnWidth?: number;         // Ancho por defecto de columnas (default: 150)
}
```

### 2. `VirtualizedCellRenderer.tsx`
Componente memoizado para renderizar celdas individuales:
- **Memoización**: Solo re-renderiza cuando cambia el valor, error o estado readonly
- **Soporte de tipos**: string, number, enum, calculated, reference
- **Custom render**: Soporta funciones de renderizado personalizadas
- **Validación visual**: Muestra errores con estilos específicos

### 3. `useOptimizedCellChange` Hook
Hook personalizado para optimizar cambios de celdas:
- **Debouncing**: Agrupa cambios en ventanas de 100ms
- **Batching**: Combina múltiples cambios a la misma fila antes de dispatch
- **Reducción de re-renders**: Minimiza actualizaciones de estado

```typescript
const handleCellChange = useOptimizedCellChange(sheetId);
// Uso: handleCellChange(rowIndex, columnId, newValue)
```

### 4. Reducer Optimizado
Mejoras en `reducer.tsx`:
- **Actualizaciones granulares**: Solo actualiza la fila modificada
- **Recálculo selectivo**: Solo recalcula columnas calculadas cuando es necesario
- **Transformaciones optimizadas**: Aplica transformaciones solo al sheet modificado

## Utilidades

### `debounce.ts`
Funciones utilitarias para optimización:
- `debounce()`: Retrasa ejecución hasta que pase tiempo sin nuevas llamadas
- `throttle()`: Limita ejecución a máximo una vez por período

## Comparación de Rendimiento

### AG-Grid (Modo tradicional)
- ✅ Todas las funcionalidades (sorting, filtering, etc.)
- ❌ Rendimiento degradado con 600+ columnas
- ❌ Alto consumo de memoria
- ❌ Scroll lag con muchas columnas

### Virtualización Bidimensional (Modo optimizado)
- ✅ Excelente rendimiento con 600+ columnas
- ✅ Bajo consumo de memoria (solo renderiza celdas visibles)
- ✅ Scroll fluido sin lag
- ✅ Soporte para millones de celdas
- ⚠️ Funcionalidades limitadas (sin sorting/filtering incorporado)

## Uso

### Automático
La tabla virtualizada se activa automáticamente cuando hay más de 100 columnas.

### Manual
El usuario puede alternar entre AG-Grid y tabla virtualizada usando el toggle en la UI:

```tsx
<input
  type="checkbox"
  checked={useVirtualized}
  onChange={(e) => setUseVirtualized(e.checked)}
/>
```

## Optimizaciones Implementadas

1. **Virtualización bidimensional**: Solo renderiza ~50-100 celdas en lugar de miles
2. **Memoización de celdas**: Previene re-renders innecesarios con `memo()`
3. **Debouncing de cambios**: Agrupa cambios en ventanas de 100ms
4. **Batching de actualizaciones**: Combina múltiples cambios antes de dispatch
5. **Map de errores**: Búsqueda O(1) para errores de validación
6. **Actualizaciones granulares**: Solo actualiza datos modificados
7. **Early returns**: Evita cálculos innecesarios cuando no hay columnas calculadas

## Ejemplo de Uso Completo

```tsx
import { VirtualizedTable } from './components/VirtualizedTable';
import { useOptimizedCellChange } from './hooks';

function MySheet() {
  const handleCellChange = useOptimizedCellChange('sheet-1');
  
  return (
    <VirtualizedTable
      data={rows}
      columns={columns}
      onCellChange={handleCellChange}
      validationErrors={errors}
      height={600}
      rowHeight={40}
      defaultColumnWidth={150}
    />
  );
}
```

## Métricas de Rendimiento Esperadas

- **600 columnas × 1,000 filas** = 600,000 celdas totales
- Solo renderiza: ~15 columnas × ~15 filas = ~225 celdas (99.96% reducción)
- **Memoria**: ~10MB vs ~500MB+ con renderizado completo
- **Tiempo de carga inicial**: <100ms vs >5000ms
- **Scroll FPS**: 60 FPS consistente

## Próximas Mejoras

1. Agregar sorting virtualizado
2. Agregar filtering sin perder virtualización
3. Implementar dependency tracking para columnas calculadas
4. Agregar column resizing interactivo
5. Implementar row selection en modo virtualizado
6. Agregar keyboard navigation optimizada
