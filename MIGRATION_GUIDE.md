# Guía de Migración - Optimización de Datos

## Para Usuarios Existentes de HelloCSV

Si ya tienes HelloCSV implementado y quieres aprovechar las nuevas optimizaciones:

## ✅ Cambios Retrocompatibles

**La optimización está habilitada por defecto** pero es completamente retrocompatible. No necesitas cambiar tu código existente.

## 🚀 Migración Simple (Recomendado)

### Antes (v0.3.x)

```typescript
<Importer
  sheets={sheets}
  onComplete={handleComplete}
/>
```

### Después (v0.4.0+)

```typescript
<Importer
  sheets={sheets}
  onComplete={handleComplete}
  // Optimización está habilitada por defecto
  // No necesitas configurar nada extra!
/>
```

## 📈 Migración con Configuración Personalizada

Si tienes datasets muy grandes y quieres más control:

```typescript
<Importer
  sheets={sheets}
  onComplete={handleComplete}
  dataOptimization={{
    removeEmptyColumns: true,
    minDataThreshold: 5, // Ajusta según tus necesidades
    showOptimizationStats: true, // Ver logs en consola
  }}
/>
```

## 🔄 Deshabilitar Optimización (No Recomendado)

Si por alguna razón necesitas deshabilitar la optimización:

```typescript
<Importer
  sheets={sheets}
  onComplete={handleComplete}
  dataOptimization={{
    removeEmptyColumns: false, // Deshabilita optimización
  }}
/>
```

## ⚡ Usar Tabla Virtualizada en Lugar de AG-Grid

Si quieres mejor performance para datasets grandes:

### Opción 1: Reemplazar AG-Grid completamente

```typescript
// Antes
import { SheetDataEditor } from '@/hello-csv/sheet';

// Después
import VirtualizedTable from '@/hello-csv/sheet/components/VirtualizedTable';
import { useOptimizedCellChange } from '@/hello-csv/importer/hooks';

function MyCustomSheetEditor() {
  const { sheetData, currentSheetId } = useImporterState();
  const handleCellChange = useOptimizedCellChange(currentSheetId);
  
  const currentSheet = sheetData.find(s => s.sheetId === currentSheetId);
  const sheetDef = sheetDefinitions.find(s => s.id === currentSheetId);

  return (
    <VirtualizedTable
      data={currentSheet.rows}
      columns={sheetDef.columns}
      onCellChange={handleCellChange}
      height={600}
      performanceMode={true}
    />
  );
}
```

### Opción 2: Usar ambos (AG-Grid + Virtualized)

Puedes tener un toggle para cambiar entre vistas:

```typescript
function SheetViewer() {
  const [useVirtualized, setUseVirtualized] = useState(false);

  return (
    <>
      <button onClick={() => setUseVirtualized(!useVirtualized)}>
        Toggle {useVirtualized ? 'AG-Grid' : 'Virtualized'} View
      </button>
      
      {useVirtualized ? (
        <VirtualizedTable {...props} />
      ) : (
        <SheetDataEditorAGGrid {...props} />
      )}
    </>
  );
}
```

## 🔍 Verificar que la Optimización Funciona

### 1. Habilitar logs

```typescript
<Importer
  sheets={sheets}
  onComplete={handleComplete}
  dataOptimization={{
    showOptimizationStats: true,
  }}
/>
```

### 2. Abrir consola del navegador

Deberías ver algo como:

```
[HelloCSV] Optimized sheet1: removed 400 empty columns (66.7% reduction)
```

### 3. Verificar en el estado

```typescript
import { useImporterState } from '@/hello-csv/importer/reducer';

function MyComponent() {
  const { optimizationStats } = useImporterState();
  
  useEffect(() => {
    if (optimizationStats) {
      console.log('Optimized!', optimizationStats);
      // {
      //   originalColumnCount: 600,
      //   optimizedColumnCount: 200,
      //   removedColumns: ['col1', 'col2', ...],
      //   memoryReductionPercent: 66.67
      // }
    }
  }, [optimizationStats]);

  return <div>...</div>;
}
```

## ⚠️ Posibles Problemas de Migración

