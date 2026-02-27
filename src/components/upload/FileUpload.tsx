import { useState, useRef, useCallback } from 'react';
import type { DatasetType, ParsedRow, WeekData } from '../../types';
import { parseCSV } from '../../parsers/csvParser';
import { parseExcel, getSheetNames } from '../../parsers/excelParser';
import { ColumnMapper } from './ColumnMapper';
import { CnlQuickEntry } from './CnlQuickEntry';
import { useAppData } from '../../hooks/useAppData';
import { detectDatasetType, resolveMapping, saveMappingToStorage, DATASET_LABELS } from '../../engine/columnDetection';

// ============================================================
// Constants
// ============================================================

const ACCEPTED_EXTENSIONS = ['.csv', '.xlsx', '.xls', '.pdf'];
const ACCEPT_STRING = '.csv,.xlsx,.xls,.pdf';

const DATASET_OPTIONS: { value: DatasetType; label: string }[] = [
  { value: 'digitalReceipts', label: 'Digital Receipts' },
  { value: 'ois', label: 'OIS (Order in Store)' },
];

// ============================================================
// Helpers
// ============================================================

function getFileExtension(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot >= 0 ? fileName.slice(dot).toLowerCase() : '';
}

function isExcelFile(ext: string): boolean {
  return ext === '.xlsx' || ext === '.xls';
}

/**
 * Scan parsed rows for an embedded week number in metadata / filter text.
 * Looks for the YYYYWW pattern (e.g. "202547") in any cell value.
 * Returns the extracted 2-digit week number, or null if not found.
 */
function extractWeekFromRows(rows: ParsedRow[]): number | null {
  // Scan from the end — metadata rows are typically at the bottom
  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i];
    for (const val of Object.values(row)) {
      const str = String(val);
      // Match "YYYYWW (Week)" pattern from PowerBI filter text
      const weekParenMatch = str.match(/(\d{4})(\d{2})\s*\(Week\)/i);
      if (weekParenMatch) {
        return parseInt(weekParenMatch[2], 10);
      }
      // Also match "Last Week YYYYWW" or "Current Week YYYYWW" from PDF-style headers
      const pdfWeekMatch = str.match(/(?:Last|Current)\s+Week\s+(\d{4,6})/i);
      if (pdfWeekMatch) {
        return parseInt(pdfWeekMatch[1].slice(-2), 10);
      }
    }
  }
  return null;
}

/**
 * Remove non-data rows from parsed Excel/CSV output:
 * - Rows where any cell contains "Applied filters" (PowerBI metadata)
 * - Rows where ANY cell value is exactly "Total" (hierarchical summary rows)
 * - Empty rows
 * Returns the cleaned rows.
 */
function stripNonDataRows(rows: ParsedRow[]): ParsedRow[] {
  return rows.filter((row) => {
    const values = Object.values(row).map((v) => String(v).trim());
    // Skip metadata rows containing "Applied filters"
    if (values.some((v) => /Applied\s+filters/i.test(v))) return false;
    // Skip summary/total rows — PowerBI exports have hierarchical Total rows
    // where "Total" can appear in any column (Employee, Store, Territory, Division)
    if (values.some((v) => /^Total$/i.test(v))) return false;
    // Skip empty rows
    if (values.every((v) => v === '' || v === '0')) return false;
    return true;
  });
}

/**
 * Extract a 4-digit store number from parsed rows.
 * Checks:
 * 1. A "Store" / "Store Number" column in data rows
 * 2. "Applied filters" metadata rows that reference a store
 */
function extractStoreFromRows(rows: ParsedRow[]): string | null {
  // 1. Check for a "Store" column
  for (const row of rows) {
    const storeVal = row['Store'] ?? row['store'] ?? row['Store Number'];
    if (storeVal != null) {
      const str = String(storeVal).trim();
      const match = str.match(/^(\d{4})/);
      if (match) return match[1];
    }
  }

  // 2. Check "Applied filters" metadata rows
  for (const row of rows) {
    for (const val of Object.values(row)) {
      const str = String(val);
      if (/Applied\s+filters/i.test(str)) {
        const storeMatch = str.match(/Store\s+is\s+(\d{4})/i);
        if (storeMatch) return storeMatch[1];
        const numMatch = str.match(/\b(\d{4})\b/);
        if (numMatch) return numMatch[1];
      }
    }
  }

  return null;
}

