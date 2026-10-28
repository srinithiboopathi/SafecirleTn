import React from 'react';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { LiveBackground } from './LiveBackground';
import { SOSModal } from './SOSModal';

interface AppLayoutProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  onOpenSos: () => void;
  unreadCount: number;
  userCoords: [number, number];
  isSosOpen: boolean;
  setIsSosOpen: (open: boolean) => void;
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  currentTab,
  onSelectTab,
  onOpenSos,
  unreadCount,
  userCoords,
  isSosOpen,
  setIsSosOpen,
  children
}) => {
  const isLanding = currentTab === 'landing';

  return (
    <div className="min-h-screen flex flex-col font-sans bg-[#08090b] text-[#f5f5f7] selection:bg-[#0a84ff] selection:text-white transition-colors duration-300 relative overflow-x-hidden">
      <LiveBackground />
      
      {/* Navigation Header */}
      {!isLanding && (
        <Navbar
          currentTab={currentTab}
          onSelectTab={onSelectTab}
          onOpenSos={onOpenSos}
          unreadCount={unreadCount}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 relative z-10">
        {children}
      </main>

      {/* Emergency SOS Modal */}
      <SOSModal
        isOpen={isSosOpen}
        onClose={() => setIsSosOpen(false)}
        currentCoords={userCoords}
      />
    </div>
  );
};
