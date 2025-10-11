import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useChatHistory } from '../hooks/useChatHistory';
import type { ChatHistoryItem } from '../types';
import { SearchIcon, MessageSquareIcon, XIcon, ArrowRightIcon, FolderIcon } from './Icons';

interface ChatSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectChat: (chatItem: ChatHistoryItem) => void;
  onResumeChat: (chatItem: ChatHistoryItem) => void;
}

const ChatSearchResult: React.FC<{
  chat: ChatHistoryItem;
  searchTerm: string;
  onView: () => void;
  onResume: () => void;
}> = ({ chat, searchTerm, onView, onResume }) => {
  // Get the first user message for preview
  const firstUserMessage = chat.messages.find(m => m.sender === 'user')?.text || '';
  const firstAiMessage = chat.messages.find(m => m.sender === 'ai')?.text || '';
  
  // Highlight search term in text
  const highlightText = (text: string, term: string) => {
    if (!term.trim()) return text;
    
    const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => 
      regex.test(part) ? (
        <mark key={index} className="bg-yellow-200 dark:bg-yellow-800/50 text-light-text-primary dark:text-dark-text-primary">
          {part}
        </mark>
      ) : part
    );
  };

  return (
    <div className="p-4 border-b border-light-border dark:border-dark-border last:border-b-0">
      <div className="flex items-start gap-3">
        <MessageSquareIcon className="w-5 h-5 text-primary-accent flex-shrink-0 mt-1" />
        <div className="flex-grow min-w-0 mb-3">
          <div className="flex items-center gap-2 mb-2">
            <h4 className="font-medium text-light-text-primary dark:text-dark-text-primary truncate">
              {highlightText(chat.toolTitle, searchTerm)}
            </h4>
            {chat.projectName && (
              <span className="flex items-center gap-1 text-xs text-primary-accent bg-primary-accent/10 px-2 py-1 rounded-full">
                <FolderIcon className="w-3 h-3" />
                {chat.projectName}
              </span>
            )}
          </div>
          
          {firstUserMessage && (
            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-1 line-clamp-2">
              <span className="font-medium">You:</span> {highlightText(firstUserMessage.substring(0, 100), searchTerm)}
              {firstUserMessage.length > 100 && '...'}
            </p>
          )}
          
          {firstAiMessage && (
            <p className="text-sm text-light-text-tertiary dark:text-dark-text-tertiary mb-2 line-clamp-2">
              <span className="font-medium">AI:</span> {highlightText(firstAiMessage.substring(0, 100), searchTerm)}
              {firstAiMessage.length > 100 && '...'}
            </p>
          )}
          
          <div className="flex items-center gap-4 text-xs text-light-text-tertiary dark:text-dark-text-tertiary">
            <span>{new Date(chat.timestamp).toLocaleDateString()}</span>
            <span>{chat.messages.length} messages</span>
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-3 ml-8">
        <button
          onClick={onResume}
          className="flex items-center gap-2 px-3 py-1.5 bg-primary-accent text-text-on-accent rounded-md hover:opacity-85 transition-opacity text-sm font-medium"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16l2.879-2.879m0 0a3 3 0 104.243-4.242 3 3 0 00-4.243 4.242zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Continue
        </button>
        <button
          onClick={onView}
          className="flex items-center gap-2 px-3 py-1.5 bg-light-bg-sidebar dark:bg-dark-bg-component border border-light-border dark:border-dark-border text-light-text-primary dark:text-dark-text-primary rounded-md hover:bg-light-bg-component dark:hover:bg-dark-bg-page transition-colors text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          View
        </button>
      </div>
    </div>
  );
};

