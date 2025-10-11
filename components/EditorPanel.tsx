import React, { useState, useRef, useEffect } from 'react';
import { useConfirmationDialog } from '../hooks/useConfirmationDialog';
import { XIcon } from './Icons';

interface EditorPanelProps {
  isOpen: boolean;
  onClose: () => void;
  content: string;
  onContentChange: (content: string) => void;
}

// Text cleanup utility
const cleanText = (text: string): string => {
  return text
    // Remove markdown formatting
    .replace(/\*\*(.*?)\*\*/g, '$1') // Bold
    .replace(/\*(.*?)\*/g, '$1') // Italic
    .replace(/__(.*?)__/g, '$1') // Underline
    .replace(/~~(.*?)~~/g, '$1') // Strikethrough
    .replace(/`(.*?)`/g, '$1') // Inline code
    .replace(/```[\s\S]*?```/g, '') // Code blocks
    .replace(/#{1,6}\s/g, '') // Headers
    .replace(/^\s*[-*+]\s/gm, '') // Bullet points
    .replace(/^\s*\d+\.\s/gm, '') // Numbered lists
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Links
    // Remove HTML tags
    .replace(/<[^>]*>/g, '')
    // Clean up extra whitespace
    .replace(/\n\s*\n\s*\n/g, '\n\n') // Multiple line breaks
    .replace(/[ \t]+/g, ' ') // Multiple spaces/tabs
    .replace(/^\s+|\s+$/g, '') // Leading/trailing whitespace
    .trim();
};

// Word and character count utility
const getTextStats = (text: string) => {
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const characters = text.length;
  const charactersNoSpaces = text.replace(/\s/g, '').length;
  
  return { words, characters, charactersNoSpaces };
};

export const EditorPanel: React.FC<EditorPanelProps> = ({ 
  isOpen, 
  onClose, 
  content, 
  onContentChange 
}) => {
  const confirmDialog = useConfirmationDialog();
  const [internalContent, setInternalContent] = useState(content);
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const stats = getTextStats(internalContent);

  // Sync internal content with prop
  useEffect(() => {
    setInternalContent(content);
    // Reset undo/redo stacks when content changes externally
    setUndoStack([]);
    setRedoStack([]);
  }, [content]);

  // Focus editor when opened
  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isOpen]);

  const handleContentChange = (newContent: string) => {
    // Save current content to undo stack before changing
    if (internalContent !== newContent) {
      setUndoStack(prev => [...prev.slice(-19), internalContent]); // Keep last 20 states
      setRedoStack([]); // Clear redo stack on new change
    }
    
    setInternalContent(newContent);
    onContentChange(newContent);
  };

  const handleUndo = () => {
    if (undoStack.length > 0) {
      const previousContent = undoStack[undoStack.length - 1];
      setRedoStack(prev => [internalContent, ...prev.slice(0, 19)]); // Keep last 20 states
      setUndoStack(prev => prev.slice(0, -1));
      setInternalContent(previousContent);
      onContentChange(previousContent);
      
      // Restore focus
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 0);
    }
  };

  const handleRedo = () => {
    if (redoStack.length > 0) {
      const nextContent = redoStack[0];
      setUndoStack(prev => [...prev.slice(-19), internalContent]); // Keep last 20 states
      setRedoStack(prev => prev.slice(1));
      setInternalContent(nextContent);
      onContentChange(nextContent);
      
      // Restore focus
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 0);
    }
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(internalContent);
      // Visual feedback could be added here
    } catch (error) {
      console.error('Failed to copy text:', error);
      // Fallback for older browsers
      if (textareaRef.current) {
        textareaRef.current.select();
        document.execCommand('copy');
      }
    }
  };

  const handlePasteText = async () => {
    try {
      const clipboardText = await navigator.clipboard.readText();
      const cleanedText = cleanText(clipboardText);
      
      if (textareaRef.current) {
        const textarea = textareaRef.current;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        
        const newContent = 
          textarea.value.substring(0, start) + 
          cleanedText + 
          textarea.value.substring(end);
        
        handleContentChange(newContent);
        
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(start + cleanedText.length, start + cleanedText.length);
        }, 0);
      }
    } catch (error) {
      console.error('Failed to paste text:', error);
      // Fallback - let browser handle paste naturally
    }
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case 'c':
          // Let browser handle copy naturally
          break;
        case 'v':
          // Let browser handle paste naturally, but clean the content
          break;
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    const cleanedText = cleanText(text);
    
    if (textareaRef.current) {
      const textarea = textareaRef.current;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      
      const newContent = 
        textarea.value.substring(0, start) + 
        cleanedText + 
        textarea.value.substring(end);
      
      handleContentChange(newContent);
      
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + cleanedText.length, start + cleanedText.length);
      }, 0);
    }
  };

  const handleRemoveEmoji = () => {
    // Remove all emoji characters from the text
    const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
    const cleanedContent = internalContent.replace(emojiRegex, '');
    handleContentChange(cleanedContent);
    
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 0);
  };

  const handleClearAll = () => {
    const clearContent = async () => {
      const confirmed = await confirmDialog.confirm({
        title: 'Clear All Content',
        message: 'Are you sure you want to clear all content? This action cannot be undone.',
        confirmText: 'Clear All',
        cancelText: 'Cancel',
        variant: 'danger'
      });

      if (confirmed) {
        handleContentChange('');
        setTimeout(() => {
          textareaRef.current?.focus();
        }, 0);
      }
    };
    
    clearContent();
  };

  const toolbarButtons = [
    {
      label: 'Remove Emoji',
      icon: '🚫',
      action: handleRemoveEmoji,
      disabled: !internalContent.trim(),
      shortcut: ''
    },
    {
      label: 'Clear All',
      icon: '🗑️',
      action: handleClearAll,
      disabled: !internalContent.trim(),
      shortcut: ''
    },
    {
      label: 'Copy Text',
      icon: '📋',
      action: handleCopyText,
      disabled: !internalContent.trim(),
      shortcut: 'Ctrl+C'
    },
    {
      label: 'Paste Text',
      icon: '📄',
      action: handlePasteText,
      disabled: false,
      shortcut: 'Ctrl+V'
    }
  ];

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black/20 dark:bg-black/40 backdrop-blur-sm z-[100] transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`} 
        onClick={onClose}
      />
      
      {/* Editor Panel */}
      <div className={`fixed top-0 right-0 h-full w-full max-w-2xl bg-light-bg-component dark:bg-dark-bg-component border-l border-light-border dark:border-dark-border shadow-2xl z-[101] flex flex-col transition-transform duration-300 ease-in-out ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-light-border dark:border-dark-border">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📝</span>
            <h3 className="font-serif text-xl font-bold text-light-text-primary dark:text-dark-text-primary">
              Editor
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-md text-light-text-tertiary dark:text-dark-text-tertiary hover:bg-light-bg-sidebar dark:hover:bg-dark-bg-page transition-colors"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Minimal Toolbar */}
        <div className="flex-shrink-0 p-4 border-b border-light-border dark:border-dark-border">
          <div className="flex gap-2">
            {toolbarButtons.map((button) => (
              <button
                key={button.label}
                onClick={button.action}
                disabled={button.disabled}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium border border-light-border dark:border-dark-border rounded-md bg-light-bg-component dark:bg-dark-bg-component text-light-text-primary dark:text-dark-text-primary hover:bg-light-bg-sidebar dark:hover:bg-dark-bg-page transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title={`${button.label} (${button.shortcut})`}
              >
                <span className="text-base">{button.icon}</span>
                <span>{button.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Text Editor */}
        <div className="flex-1 p-4 overflow-hidden flex flex-col">
          <textarea
            ref={textareaRef}
            value={internalContent}
            onChange={(e) => handleContentChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            className="flex-1 w-full p-4 border border-light-border dark:border-dark-border rounded-md bg-light-bg-component dark:bg-dark-bg-component text-light-text-primary dark:text-dark-text-primary focus:ring-2 focus:ring-primary-accent focus:border-primary-accent outline-none overflow-y-auto font-serif leading-relaxed resize-none"
            style={{ minHeight: '400px' }}
            placeholder="Start writing or add content from AI messages..."
          />
        </div>

        {/* Footer Stats */}
        <div className="flex-shrink-0 p-4 border-t border-light-border dark:border-dark-border bg-light-bg-sidebar dark:bg-dark-bg-sidebar">
          <div className="flex items-center justify-between text-sm text-light-text-tertiary dark:text-dark-text-tertiary">
            <div className="flex items-center gap-6">
              <span>Words: <span className="font-medium text-light-text-primary dark:text-dark-text-primary">{stats.words}</span></span>
              <span>Characters: <span className="font-medium text-light-text-primary dark:text-dark-text-primary">{stats.characters}</span></span>
              <span>No spaces: <span className="font-medium text-light-text-primary dark:text-dark-text-primary">{stats.charactersNoSpaces}</span></span>
            </div>
            <button
              onClick={() => handleContentChange('')}
              className="text-xs text-red-600 dark:text-red-400 hover:underline"
            >
              Clear All
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

// Text cleanup utility function for external use
export { cleanText };