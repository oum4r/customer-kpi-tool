import { useState, useEffect, useCallback } from 'react';
import type { DatasetType } from '../../types';
import {
  REQUIRED_FIELDS,
  DATASET_LABELS,
  loadSavedMapping,
  saveMappingToStorage,
  autoDetectColumn,
} from '../../engine/columnDetection';

// ============================================================
// Props
// ============================================================

export interface ColumnMapperProps {
  detectedColumns: string[];
  datasetType: DatasetType;
  onMappingComplete: (mapping: Record<string, string>) => void;
  /** Fields to exclude from the required mapping (e.g. 'weekNumber' for PDF sources) */
  excludeFields?: string[];
}

// ============================================================
// Component
// ============================================================

export function ColumnMapper({
  detectedColumns,
  datasetType,
  onMappingComplete,
  excludeFields,
}: ColumnMapperProps) {
  const fields = REQUIRED_FIELDS[datasetType].filter(
    (f) => !excludeFields?.includes(f.key),
  );

  // Initialise mapping state — try saved mapping first, then auto-detect
  const [mapping, setMapping] = useState<Record<string, string>>(() => {
    const saved = loadSavedMapping(datasetType);
    if (saved) {
      // Validate that all saved columns still exist in the detected columns
      const allPresent = Object.values(saved).every((col) =>
        detectedColumns.includes(col),
      );
      if (allPresent) {
        return saved;
      }
    }

    // Auto-detect based on field key names
    const detected: Record<string, string> = {};
    for (const field of fields) {
      const match = autoDetectColumn(field.key, detectedColumns);
      if (match) {
        detected[field.key] = match;
      }
    }
    return detected;
  });

  const [autoApplied, setAutoApplied] = useState(false);

  // Check whether all fields are mapped
  const allMapped = fields.every(
    (f) => mapping[f.key] && detectedColumns.includes(mapping[f.key]),
  );

  // Auto-apply saved mapping on mount if all columns are present
  useEffect(() => {
    if (autoApplied) return;

    const saved = loadSavedMapping(datasetType);
    if (saved) {
      const allPresent = Object.values(saved).every((col) =>
        detectedColumns.includes(col),
      );
      if (allPresent) {
        setAutoApplied(true);
        onMappingComplete(saved);
      }
    }
  }, [datasetType, detectedColumns, onMappingComplete, autoApplied]);

  const handleFieldChange = useCallback(
    (fieldKey: string, column: string) => {
      setMapping((prev) => ({
        ...prev,
        [fieldKey]: column,
      }));
    },
    [],
  );

  const handleApply = useCallback(() => {
    saveMappingToStorage(datasetType, mapping);
    onMappingComplete(mapping);
  }, [datasetType, mapping, onMappingComplete]);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 sm:p-6">
      <h3 className="mb-1 text-lg font-semibold text-gray-900">
        Map Columns — {DATASET_LABELS[datasetType]}
      </h3>
      <p className="mb-4 text-sm text-gray-500">
        Select which column from your file corresponds to each required field.
      </p>

      <div className="space-y-3">
        {fields.map((field) => (
          <div
            key={field.key}
            className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4"
          >
            <label
              htmlFor={`map-${field.key}`}
              className="min-w-[10rem] text-sm font-medium text-gray-700"
            >
              {field.label}
              <span className="text-red-500"> *</span>
            </label>
            <select
              id={`map-${field.key}`}
              value={mapping[field.key] ?? ''}
              onChange={(e) => handleFieldChange(field.key, e.target.value)}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:w-auto sm:min-w-[14rem]"
            >
              <option value="">-- Select column --</option>
              {detectedColumns.map((col) => (
                <option key={col} value={col}>
                  {col}
                </option>
              ))}
            </select>

            {mapping[field.key] && (
              <span className="text-xs text-green-600">Mapped</span>
            )}
          </div>
        ))}
      </div>

      {!allMapped && (
        <p className="mt-3 text-xs text-amber-600">
          All required fields must be mapped before you can proceed.
        </p>
      )}

      <button
        type="button"
        disabled={!allMapped}
        onClick={handleApply}
        className="mt-4 inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Apply Mapping
      </button>
    </div>
  );
}
