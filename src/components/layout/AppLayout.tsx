import { useState } from 'react';
import type { ActiveTab } from '../../types';
import { Navigation } from './Navigation';
import { Dashboard } from '../dashboard/Dashboard';
import { FileUpload } from '../upload/FileUpload';
import { MessageGenerator } from '../whatsapp/MessageGenerator';
import { InfographicExport } from '../infographic/InfographicExport';
import { Settings } from '../settings/Settings';

function ActivePage({ tab }: { tab: ActiveTab }) {
  switch (tab) {
    case 'dashboard':
      return <Dashboard />;
    case 'upload':
      return <FileUpload />;
    case 'whatsapp':
      return <MessageGenerator />;
    case 'infographic':
      return <InfographicExport />;
    case 'settings':
      return <Settings />;
  }
}

/**
 * Root layout component.
 * Renders a header bar, the navigation, the active page content,
 * and ensures proper bottom padding on mobile for the fixed bottom nav.
 */
export function AppLayout() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header bar */}
      <header className="border-b border-gray-200 bg-white shadow-sm md:shadow-none">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-lg font-bold text-gray-900">Customer KPI Tool</h1>
          <span className="text-xs text-gray-400">v1.0</span>
        </div>
      </header>

      {/* Desktop navigation sits below the header */}
      <Navigation activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Page content with bottom padding for the mobile nav bar */}
      <main className="pb-20 md:pb-0">
        <ActivePage tab={activeTab} />
      </main>
    </div>
  );
}
