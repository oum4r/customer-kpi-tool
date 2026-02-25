import { useState, useRef, useMemo, useCallback, type ChangeEvent } from 'react';
import { useAppData } from '../../hooks/useAppData';
import type { MessageTone } from '../../types';
import { stripEmployeeNumber } from '../../engine/nameUtils';
import { testConnection } from '../../engine/supabaseStorage';

/**
 * Full settings page with sections for period configuration,
 * target overrides, preferences, and data management.
 * All inputs pre-populated with current values from appData.
 */
export function Settings() {
  const {
    appData,
    updatePeriodConfig,
    updateTargets,
    updateSettings,
    resetPeriod,
    exportData,
    importData,
    isSyncing,
    lastSyncedAt,
    syncError,
    syncToCloud,
    loadFromCloud,
  } = useAppData();

  // ---- Period configuration local state ----
  const [periodName, setPeriodName] = useState(appData.period.name);
  const [startDate, setStartDate] = useState(appData.period.startDate);
  const [endDate, setEndDate] = useState(appData.period.endDate);
  const [weeksInput, setWeeksInput] = useState(appData.period.weeks.join(', '));

  // ---- Target overrides local state ----
  const [cnlTarget, setCnlTarget] = useState(appData.targets.cnlWeekly);
  const [digitalTarget, setDigitalTarget] = useState(appData.targets.digitalReceiptPercentage);
  const [oisTarget, setOisTarget] = useState(appData.targets.oisWeekly);

  // ---- Preferences ----
  const [showTrend, setShowTrend] = useState(appData.settings.showTrendIndicators);
  const [messageTone, setMessageTone] = useState<MessageTone>(appData.settings.messageTone);

  // ---- Cloud Sync local state ----
  const [storeNumberInput, setStoreNumberInput] = useState(appData.settings.storeNumber ?? '');
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connected' | 'failed'>('idle');

  const formatRelativeTime = useCallback((date: Date | string): string => {
    const diff = Date.now() - (date instanceof Date ? date.getTime() : new Date(date).getTime());
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days === 1 ? '' : 's'} ago`;
  }, []);

  const handleSaveAndConnect = async () => {
    const trimmed = storeNumberInput.trim();
    if (!trimmed) return;
    updateSettings({ ...appData.settings, storeNumber: trimmed });
    setConnectionStatus('idle');
    try {
      const ok = await testConnection();
      setConnectionStatus(ok ? 'connected' : 'failed');
    } catch {
      setConnectionStatus('failed');
    }
  };

  // ---- Management names ----
  const managementNames = appData.settings.managementNames ?? [];

  // Derive all unique display names from uploaded week data
  const allEmployeeNames = useMemo(() => {
    const nameSet = new Set<string>();
    for (const week of appData.weeks) {
      for (const p of week.digitalReceipts.byPerson) {
        nameSet.add(stripEmployeeNumber(p.name));
      }
      for (const p of week.ois.byPerson) {
        nameSet.add(stripEmployeeNumber(p.name));
      }
    }
    return [...nameSet].sort((a, b) => a.localeCompare(b));
  }, [appData.weeks]);

  const handleManagementToggle = (name: string) => {
    const current = appData.settings.managementNames ?? [];
    const updated = current.includes(name)
      ? current.filter((n) => n !== name)
      : [...current, name];
    updateSettings({ ...appData.settings, managementNames: updated });
  };

  // File input ref for import
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ---- Handlers ----

  const handleSavePeriod = () => {
    const weeks = weeksInput
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n));

    updatePeriodConfig({
      name: periodName,
      startDate,
      endDate,
      weeks,
    });
  };

  const handleSaveTargets = () => {
    updateTargets({
      cnlWeekly: cnlTarget,
      digitalReceiptPercentage: digitalTarget,
      oisWeekly: oisTarget,
    });
  };

  const handlePreferenceChange = (
    key: 'showTrendIndicators' | 'messageTone',
    value: boolean | MessageTone,
  ) => {
    if (key === 'showTrendIndicators') {
      setShowTrend(value as boolean);
      updateSettings({ ...appData.settings, showTrendIndicators: value as boolean });
    } else {
      setMessageTone(value as MessageTone);
      updateSettings({ ...appData.settings, messageTone: value as MessageTone });
    }
  };

  const handleResetPeriod = () => {
    const confirmed = window.confirm(
      'Are you sure you want to reset the current period? All uploaded week data will be cleared.',
    );
    if (confirmed) {
      resetPeriod();
    }
  };

  const handleExportData = () => {
    const json = exportData();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `kpi-data-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportData = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text === 'string') {
        try {
          importData(text);
        } catch {
          window.alert('Invalid JSON file. Please check the file and try again.');
        }
      }
    };
    reader.readAsText(file);

    // Reset the input so the same file can be re-imported
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // ---- Shared styles ----
  const sectionClass = 'rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-4';
  const labelClass = 'block text-sm font-medium text-gray-700';
  const inputClass =
    'mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';
  const btnPrimary =
    'rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors';
  const btnDanger =
    'rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors';
  const btnSecondary =
    'rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors';

  return (
    <div className="space-y-6 p-4">
      <h1 className="text-xl font-bold text-gray-900">Settings</h1>

      {/* ---- Period Configuration ---- */}
      <section className={sectionClass}>
        <h2 className="text-base font-semibold text-gray-800">Period Configuration</h2>

        <div>
          <label htmlFor="periodName" className={labelClass}>
            Period Name
          </label>
          <input
            id="periodName"
            type="text"
            className={inputClass}
            value={periodName}
            onChange={(e) => setPeriodName(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="startDate" className={labelClass}>
              Start Date
            </label>
            <input
              id="startDate"
              type="date"
              className={inputClass}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="endDate" className={labelClass}>
              End Date
            </label>
            <input
              id="endDate"
              type="date"
              className={inputClass}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label htmlFor="weeks" className={labelClass}>
            Week Numbers (comma-separated)
          </label>
          <input
            id="weeks"
            type="text"
            className={inputClass}
            placeholder="e.g. 44, 45, 46, 47"
            value={weeksInput}
            onChange={(e) => setWeeksInput(e.target.value)}
          />
        </div>

        <button type="button" className={btnPrimary} onClick={handleSavePeriod}>
          Save Period Config
        </button>
      </section>

      {/* ---- Target Overrides ---- */}
      <section className={sectionClass}>
        <h2 className="text-base font-semibold text-gray-800">Target Overrides</h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="cnlTarget" className={labelClass}>
              CNL Weekly Target (sign-ups)
            </label>
            <input
              id="cnlTarget"
              type="number"
              min={0}
              className={inputClass}
              value={cnlTarget}
              onChange={(e) => setCnlTarget(Number(e.target.value))}
            />
          </div>
          <div>
            <label htmlFor="digitalTarget" className={labelClass}>
              Digital Receipt Target (%)
            </label>
            <input
              id="digitalTarget"
              type="number"
              min={0}
              max={100}
              className={inputClass}
              value={digitalTarget}
              onChange={(e) => setDigitalTarget(Number(e.target.value))}
            />
          </div>
          <div>
            <label htmlFor="oisTarget" className={labelClass}>
              OIS Weekly Target (£)
            </label>
            <input
              id="oisTarget"
              type="number"
              min={0}
              className={inputClass}
              value={oisTarget}
              onChange={(e) => setOisTarget(Number(e.target.value))}
            />
          </div>
        </div>

        <button type="button" className={btnPrimary} onClick={handleSaveTargets}>
          Save Targets
        </button>
      </section>

      {/* ---- Preferences ---- */}
      <section className={sectionClass}>
        <h2 className="text-base font-semibold text-gray-800">Preferences</h2>

        <div className="flex items-center gap-3">
          <input
            id="trendToggle"
            type="checkbox"
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            checked={showTrend}
            onChange={(e) => handlePreferenceChange('showTrendIndicators', e.target.checked)}
          />
          <label htmlFor="trendToggle" className="text-sm text-gray-700">
            Show trend indicators on KPI cards
          </label>
        </div>

        <div>
          <label htmlFor="messageTone" className={labelClass}>
            Message Tone
          </label>
          <select
            id="messageTone"
            className={inputClass}
            value={messageTone}
            onChange={(e) =>
              handlePreferenceChange('messageTone', e.target.value as MessageTone)
            }
          >
            <option value="encouraging">Encouraging</option>
            <option value="neutral">Neutral</option>
            <option value="coaching">Coaching</option>
          </select>
        </div>
      </section>

      {/* ---- Cloud Sync ---- */}
      <section className={sectionClass}>
        <div>
          <h2 className="text-base font-semibold text-gray-800">Cloud Sync</h2>
          <p className="text-xs text-gray-500">
            Sync your data to the cloud so it persists across browsers and devices.
            Enter your store number to get started.
          </p>
        </div>

        <div>
          <label htmlFor="storeNumber" className={labelClass}>
            Store Number
          </label>
          <input
            id="storeNumber"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            className={inputClass}
            placeholder="e.g. 1234"
            value={storeNumberInput}
            onChange={(e) => {
              setStoreNumberInput(e.target.value);
              setConnectionStatus('idle');
            }}
          />
          <p className="mt-1 text-xs text-gray-400">
            Your store number identifies your data in the cloud. All devices using the same
            store number will share the same data.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className={btnPrimary} onClick={handleSaveAndConnect}>
            Save &amp; Connect
          </button>
          <button
            type="button"
            className={btnSecondary}
            disabled={isSyncing || !appData.settings.storeNumber}
            onClick={syncToCloud}
          >
            Sync Now
          </button>
          <button
            type="button"
            className={btnSecondary}
            disabled={isSyncing || !appData.settings.storeNumber}
            onClick={loadFromCloud}
          >
            Load from Cloud
          </button>

          {connectionStatus === 'connected' && (
            <span className="text-sm font-medium text-green-600">Connected &#x2713;</span>
          )}
          {connectionStatus === 'failed' && (
            <span className="text-sm font-medium text-red-600">Failed &#x2717;</span>
          )}
        </div>

        {/* Status display */}
        <div className="space-y-1">
          {isSyncing && (
            <p className="text-sm text-blue-600 animate-pulse">Syncing...</p>
          )}
          {syncError && (
            <p className="text-sm text-red-600">{syncError}</p>
          )}
          {!isSyncing && lastSyncedAt && (
            <p className="text-xs text-gray-500">
              Last synced: {formatRelativeTime(lastSyncedAt)}
            </p>
          )}
          {!isSyncing && !lastSyncedAt && !syncError && !appData.settings.storeNumber && (
            <p className="text-xs text-gray-400">Not connected</p>
          )}
        </div>
      </section>

      {/* ---- Management ---- */}
      <section className={sectionClass}>
        <h2 className="text-base font-semibold text-gray-800">Management</h2>
        <p className="text-xs text-gray-500">
          Tick management names — they'll still appear on leaderboards but won't be ranked or
          eligible for KPI Hero.
        </p>

        {allEmployeeNames.length === 0 ? (
          <p className="text-sm text-gray-400">Upload data to see available names.</p>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {allEmployeeNames.map((name) => (
              <div key={name} className="flex items-center gap-2">
                <input
                  id={`mgmt-${name}`}
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  checked={managementNames.includes(name)}
                  onChange={() => handleManagementToggle(name)}
                />
                <label htmlFor={`mgmt-${name}`} className="text-sm text-gray-700">
                  {name}
                </label>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ---- Data Management ---- */}
      <section className={sectionClass}>
        <h2 className="text-base font-semibold text-gray-800">Data Management</h2>

        <div className="flex flex-wrap gap-3">
          <button type="button" className={btnDanger} onClick={handleResetPeriod}>
            Reset Period
          </button>

          <button type="button" className={btnSecondary} onClick={handleExportData}>
            Export Data
          </button>

          <label className={`${btnSecondary} cursor-pointer`}>
            Import Data
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleImportData}
            />
          </label>
        </div>

        <p className="text-xs text-gray-400">
          Resetting the period will clear all uploaded week data. Export your data first if you want
          to keep a backup.
        </p>
      </section>
    </div>
  );
}
