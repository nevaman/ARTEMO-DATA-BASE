import React, { useState, useEffect } from 'react';
import { XIcon, BellIcon, ArrowLeftIcon, ArrowRightIcon } from './Icons';
import type { Announcement } from '../types';

interface AnnouncementBannerProps {
  announcements: Announcement[];
}

export const AnnouncementBanner: React.FC<AnnouncementBannerProps> = ({ announcements }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dismissedAnnouncements, setDismissedAnnouncements] = useState<string[]>([]);
  const [isVisible, setIsVisible] = useState(false);

  // Load dismissed announcements from localStorage
  useEffect(() => {
    try {
      const dismissed = localStorage.getItem('dismissedAnnouncements');
      if (dismissed) {
        setDismissedAnnouncements(JSON.parse(dismissed));
      }
    } catch (error) {
      console.error('Failed to load dismissed announcements:', error);
    }
  }, []);

  // Filter out dismissed announcements
  const visibleAnnouncements = announcements.filter(
    announcement => announcement.active && !dismissedAnnouncements.includes(announcement.id)
  );

  // Show popup after data is loaded and there are visible announcements
  useEffect(() => {
    if (visibleAnnouncements.length > 0) {
      const timer = setTimeout(() => setIsVisible(true), 500);
      return () => clearTimeout(timer);
    }
  }, [visibleAnnouncements.length]);

  if (visibleAnnouncements.length === 0 || !isVisible) {
    return null;
  }

  const currentAnnouncement = visibleAnnouncements[currentIndex];

  const handleDismiss = () => {
    try {
      const newDismissed = [...dismissedAnnouncements, currentAnnouncement.id];
      setDismissedAnnouncements(newDismissed);
      localStorage.setItem('dismissedAnnouncements', JSON.stringify(newDismissed));
      setIsVisible(false);
    } catch (error) {
      console.error('Failed to dismiss announcement:', error);
    }
  };

  const handleNext = () => {
    setCurrentIndex((prev) => {
      if (visibleAnnouncements.length === 0) return 0;
      return (prev + 1) % visibleAnnouncements.length;
    });
  };

  const handlePrevious = () => {
    setCurrentIndex((prev) => {
      if (visibleAnnouncements.length === 0) return 0;
      return (prev - 1 + visibleAnnouncements.length) % visibleAnnouncements.length;
    });
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        {/* Modal */}
        <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden border border-gray-200">
          {/* Header */}
          <div className="bg-gradient-to-r from-primary-accent to-primary-accent/90 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <BellIcon className="w-6 h-6 text-text-on-accent" />
                <h3 className="font-semibold text-lg text-text-on-accent">
                  {currentAnnouncement.title}
                </h3>
              </div>
              <button
                onClick={handleDismiss}
                className="p-1 hover:bg-text-on-accent/20 rounded-lg transition-colors"
                aria-label="Close announcement"
              >
                <XIcon className="w-5 h-5 text-text-on-accent" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            <p className="text-gray-700 leading-relaxed mb-6">
              {currentAnnouncement.content}
            </p>

            {/* Navigation */}
            {visibleAnnouncements.length > 1 && (
              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <button
                  onClick={handlePrevious}
                  className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-600 hover:text-primary-accent hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <ArrowLeftIcon className="w-4 h-4" />
                  <span>Previous</span>
                </button>

                <span className="text-sm text-gray-500 font-medium">
                  {currentIndex + 1} of {visibleAnnouncements.length}
                </span>

                <button
                  onClick={handleNext}
                  className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-600 hover:text-primary-accent hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <span>Next</span>
                  <ArrowRightIcon className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};