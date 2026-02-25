import type { ActiveTab } from '../../types';

interface NavigationProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
}

const tabs: { id: ActiveTab; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '\u{1F4CA}' },
  { id: 'upload', label: 'Upload', icon: '\u{1F4C1}' },
  { id: 'whatsapp', label: 'WhatsApp', icon: '\u{1F4AC}' },
  { id: 'infographic', label: 'Infographic', icon: '\u{1F5BC}\uFE0F' },
  { id: 'settings', label: 'Settings', icon: '\u{2699}\uFE0F' },
];

/**
 * Responsive navigation component.
 * Mobile: fixed bottom tab bar spanning full width.
 * Desktop: horizontal nav at top with filled background for the active tab.
 */
export function Navigation({ activeTab, onTabChange }: NavigationProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white md:static md:border-b md:border-t-0">
      <div className="mx-auto flex max-w-lg justify-around md:max-w-none md:justify-start md:gap-1 md:px-4">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`
                flex flex-1 flex-col items-center gap-1 py-3 text-xs font-medium
                transition-colors
                md:flex-none md:flex-row md:gap-2 md:rounded-lg md:px-4 md:py-2 md:text-sm
                ${
                  isActive
                    ? 'text-blue-600 border-t-2 border-blue-600 md:border-t-0 md:bg-blue-50'
                    : 'text-gray-500 border-t-2 border-transparent md:border-t-0 hover:text-gray-700 hover:bg-gray-50'
                }
              `}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="text-lg md:text-base">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