export const ChatSearchModal: React.FC<ChatSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectChat,
  onResumeChat
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  const { chatHistory, loading } = useChatHistory();

  // Focus search input when modal opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Clear search when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
    }
  }, [isOpen]);

  // Filter and search chat history
  const filteredChats = useMemo(() => {
    if (!searchTerm.trim()) {
      return chatHistory.slice(0, 20); // Show recent 20 chats when no search term
    }

    const searchLower = searchTerm.toLowerCase();
    
    return chatHistory.filter(chat => {
      // Search in tool title
      if (chat.toolTitle.toLowerCase().includes(searchLower)) {
        return true;
      }
      
      // Search in project name
      if (chat.projectName?.toLowerCase().includes(searchLower)) {
        return true;
      }
      
      // Search in message content
      return chat.messages.some(message => 
        message.text.toLowerCase().includes(searchLower)
      );
    }).slice(0, 50); // Limit to 50 results for performance
  }, [chatHistory, searchTerm]);

  // Handle search input changes with debouncing
  useEffect(() => {
    if (searchTerm.trim()) {
      setIsSearching(true);
      const timer = setTimeout(() => {
        setIsSearching(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [searchTerm]);


  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter' && filteredChats.length > 0) {
      onResumeChat(filteredChats[0]);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 dark:bg-black/60 backdrop-blur-md z-[1000] flex items-center justify-center p-4 transition-opacity animate-[fadeIn_0.2s_ease-out]"
      onClick={onClose}
    >
      <div
        className="bg-light-bg-component dark:bg-dark-bg-component rounded-lg shadow-2xl w-full max-w-2xl max-h-[80vh] transition-transform transform scale-100 animate-[scaleUp_0.2s_ease-out] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-light-border dark:border-dark-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MessageSquareIcon className="w-6 h-6 text-primary-accent" />
              <h3 className="font-serif text-2xl font-bold text-light-text-primary dark:text-dark-text-primary">
                Search Conversations
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full text-light-text-tertiary dark:text-dark-text-tertiary hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            >
              <XIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search Input */}
        <div className="p-6 border-b border-light-border dark:border-dark-border">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-light-text-tertiary dark:text-dark-text-tertiary" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search your conversations..."
              className="w-full pl-10 pr-4 py-3 text-base border border-light-border dark:border-dark-border rounded-md bg-light-bg-component dark:bg-dark-bg-component text-light-text-primary dark:text-dark-text-primary focus:ring-2 focus:ring-primary-accent focus:border-primary-accent outline-none"
            />
          </div>
          <p className="text-xs text-light-text-tertiary dark:text-dark-text-tertiary mt-2">
            Search by tool name, project, or conversation content • Press Enter to select first result • Escape to close
          </p>
        </div>

        {/* Results */}
        <div className="flex-grow overflow-hidden flex flex-col">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-accent mx-auto mb-4"></div>
                <p className="text-light-text-secondary dark:text-dark-text-secondary">Loading conversations...</p>
              </div>
            </div>
          ) : isSearching ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-accent mx-auto mb-3"></div>
                <p className="text-light-text-secondary dark:text-dark-text-secondary">Searching...</p>
              </div>
            </div>
          ) : filteredChats.length > 0 ? (
            <div className="overflow-y-auto">
              <div className="p-3">
                <p className="text-xs font-medium text-light-text-tertiary dark:text-dark-text-tertiary mb-3 px-1">
                  {searchTerm.trim() 
                    ? `${filteredChats.length} result${filteredChats.length === 1 ? '' : 's'} found`
                    : `${Math.min(filteredChats.length, 20)} recent conversations`
                  }
                </p>
              </div>
              {filteredChats.map((chat) => (
                <ChatSearchResult
                  key={chat.id}
                  chat={chat}
                  searchTerm={searchTerm}
                  onView={() => {
                    onSelectChat(chat);
                    onClose();
                  }}
                  onResume={() => {
                    onResumeChat(chat);
                    onClose();
                  }}
                />
              ))}
            </div>
          ) : searchTerm.trim() ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <MessageSquareIcon className="w-12 h-12 text-light-text-tertiary dark:text-dark-text-tertiary mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary mb-2">
                  No conversations found
                </h3>
                <p className="text-light-text-secondary dark:text-dark-text-secondary">
                  Try different keywords or check your conversation history
                </p>
              </div>
            </div>
          ) : chatHistory.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <MessageSquareIcon className="w-12 h-12 text-light-text-tertiary dark:text-dark-text-tertiary mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary mb-2">
                  No conversations yet
                </h3>
                <p className="text-light-text-secondary dark:text-dark-text-secondary">
                  Start using AI tools to see your conversation history here
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <SearchIcon className="w-12 h-12 text-light-text-tertiary dark:text-dark-text-tertiary mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary mb-2">
                  Search your conversations
                </h3>
                <p className="text-light-text-secondary dark:text-dark-text-secondary">
                  Type to search through your chat history
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-light-border dark:border-dark-border bg-light-bg-sidebar dark:bg-dark-bg-sidebar">
          <div className="flex items-center justify-between text-xs text-light-text-tertiary dark:text-dark-text-tertiary">
            <span>
              {chatHistory.length} total conversation{chatHistory.length === 1 ? '' : 's'}
            </span>
            <span>
              Press Enter to continue first result • Esc to close
            </span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleUp { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
      `}</style>
    </div>
  );
};