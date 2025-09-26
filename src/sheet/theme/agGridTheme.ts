// Central AG Grid v34 theming configuration for HelloCSV
// Uses the new Theming API (no legacy CSS theme classes)
import 'ag-grid-community/styles/ag-grid.css';
import { themeBalham } from 'ag-grid-community';

// NOTE: Only use supported params. If a param is ignored by AG Grid it will fallback silently.
// Keep CSS overrides minimal and scoped at component level for anything not covered by params
export const sheetGridTheme = themeBalham.withParams({
  headerHeight: 32,
  rowHeight: 30,
  headerFontWeight: 600,
  rangeSelectionBackgroundColor: '#dbeafe',
  // fontSize / fontFamily may or may not be recognized depending on AG Grid version tokens
  // They are kept to attempt native application; if not applied we fallback via scoped CSS.
  fontSize: 12,
  fontFamily: 'Roboto, Arial, Helvetica, sans-serif'
});
