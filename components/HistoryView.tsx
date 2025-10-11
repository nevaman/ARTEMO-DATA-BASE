import React from 'react';
import type { ChatHistoryItem } from '../types';
import { useChatHistory } from '../hooks/useChatHistory';
import { MessageSquareIcon, HistoryIcon, FolderIcon, TrashIcon } from './Icons';

interface HistoryViewProps {
  onViewChatDetail: (chatItem: ChatHistoryItem) => void;
  onResumeChatSession: (chatItem: ChatHistoryItem) => void;
}

const HistorySkeleton: React.FC = () => (
  <div className="p-4 lg:p-6 max-w-5xl mx-auto w-full animate-pulse">
    <div className="flex justify-between items-center mb-8">
      <div className="h-9 w-48 bg-light-bg-sidebar dark:bg-dark-bg-component rounded-md"></div>
      <div className="h-9 w-32 bg-light-bg-sidebar dark:bg-dark-bg-component rounded-md"></div>
    </div>
    <div className="space-y-4">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="p-5 bg-light-bg-component dark:bg-dark-bg-component border border-light-border dark:border-dark-border rounded-lg">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-6 h-6 bg-light-bg-sidebar dark:bg-dark-bg-page rounded-md flex-shrink-0 mt-1"></div>
            <div className="flex-grow min-w-0 space-y-2">
              <div className="h-6 w-1/2 bg-light-bg-sidebar dark:bg-dark-bg-page rounded-md"></div>
              <div className="h-4 w-full bg-light-bg-sidebar dark:bg-dark-bg-page rounded-md"></div>
              <div className="h-4 w-3/4 bg-light-bg-sidebar dark:bg-dark-bg-page rounded-md"></div>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-28 bg-light-bg-sidebar dark:bg-dark-bg-page rounded-md"></div>
              <div className="h-10 w-28 bg-light-bg-sidebar dark:bg-dark-bg-page rounded-md"></div>
            </div>
            <div className="h-8 w-8 bg-light-bg-sidebar dark:bg-dark-bg-page rounded-md"></div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

export const HistoryView: React.FC<HistoryViewProps> = ({ onViewChatDetail, onResumeChatSession }) => {
  const { chatHistory, loading, error, deleteChat, clearHistory } = useChatHistory();

  if (loading) {
    return <HistorySkeleton />;
  }

  if (error) {
    return (
      <div className="p-4 lg:p-6 max-w-5xl mx-auto w-full">
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <p className="text-red-600 dark:text-red-400 mb-4">Error loading history: {error}</p>
            <button 
              onClick={() => window.location.reload()} 
              className="px-4 py-2 bg-primary-accent text-text-on-accent rounded-md hover:opacity-85"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto w-full">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-3">
          <HistoryIcon className="w-6 h-6 text-primary-accent" />
          <h2 className="font-serif text-3xl font-bold text-light-text-primary dark:text-dark-text-primary">
            Chat History
          </h2>
        </div>
        {chatHistory.length > 0 && (
          <button
            onClick={clearHistory}
            className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
          >
            Clear All History
          </button>
        )}
      </div>

      {chatHistory.length > 0 ? (
        <div className="space-y-4">
          {chatHistory.map((chat) => (
            <div
              key={chat.id}
              className="p-5 bg-light-bg-component dark:bg-dark-bg-component border border-light-border dark:border-dark-border rounded-lg"
            >
              <div className="flex items-start gap-4 mb-4">
                <MessageSquareIcon className="w-6 h-6 text-primary-accent flex-shrink-0 mt-1" />
                <div className="flex-grow min-w-0">
                  <h3 className="font-serif text-lg font-bold text-light-text-primary dark:text-dark-text-primary mb-2">
                    {chat.toolTitle}
                  </h3>
                  <p className="text-light-text-secondary dark:text-dark-text-secondary mb-2 line-clamp-2">
                    "{chat.messages.find(m => m.sender === 'user')?.text || 'No messages'}"
                  </p>
                  <div className="flex items-center gap-4 text-sm text-light-text-tertiary dark:text-dark-text-tertiary">
                    <span>{new Date(chat.timestamp).toLocaleDateString()}</span>
                    <span>{chat.messages.length} messages</span>
                    {chat.projectName && (
                      <span className="flex items-center gap-1">
                        <FolderIcon className="w-3 h-3" />
                        {chat.projectName}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => onResumeChatSession(chat)}
                    className="flex items-center gap-2 px-4 py-2 bg-primary-accent text-text-on-accent rounded-md hover:opacity-85 transition-opacity font-medium"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16l2.879-2.879m0 0a3 3 0 104.243-4.242 3 3 0 00-4.243 4.242zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Continue
                  </button>
                  <button
                    onClick={() => onViewChatDetail(chat)}
                    className="flex items-center gap-2 px-4 py-2 bg-light-bg-sidebar dark:bg-dark-bg-component border border-light-border dark:border-dark-border text-light-text-primary dark:text-dark-text-primary rounded-md hover:bg-light-bg-component dark:hover:bg-dark-bg-page transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    View Details
                  </button>
                </div>
                <button
                  onClick={() => deleteChat(chat.id)}
                  className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                  aria-label="Delete chat"
                >
                  <TrashIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-light-bg-sidebar dark:bg-dark-bg-component rounded-lg border border-light-border dark:border-dark-border">
          <HistoryIcon className="w-12 h-12 text-light-text-tertiary dark:text-dark-text-tertiary mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary">No chat history yet</h3>
          <p className="text-light-text-tertiary dark:text-dark-text-tertiary mt-1">
            Start conversations with AI tools to see your history here.
          </p>
        </div>
      )}
    </div>
  );
};