import { createRoot } from 'preact/compat/client';
import { createElement } from 'preact';

import ImporterComponent from './importer';
export * from './types';

import './index.css';
import { ImporterDefinition } from './types';
import { OuterStateBuilder } from './importer/state';

// Export nombrado principal
export { ImporterComponent as Importer };

// Export por defecto para compatibilidad
export default ImporterComponent;

export function renderImporter(
  element: HTMLElement,
  props: ImporterDefinition
) {
  createRoot(element).render(createElement(ImporterComponent, props));
}

export { OuterStateBuilder as CsvImporterStateBuilder };
