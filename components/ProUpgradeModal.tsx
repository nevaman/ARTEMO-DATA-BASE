import React from 'react';
import { useUIStore } from '../stores/uiStore';
import { LockIcon, XIcon } from './Icons';

export const ProUpgradeModal: React.FC = () => {
  const { showProUpgradeModal, setShowProUpgradeModal } = useUIStore();

  if (!showProUpgradeModal) {
    return null;
  }

  const handleUpgrade = () => {
    // In a real application, this would redirect to a pricing or checkout page.
    // For now, we can just log to the console and close the modal.
    console.log('Redirecting to upgrade page...');
    setShowProUpgradeModal(false);
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4"
      onClick={() => setShowProUpgradeModal(false)}
    >
      <div
        className="bg-light-bg-component dark:bg-dark-bg-component rounded-lg shadow-lg w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 relative">
          <button
            onClick={() => setShowProUpgradeModal(false)}
            className="absolute top-4 right-4 text-light-text-tertiary dark:text-dark-text-tertiary hover:text-light-text-primary dark:hover:text-dark-text-primary"
          >
            <XIcon className="w-6 h-6" />
          </button>

          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-accent-light-blue/50 dark:bg-accent-dark-blue/20 mb-4">
              <LockIcon className="h-8 w-8 text-accent-dark-blue dark:text-accent-light-blue" />
            </div>
            <h3 className="font-serif text-2xl font-bold text-light-text-primary dark:text-dark-text-primary mb-3">
              Upgrade to Pro
            </h3>
            <p className="text-light-text-secondary dark:text-dark-text-secondary mb-6">
              This is a Pro tool. Upgrade your plan to get exclusive access to this and other powerful features.
            </p>
            <button
              onClick={handleUpgrade}
              className="w-full px-4 py-3 bg-primary-accent text-text-on-accent rounded-md font-medium text-lg hover:opacity-90 transition-opacity"
            >
              Unlock Pro Tools
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};