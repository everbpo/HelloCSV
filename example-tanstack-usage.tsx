import React, { useState } from 'react';
import Importer from 'hello-csv/react';
import 'hello-csv/react/index.css';

/**
 * Example: Using HelloCSV with TanStack Virtualization
 * 
 * This example shows how to use the new TanStack-powered virtualization
 * for better performance with large datasets and additional features like
 * sorting and filtering.
 */
export default function HelloCSVTanStackExample() {
  const [data, setData] = useState(null);

  // Example schema with many columns (good for testing virtualization)
  const schema = {
    type: 'object',
    properties: {
      id: { type: 'integer', minimum: 1 },
      first_name: { type: 'string', minLength: 1, maxLength: 50 },
      last_name: { type: 'string', minLength: 1, maxLength: 50 },
      email: { type: 'string', format: 'email' },
      age: { type: 'integer', minimum: 0, maximum: 150 },
      country: { type: 'string', minLength: 2 },
      active: { type: 'boolean' },
      salary: { type: 'number', minimum: 0 },
      department: { type: 'string' },
      hire_date: { type: 'string', format: 'date' },
      phone: { type: 'string' },
      address: { type: 'string' },
      city: { type: 'string' },
      state: { type: 'string' },
      zip: { type: 'string' },
      manager: { type: 'string' },
      title: { type: 'string' },
      level: { type: 'string' },
      notes: { type: 'string' },
      status: { type: 'string', enum: ['active', 'inactive', 'pending'] },
    },
    required: ['id', 'first_name', 'last_name', 'email'],
  };

  const handleComplete = (result) => {
    console.log('Import completed:', result);
    setData(result);
  };

  const handleError = (error) => {
    console.error('Import error:', error);
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">
          HelloCSV with TanStack Virtualization
        </h1>
        <p className="text-gray-600 mb-4">
          Upload a CSV file to see the new TanStack-powered table with sorting,
          filtering, and high-performance virtualization.
        </p>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <h3 className="font-semibold text-blue-900 mb-2">✨ New Features:</h3>
          <ul className="list-disc list-inside text-sm text-blue-800 space-y-1">
            <li>Click column headers to sort data</li>
            <li>Toggle between TanStack and Lite implementations</li>
            <li>Smooth scrolling with 100k+ rows</li>
            <li>Full validation error highlighting</li>
            <li>Inline cell editing (double-click any cell)</li>
          </ul>
        </div>

        {data && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
            <h3 className="font-semibold text-green-900 mb-2">
              ✅ Import Successful!
            </h3>
            <p className="text-sm text-green-800">
              Imported {data.rows?.length || 0} rows with{' '}
              {data.validationErrors?.length || 0} validation errors
            </p>
          </div>
        )}
      </div>

      <Importer
        schema={schema}
        onComplete={handleComplete}
        onError={handleError}
        // Enable TanStack virtualization (default: true)
        useTanStackVirtualization={true}
        // Optional: customize appearance
        theme={{
          primary: '#3b82f6',
          success: '#10b981',
          error: '#ef4444',
        }}
        // Optional: customize behavior
        options={{
          // Allow invalid rows to be imported
          allowInvalidSubmit: true,
          // Skip empty rows
          skipEmptyRows: true,
          // Maximum file size (in bytes)
          maxFileSize: 50 * 1024 * 1024, // 50MB
        }}
      />

      {/* Display imported data */}
      {data && (
        <div className="mt-8">
          <h2 className="text-2xl font-bold mb-4">Imported Data Preview</h2>
          <div className="bg-gray-50 rounded-lg p-4 overflow-auto max-h-96">
            <pre className="text-xs">
              {JSON.stringify(data, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

// ========================================
// Alternative: Direct component usage
// ========================================

import { SheetDataEditorVirtualized } from 'hello-csv/react';

export function DirectVirtualizedTableExample() {
  const [data, setData] = useState({
    rows: Array.from({ length: 100000 }, (_, i) => ({
      id: i + 1,
      first_name: `User${i}`,
      last_name: `Test${i}`,
      email: `user${i}@example.com`,
      age: Math.floor(Math.random() * 80) + 18,
    })),
  });

  const sheetDefinition = {
    id: 'main',
    columns: [
      { id: 'id', label: 'ID' },
      { id: 'first_name', label: 'First Name' },
      { id: 'last_name', label: 'Last Name' },
      { id: 'email', label: 'Email' },
      { id: 'age', label: 'Age' },
    ],
  };

  const handleCellChange = (payload) => {
    const newRows = [...data.rows];
    newRows[payload.rowIndex] = payload.value;
    setData({ rows: newRows });
  };

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-4">
        Direct TanStack Virtualized Table
      </h1>
      <p className="text-gray-600 mb-4">
        100,000 rows × 5 columns with smooth virtualization
      </p>

      <SheetDataEditorVirtualized
        sheetDefinition={sheetDefinition}
        data={data}
        sheetValidationErrors={[]}
        setRowData={handleCellChange}
        useTanStack={true} // Enable TanStack implementation
      />
    </div>
  );
}
