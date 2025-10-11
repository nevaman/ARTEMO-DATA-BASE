import React from 'react';
import type { ChatHistoryItem } from '../types';
import { ChatMessage } from './ChatMessage';
import { EditorPanel, cleanText } from './EditorPanel';
import { ArrowLeftIcon } from './Icons';

interface ChatDetailViewProps {
  chatItem: ChatHistoryItem;
  onBack: () => void;
  onResume: () => void;
}

export const ChatDetailView: React.FC<ChatDetailViewProps> = ({ chatItem, onBack, onResume }) => {
  const [isEditorOpen, setIsEditorOpen] = React.useState(false);
  const [editorContent, setEditorContent] = React.useState('');

  const handleAddToEditor = (text: string) => {
    const cleanedText = cleanText(text);
    setEditorContent(prev => {
      const separator = prev.trim() ? '\n\n' : '';
      return prev + separator + cleanedText;
    });
    setIsEditorOpen(true);
  };

  return (
    <div className="h-full flex flex-col relative bg-light-bg-page dark:bg-[#212121]">
      {/* Floating Editor Tab */}
      <button
        onClick={() => setIsEditorOpen(true)}
        className="fixed top-1/2 right-0 -translate-y-1/2 bg-primary-accent text-text-on-accent px-3 py-6 rounded-l-lg shadow-lg hover:opacity-85 transition-all duration-200 z-50 flex flex-col items-center gap-2 text-sm font-medium"
        style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
      >
        <span className="text-lg">✍️</span>
        <span>Editor</span>
      </button>

      <header className="flex-shrink-0 flex items-center gap-4 p-4 border-b border-light-border dark:border-gray-600 bg-light-bg-component/90 dark:bg-[rgba(33,33,33,0.9)] backdrop-blur-sm sticky top-0 z-10">
        <button 
          onClick={onBack} 
          className="flex items-center gap-2 text-sm font-medium text-light-text-secondary dark:text-gray-300 hover:text-light-text-primary dark:hover:text-white"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Back
        </button>
        <div className="h-6 w-px bg-light-border dark:bg-gray-600"></div>
        <div className="flex-grow">
          <h2 className="font-serif text-xl font-bold text-light-text-primary dark:text-white">
            {chatItem.toolTitle}
          </h2>
          <p className="text-sm text-light-text-tertiary dark:text-gray-400">
            {new Date(chatItem.timestamp).toLocaleDateString()} at {new Date(chatItem.timestamp).toLocaleTimeString()}
          </p>
        </div>
        <button
          onClick={onResume}
          className="flex items-center gap-2 px-4 py-2 bg-primary-accent text-text-on-accent rounded-md hover:opacity-85 transition-opacity font-medium"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16l2.879-2.879m0 0a3 3 0 104.243-4.242 3 3 0 00-4.243 4.242zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Continue Conversation
        </button>
      </header>

      <div className="flex-grow overflow-y-auto">
        <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-8">
          {chatItem.messages.length > 0 ? (
            chatItem.messages.map(message => (
              <div key={message.id} className="mb-8 last:mb-4">
                <ChatMessage 
                  message={message} 
                  onAddToEditor={handleAddToEditor}
                />
              </div>
            ))
          ) : (
            <div className="text-center py-12 text-light-text-tertiary dark:text-dark-text-tertiary">
              <p>No messages found in this conversation.</p>
            </div>
          )}
        </div>
      </div>

      {/* Editor Panel */}
      <EditorPanel
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        content={editorContent}
        onContentChange={setEditorContent}
      />
    </div>
  );
};