/**
 * Transform parsed rows + column mapping into a WeekData object.
 * Rows are grouped by weekNumber. Returns an array of WeekData (one per unique week).
 */
function transformToWeekData(
  rows: ParsedRow[],
  mapping: Record<string, string>,
  datasetType: DatasetType,
): WeekData[] {
  // Group rows by week number
  const byWeek = new Map<number, ParsedRow[]>();

  for (const row of rows) {
    const rawWeek = row[mapping['weekNumber']];
    const weekNum = typeof rawWeek === 'number' ? rawWeek : parseInt(String(rawWeek), 10);
    if (isNaN(weekNum)) continue;

    if (!byWeek.has(weekNum)) {
      byWeek.set(weekNum, []);
    }
    byWeek.get(weekNum)!.push(row);
  }

  const results: WeekData[] = [];

  for (const [weekNumber, weekRows] of byWeek) {
    const weekData: WeekData = {
      weekNumber,
      cnl: { signUps: 0 },
      digitalReceipts: { byPerson: [] },
      ois: { byPerson: [] },
    };

    if (datasetType === 'digitalReceipts') {
      weekData.digitalReceipts.byPerson = weekRows.map((row) => {
        const rawCaptured = row[mapping['captured']];
        const rawTotal = row[mapping['totalTransactions']];
        return {
          name: String(row[mapping['name']] ?? ''),
          captured: typeof rawCaptured === 'number' ? rawCaptured : parseInt(String(rawCaptured), 10) || 0,
          totalTransactions: typeof rawTotal === 'number' ? rawTotal : parseInt(String(rawTotal), 10) || 0,
        };
      });
    }

    if (datasetType === 'ois') {
      weekData.ois.byPerson = weekRows.map((row) => {
        const rawRevenue = row[mapping['revenue']];
        return {
          name: String(row[mapping['name']] ?? ''),
          revenue: typeof rawRevenue === 'number' ? rawRevenue : parseFloat(String(rawRevenue)) || 0,
        };
      });
    }

    results.push(weekData);
  }

  return results;
}

// ============================================================
// Component
// ============================================================

type UploadStep = 'upload' | 'selectSheet' | 'selectType' | 'enterWeekNumber' | 'mapColumns' | 'done';

/** Tracks which steps were auto-detected for the success screen */
interface AutoDetectInfo {
  datasetType: boolean;
  weekNumber: boolean;
  columnMapping: boolean;
}

