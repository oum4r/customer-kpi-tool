import { useState, useCallback, useMemo } from 'react';
import { useComputedKPIs } from '../../hooks/useComputedKPIs';
import { useAppData } from '../../hooks/useAppData';
import { generateWhatsAppMessage } from '../../engine/messageTemplate';

export function MessageGenerator() {
  const kpis = useComputedKPIs();
  const { appData } = useAppData();

  // Generate the template message from computed KPIs + settings
  const templateMessage = useMemo(() => {
    if (!kpis) return '';
    return generateWhatsAppMessage(kpis, appData.settings);
  }, [kpis, appData.settings]);

  // Editable message state — initialised from the template
  const [message, setMessage] = useState<string>(templateMessage);
  const [copied, setCopied] = useState(false);

  // Keep message in sync when templateMessage changes (e.g. new week selected)
  // We use a ref-based approach: if the template changes, reset the textarea
  // only when the user hasn't manually edited. For simplicity, we always
  // provide a "Regenerate" button to reset manually.
  const [lastTemplate, setLastTemplate] = useState<string>(templateMessage);
  if (templateMessage !== lastTemplate) {
    setLastTemplate(templateMessage);
    setMessage(templateMessage);
  }

  // ---- Handlers ----

  const handleRegenerate = useCallback(() => {
    setMessage(templateMessage);
  }, [templateMessage]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = message;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [message]);

  // ---- No data state ----

  if (!kpis) {
    return (
      <div className="space-y-4 p-4">
        <h1 className="text-xl font-bold text-gray-900">WhatsApp Message</h1>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
          <p className="text-sm text-gray-500">
            No data available — upload your first week to generate a message
          </p>
        </div>
      </div>
    );
  }

  // ---- Main render ----

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-xl font-bold text-gray-900">WhatsApp Message</h1>

      {/* WhatsApp-style message area */}
      <div
        className="rounded-2xl p-4 shadow-sm"
        style={{
          backgroundColor: '#e5ddd5',
          backgroundImage:
            'url("data:image/svg+xml,%3Csvg width=\'6\' height=\'6\' viewBox=\'0 0 6 6\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'%23c7bfb5\' fill-opacity=\'0.15\'%3E%3Cpath d=\'M5 0h1L0 5V4zM6 5v1H5z\'/%3E%3C/g%3E%3C/svg%3E")',
        }}
      >
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="w-full resize-none rounded-lg border-0 p-4 text-sm leading-relaxed text-gray-900 shadow-md focus:outline-none focus:ring-2 focus:ring-green-400"
          style={{
            backgroundColor: '#dcf8c6',
            minHeight: '400px',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
          spellCheck={false}
        />
      </div>

      {/* Action buttons */}
      <div className="flex flex-row gap-3">
        <button
          type="button"
          onClick={handleRegenerate}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300"
        >
          Regenerate
        </button>

        <button
          type="button"
          onClick={handleCopy}
          className={`rounded-lg px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors focus:outline-none focus:ring-2 ${
            copied
              ? 'bg-green-600 hover:bg-green-700 focus:ring-green-400'
              : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-400'
          }`}
        >
          {copied ? 'Copied! \u2713' : 'Copy to Clipboard'}
        </button>
      </div>
    </div>
  );
}