### Problema 1: "Se eliminaron columnas que necesito"

**Causa:** La columna no tiene datos y no está marcada como requerida

**Solución:**

```typescript
// Opción A: Marcar columna como requerida
{
  id: 'important_column',
  label: 'Important Column',
  type: 'string',
  validators: [
    { validate: 'required', error: 'Required' } // Nunca se eliminará
  ],
}

// Opción B: Deshabilitar optimización para esa hoja
dataOptimization: {
  removeEmptyColumns: false,
}

// Opción C: Reducir threshold
dataOptimization: {
  minDataThreshold: 0, // Solo elimina si TODAS las filas están vacías
}
```

### Problema 2: "El performance es peor que antes"

**Causa:** Tu dataset es pequeño y la optimización agrega overhead innecesario

**Solución:**

```typescript
// Para datasets pequeños (<1000 filas), deshabilita optimización
dataOptimization: {
  removeEmptyColumns: data.length > 1000,
}
```

### Problema 3: "Columnas calculadas no funcionan"

**Causa:** Las columnas calculadas nunca se eliminan, pero podrían depender de columnas eliminadas

**Solución:**

```typescript
// Asegúrate de que las dependencias estén marcadas como requeridas
{
  id: 'dependency_column',
  label: 'Dependency',
  type: 'string',
  validators: [{ validate: 'required' }], // Nunca se eliminará
},
{
  id: 'calculated_column',
  label: 'Calculated',
  type: 'calculated',
  typeArguments: {
    getValue: (row) => row.dependency_column * 2,
  },
}
```

### Problema 4: "TypeScript muestra errores"

**Causa:** Necesitas actualizar las importaciones

**Solución:**

```typescript
// Asegúrate de importar los tipos correctos
import type {
  DataOptimizationConfig,
  OptimizationStats,
} from '@/hello-csv/importer/types';
```

## 📊 Métricas de Éxito

Después de migrar, deberías ver:

- ✅ Menor uso de memoria (verificar en DevTools > Memory)
- ✅ Carga más rápida (especialmente con muchas columnas)
- ✅ Scroll más fluido
- ✅ Menos congelamientos del navegador

### Cómo medir:

```javascript
// Antes de cargar datos
console.time('data-load');
const memoryBefore = performance.memory?.usedJSHeapSize;

// Después de cargar datos
console.timeEnd('data-load');
const memoryAfter = performance.memory?.usedJSHeapSize;
const memoryUsed = (memoryAfter - memoryBefore) / 1024 / 1024;

console.log(`Memory used: ${memoryUsed.toFixed(2)} MB`);
console.log(`Time: ${performance.getEntriesByName('data-load')[0].duration} ms`);
```

## 🆘 Soporte

Si encuentras problemas durante la migración:

1. **Revisa la consola** - Debería haber logs útiles
2. **Verifica el estado** - Usa `useImporterState()` para debug
3. **Deshabilita temporalmente** - Pon `removeEmptyColumns: false` para confirmar que es el problema
4. **Reporta el bug** - Abre un issue en GitHub con:
   - Tamaño del dataset (filas × columnas)
   - Configuración usada
   - Error o comportamiento inesperado
   - Screenshots si es posible

## 🎓 Recursos de Aprendizaje

- 📖 [Documentación Completa](./docs/DATA_OPTIMIZATION.md)
- 💡 [Ejemplos](./docs/examples/large-dataset-optimization.tsx)
- 📝 [Resumen de Optimización](./OPTIMIZATION_SUMMARY.md)
- 🔧 [Código Fuente](./src/utils/columnOptimizer.ts)

## ✅ Checklist de Migración

- [ ] Actualizar a HelloCSV v0.4.0+
- [ ] Probar con datos de producción
- [ ] Verificar que columnas requeridas están marcadas
- [ ] Habilitar `showOptimizationStats` para testing
- [ ] Medir performance antes/después
- [ ] Ajustar configuración según necesidades
- [ ] Documentar configuración usada en tu proyecto
- [ ] Entrenar al equipo sobre nuevas features

¡Listo! Tu aplicación ahora puede manejar datasets masivos sin problemas. 🎉