export function FileUpload() {
  const { appData, addWeekData } = useAppData();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Flow state
  const [step, setStep] = useState<UploadStep>('upload');
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // File state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [detectedColumns, setDetectedColumns] = useState<string[]>([]);

  // Excel sheet selection
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');

  // Dataset type selection
  const [datasetType, setDatasetType] = useState<DatasetType>('digitalReceipts');

  // Week number state (used for all file types when no week column exists)
  const [detectedWeekNumber, setDetectedWeekNumber] = useState<number | null>(null);
  const [userWeekNumber, setUserWeekNumber] = useState<number | ''>('');

  // Success info
  const [savedWeeks, setSavedWeeks] = useState<number[]>([]);
  const [autoDetected, setAutoDetected] = useState<AutoDetectInfo>({
    datasetType: false,
    weekNumber: false,
    columnMapping: false,
  });
  const [showDetails, setShowDetails] = useState(false);

  // Track which steps were skipped for step indicator
  const [skippedSteps, setSkippedSteps] = useState<Set<UploadStep>>(new Set());

  // ----------------------------------------------------------
  // Shared save logic (used by both fast-path and manual path)
  // ----------------------------------------------------------

  const saveData = useCallback(
    (
      rows: ParsedRow[],
      mapping: Record<string, string>,
      type: DatasetType,
      weekNum: number,
    ): boolean => {
      try {
        const weekCol = '__injectedWeekNumber';
        const rowsToTransform = rows.map((row) => ({ ...row, [weekCol]: weekNum }));
        const mappingToUse = { ...mapping, weekNumber: weekCol };

        const weekDataArray = transformToWeekData(rowsToTransform, mappingToUse, type);

        if (weekDataArray.length === 0) {
          setError('No valid week data could be extracted. Check that the week number is correct.');
          return false;
        }

        for (const weekData of weekDataArray) {
          addWeekData(weekData);
        }

        setSavedWeeks(weekDataArray.map((w) => w.weekNumber));
        setError(null);
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to save data.';
        setError(message);
        return false;
      }
    },
    [addWeekData],
  );

  // ----------------------------------------------------------
  // File handling
  // ----------------------------------------------------------

  const resetState = useCallback(() => {
    setStep('upload');
    setError(null);
    setSelectedFile(null);
    setParsedRows([]);
    setDetectedColumns([]);
    setSheetNames([]);
    setSelectedSheet('');
    setSavedWeeks([]);
    setDetectedWeekNumber(null);
    setUserWeekNumber('');
    setAutoDetected({ datasetType: false, weekNumber: false, columnMapping: false });
    setShowDetails(false);
    setSkippedSteps(new Set());
  }, []);

  const processFile = useCallback(async (file: File, sheet?: string) => {
    setError(null);
    const ext = getFileExtension(file.name);

    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      setError(`Unsupported file type "${ext}". Please upload a .csv, .xlsx, .xls, or .pdf file.`);
      return;
    }

    try {
      let rows: ParsedRow[];
      let weekFromFile: number | null = null;

      let fileStoreNumber: string | null = null;

      if (ext === '.pdf') {
        const { parsePdf } = await import('../../parsers/pdfParser');
        const result = await parsePdf(file);
        rows = result.rows;
        weekFromFile = result.detectedWeekNumber;
        fileStoreNumber = result.detectedStoreNumber;
      } else if (ext === '.csv') {
        rows = await parseCSV(file);
      } else {
        rows = await parseExcel(file, sheet);
      }

      if (rows.length === 0) {
        setError('The file appears to be empty. No data rows were found.');
        return;
      }

      // For non-PDF files, extract store number before stripping metadata rows
      if (!fileStoreNumber && ext !== '.pdf') {
        fileStoreNumber = extractStoreFromRows(rows);
      }

      // Validate file store number against configured store number
      const configuredStore = appData.settings.storeNumber;
      if (fileStoreNumber && configuredStore && fileStoreNumber !== configuredStore) {
        const proceed = window.confirm(
          `This file appears to be for store ${fileStoreNumber}, but you're connected as store ${configuredStore}.\n\nSave anyway?`,
        );
        if (!proceed) {
          setError(`Upload cancelled — file is for store ${fileStoreNumber}, not ${configuredStore}.`);
          return;
        }
      }

      // For non-PDF files, try to extract week number from metadata rows
      if (!weekFromFile && ext !== '.pdf') {
        weekFromFile = extractWeekFromRows(rows);
      }

      // Strip metadata and total rows from the data
      if (ext !== '.pdf') {
        rows = stripNonDataRows(rows);
      }

      if (rows.length === 0) {
        setError('No data rows found after removing metadata and summary rows.');
        return;
      }

      // Store the detected week number
      setDetectedWeekNumber(weekFromFile);
      if (weekFromFile) {
        setUserWeekNumber(weekFromFile);
      }

      // Extract column headers from the first row
      const columns = Object.keys(rows[0]);
      setParsedRows(rows);
      setDetectedColumns(columns);

      // ========================================================
      // FAST-PATH: attempt to auto-detect everything
      // ========================================================

      const skipped = new Set<UploadStep>();
      const autoInfo: AutoDetectInfo = { datasetType: false, weekNumber: false, columnMapping: false };

      // Step 1: Determine dataset type
      let resolvedType: DatasetType | null = null;
      if (ext === '.pdf') {
        resolvedType = 'ois';
        autoInfo.datasetType = true;
        skipped.add('selectType');
      } else {
        resolvedType = detectDatasetType(columns);
        if (resolvedType) {
          autoInfo.datasetType = true;
          skipped.add('selectType');
        }
      }

      if (!resolvedType) {
        // Can't determine type — fall back to manual selection
        setSkippedSteps(skipped);
        setStep('selectType');
        return;
      }

      setDatasetType(resolvedType);

      // Step 2: Determine week number
      if (!weekFromFile) {
        // Can't determine week — fall back to manual entry
        setSkippedSteps(skipped);
        setStep('enterWeekNumber');
        return;
      }

      autoInfo.weekNumber = true;
      skipped.add('enterWeekNumber');

      // Step 3: Resolve column mapping
      const mapping = resolveMapping(resolvedType, columns);
      if (!mapping) {
        // Can't resolve all columns — fall back to manual mapping
        setSkippedSteps(skipped);
        setStep('mapColumns');
        return;
      }

      autoInfo.columnMapping = true;
      skipped.add('mapColumns');

      // All three resolved — save directly!
      saveMappingToStorage(resolvedType, mapping);
      setAutoDetected(autoInfo);
      setSkippedSteps(skipped);

      const success = saveData(rows, mapping, resolvedType, weekFromFile);
      if (success) {
        setStep('done');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred while parsing the file.';
      setError(message);
    }
  }, [saveData, appData.settings.storeNumber]);

  const handleFile = useCallback(
    async (file: File) => {
      setSelectedFile(file);
      setError(null);

      const ext = getFileExtension(file.name);

      if (isExcelFile(ext)) {
        try {
          const sheets = await getSheetNames(file);
          if (sheets.length > 1) {
            setSheetNames(sheets);
            setSelectedSheet(sheets[0]);
            setStep('selectSheet');
            return;
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to read Excel file.';
          setError(message);
          return;
        }
      }

      await processFile(file);
    },
    [processFile],
  );

  // ----------------------------------------------------------
  // Drag & drop
  // ----------------------------------------------------------

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file) {
        void handleFile(file);
      }
    },
    [handleFile],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        void handleFile(file);
      }
      // Reset input so re-uploading the same file triggers onChange
      e.target.value = '';
    },
    [handleFile],
  );

  // ----------------------------------------------------------
  // Sheet selection (Excel)
  // ----------------------------------------------------------

  const handleSheetConfirm = useCallback(async () => {
    if (!selectedFile) return;
    await processFile(selectedFile, selectedSheet);
  }, [selectedFile, selectedSheet, processFile]);

  // ----------------------------------------------------------
  // Dataset type selection → then enter week number
  // ----------------------------------------------------------

  const handleTypeConfirm = useCallback(() => {
    // After manual type selection, check if we can skip further steps
    if (detectedWeekNumber) {
      // Week was detected — try to resolve mapping too
      const mapping = resolveMapping(datasetType, detectedColumns);
      if (mapping) {
        saveMappingToStorage(datasetType, mapping);
        setAutoDetected((prev) => ({ ...prev, weekNumber: true, columnMapping: true }));
        setSkippedSteps((prev) => new Set([...prev, 'enterWeekNumber', 'mapColumns']));
        const success = saveData(parsedRows, mapping, datasetType, detectedWeekNumber);
        if (success) {
          setStep('done');
          return;
        }
      }
      // Mapping failed but week was detected — skip to mapping
      setSkippedSteps((prev) => new Set([...prev, 'enterWeekNumber']));
      setAutoDetected((prev) => ({ ...prev, weekNumber: true }));
      setStep('mapColumns');
    } else {
      setStep('enterWeekNumber');
    }
  }, [datasetType, detectedWeekNumber, detectedColumns, parsedRows, saveData]);

  // ----------------------------------------------------------
  // Week number confirmation
  // ----------------------------------------------------------

  const handleWeekNumberConfirm = useCallback(() => {
    if (!userWeekNumber) return;
    // After manual week entry, try to resolve mapping
    const mapping = resolveMapping(datasetType, detectedColumns);
    if (mapping) {
      saveMappingToStorage(datasetType, mapping);
      setAutoDetected((prev) => ({ ...prev, columnMapping: true }));
      setSkippedSteps((prev) => new Set([...prev, 'mapColumns']));
      const success = saveData(parsedRows, mapping, datasetType, userWeekNumber as number);
      if (success) {
        setStep('done');
        return;
      }
    }
    setStep('mapColumns');
  }, [userWeekNumber, datasetType, detectedColumns, parsedRows, saveData]);

  // ----------------------------------------------------------
  // Column mapping complete
  // ----------------------------------------------------------

  const handleMappingComplete = useCallback(
    (mapping: Record<string, string>) => {
      const weekNum = userWeekNumber as number;
      const success = saveData(parsedRows, mapping, datasetType, weekNum);
      if (success) {
        setStep('done');
      }
    },
    [parsedRows, datasetType, saveData, userWeekNumber],
  );

  // ----------------------------------------------------------
  // Render
  // ----------------------------------------------------------

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4">
      <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Upload Data</h1>

      {/* CNL Quick Entry section */}
      <CnlQuickEntry />

      {/* Divider between CNL and file upload */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-gray-50 px-3 text-sm text-gray-500">File Upload</span>
        </div>
      </div>

      {/* Progress indicator */}
      <StepIndicator current={step} skippedSteps={skippedSteps} />

      {/* Error banner */}
      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-800">{error}</p>
        </div>
      )}

      {/* ---- Step: Upload ---- */}
      {step === 'upload' && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
            isDragging
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 bg-gray-50 hover:border-gray-400'
          }`}
        >
          <svg
            className="mb-3 h-10 w-10 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.338-2.32 3.75 3.75 0 013.837 5.592A3 3 0 0118 19.5H6.75z"
            />
          </svg>
          <p className="mb-1 text-sm font-medium text-gray-700">
            Drag and drop your file here
          </p>
          <p className="mb-4 text-xs text-gray-500">
            Supports .csv, .xlsx, .xls, and .pdf files
          </p>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Choose File
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT_STRING}
            onChange={handleInputChange}
            className="hidden"
          />
        </div>
      )}

      {/* ---- Step: Select Sheet (Excel multi-sheet) ---- */}
      {step === 'selectSheet' && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 sm:p-6">
          <h3 className="mb-1 text-lg font-semibold text-gray-900">
            Select Sheet
          </h3>
          <p className="mb-3 text-sm text-gray-500">
            This workbook contains multiple sheets. Choose which one to import.
          </p>
          <select
            value={selectedSheet}
            onChange={(e) => setSelectedSheet(e.target.value)}
            className="mb-4 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {sheetNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void handleSheetConfirm()}
              className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Continue
            </button>
            <button
              type="button"
              onClick={resetState}
              className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ---- Step: Select Dataset Type ---- */}
      {step === 'selectType' && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Choose Dataset Type
              </h3>
              <p className="text-sm text-gray-500">
                {parsedRows.length} row{parsedRows.length !== 1 ? 's' : ''} parsed
                {selectedFile ? ` from ${selectedFile.name}` : ''}
              </p>
            </div>
          </div>

          <div className="mb-4 space-y-2">
            {DATASET_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex cursor-pointer items-center gap-3 rounded-md border p-3 transition-colors ${
                  datasetType === opt.value
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <input
                  type="radio"
                  name="datasetType"
                  value={opt.value}
                  checked={datasetType === opt.value}
                  onChange={() => setDatasetType(opt.value)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">{opt.label}</span>
              </label>
            ))}
          </div>

          <p className="mb-4 text-xs text-gray-500">
            Detected columns: {detectedColumns.join(', ')}
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleTypeConfirm}
              className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Continue
            </button>
            <button
              type="button"
              onClick={resetState}
              className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Start Over
            </button>
          </div>
        </div>
      )}

      {/* ---- Step: Enter Week Number ---- */}
      {step === 'enterWeekNumber' && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 sm:p-6">
          <h3 className="mb-1 text-lg font-semibold text-gray-900">
            Confirm Week Number
          </h3>
          <p className="mb-3 text-sm text-gray-500">
            {detectedWeekNumber
              ? `Week ${detectedWeekNumber} was detected from the file. Confirm or change it below.`
              : 'No week number was detected. Please enter it manually.'}
          </p>
          <div className="mb-4">
            <label htmlFor="file-week" className="mb-1 block text-sm font-medium text-gray-700">
              Week Number
            </label>
            <input
              id="file-week"
              type="number"
              min={1}
              max={52}
              value={userWeekNumber}
              onChange={(e) => setUserWeekNumber(e.target.value ? parseInt(e.target.value, 10) : '')}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:w-40"
              placeholder="e.g. 47"
            />
          </div>
          <p className="mb-4 text-xs text-gray-500">
            {parsedRows.length} row{parsedRows.length !== 1 ? 's' : ''} parsed
            {selectedFile ? ` from ${selectedFile.name}` : ''}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleWeekNumberConfirm}
              disabled={!userWeekNumber}
              className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Continue
            </button>
            <button
              type="button"
              onClick={resetState}
              className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Start Over
            </button>
          </div>
        </div>
      )}

      {/* ---- Step: Column Mapping ---- */}
      {step === 'mapColumns' && (
        <div className="space-y-4">
          <div className="text-sm text-gray-500">
            {parsedRows.length} row{parsedRows.length !== 1 ? 's' : ''} parsed
            {selectedFile ? ` from ${selectedFile.name}` : ''}
          </div>

          <ColumnMapper
            detectedColumns={detectedColumns}
            datasetType={datasetType}
            onMappingComplete={handleMappingComplete}
          />

          <button
            type="button"
            onClick={resetState}
            className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Start Over
          </button>
        </div>
      )}

      {/* ---- Step: Done ---- */}
      {step === 'done' && (
        <div className="rounded-lg border border-green-300 bg-green-50 p-4 sm:p-6">
          <div className="flex items-start gap-3">
            <svg
              className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <h3 className="text-lg font-semibold text-green-800">
                Data Saved Successfully
              </h3>
              <p className="mt-1 text-sm text-green-700">
                {parsedRows.length} row{parsedRows.length !== 1 ? 's' : ''} imported
                for week{savedWeeks.length !== 1 ? 's' : ''}{' '}
                {savedWeeks.sort((a, b) => a - b).join(', ')}.
              </p>

              {/* Auto-detection summary */}
              {(autoDetected.datasetType || autoDetected.weekNumber || autoDetected.columnMapping) && (
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => setShowDetails(!showDetails)}
                    className="text-xs font-medium text-green-700 underline hover:text-green-900"
                  >
                    {showDetails ? 'Hide details' : 'Show details'}
                  </button>
                  {showDetails && (
                    <ul className="mt-1 space-y-0.5 text-xs text-green-700">
                      {autoDetected.datasetType && (
                        <li>Dataset type auto-detected: {DATASET_LABELS[datasetType]}</li>
                      )}
                      {autoDetected.weekNumber && (
                        <li>Week number auto-detected: {savedWeeks[0]}</li>
                      )}
                      {autoDetected.columnMapping && (
                        <li>Column mapping auto-applied (saved for next time)</li>
                      )}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={resetState}
              className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Upload Another File
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Step progress indicator
// ============================================================

const STEP_LABELS: Record<UploadStep, string> = {
  upload: 'Upload File',
  selectSheet: 'Select Sheet',
  selectType: 'Dataset Type',
  enterWeekNumber: 'Week Number',
  mapColumns: 'Map Columns',
  done: 'Complete',
};

const STEP_ORDER: UploadStep[] = ['upload', 'selectType', 'enterWeekNumber', 'mapColumns', 'done'];

function StepIndicator({ current, skippedSteps }: { current: UploadStep; skippedSteps: Set<UploadStep> }) {
  // selectSheet is a sub-step of upload, so map it
  const effectiveCurrent = current === 'selectSheet' ? 'upload' : current;
  const currentIdx = STEP_ORDER.indexOf(effectiveCurrent);

  return (
    <nav aria-label="Upload progress" className="mb-2">
      <ol className="flex items-center gap-2 text-xs sm:text-sm">
        {STEP_ORDER.map((step, idx) => {
          const isComplete = idx < currentIdx;
          const isCurrent = idx === currentIdx;
          const wasSkipped = skippedSteps.has(step);

          return (
            <li key={step} className="flex items-center gap-1">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                  isComplete
                    ? 'bg-green-600 text-white'
                    : isCurrent
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-500'
                }`}
              >
                {isComplete ? '\u2713' : idx + 1}
              </span>
              <span
                className={`hidden sm:inline ${
                  isCurrent ? 'font-medium text-gray-900' : 'text-gray-500'
                }`}
              >
                {STEP_LABELS[step]}
                {wasSkipped && isComplete && (
                  <span className="ml-1 text-xs text-green-600">(auto)</span>
                )}
              </span>
              {idx < STEP_ORDER.length - 1 && (
                <span className="mx-1 text-gray-300">/</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
