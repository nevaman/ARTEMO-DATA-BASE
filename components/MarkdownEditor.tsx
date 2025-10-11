import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { EyeIcon, EditIcon } from './Icons';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  disabled?: boolean;
}

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  value,
  onChange,
  placeholder = "Enter markdown content...",
  rows = 6,
  className = "",
  disabled = false
}) => {
  const [mode, setMode] = useState<'write' | 'preview'>('write');

  const handleModeToggle = (newMode: 'write' | 'preview') => {
    setMode(newMode);
  };

  return (
    <div className={`border border-light-border dark:border-dark-border rounded-md overflow-hidden ${className}`}>
      {/* Header with mode toggle */}
      <div className="flex items-center justify-between bg-light-bg-sidebar dark:bg-dark-bg-sidebar border-b border-light-border dark:border-dark-border px-3 py-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleModeToggle('write')}
            className={`flex items-center gap-2 px-3 py-1 text-sm font-medium rounded-sm transition-colors ${
              mode === 'write'
                ? 'bg-primary-accent text-text-on-accent'
                : 'text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-bg-component dark:hover:bg-dark-bg-component'
            }`}
          >
            <EditIcon className="w-4 h-4" />
            Write
          </button>
          <button
            type="button"
            onClick={() => handleModeToggle('preview')}
            className={`flex items-center gap-2 px-3 py-1 text-sm font-medium rounded-sm transition-colors ${
              mode === 'preview'
                ? 'bg-primary-accent text-text-on-accent'
                : 'text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-bg-component dark:hover:bg-dark-bg-component'
            }`}
          >
            <EyeIcon className="w-4 h-4" />
            Preview
          </button>
        </div>
        <div className="text-xs text-light-text-tertiary dark:text-dark-text-tertiary">
          Markdown supported
        </div>
      </div>

      {/* Content area */}
      <div className="relative">
        {mode === 'write' ? (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            rows={rows}
            disabled={disabled}
            className="w-full p-4 bg-light-bg-component dark:bg-dark-bg-component text-light-text-primary dark:text-dark-text-primary focus:ring-2 focus:ring-primary-accent focus:border-primary-accent outline-none resize-vertical border-none font-mono text-sm leading-relaxed"
            style={{ minHeight: `${rows * 1.5}rem` }}
          />
        ) : (
          <div className="p-4 bg-light-bg-component dark:bg-dark-bg-component min-h-[200px] overflow-y-auto">
            {value.trim() ? (
              <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:text-light-text-primary dark:prose-headings:text-dark-text-primary prose-p:text-light-text-secondary dark:prose-p:text-dark-text-secondary prose-strong:text-light-text-primary dark:prose-strong:text-dark-text-primary prose-code:text-primary-accent prose-code:bg-light-bg-sidebar dark:prose-code:bg-dark-bg-sidebar prose-pre:bg-light-bg-sidebar dark:prose-pre:bg-dark-bg-sidebar prose-blockquote:border-primary-accent prose-blockquote:text-light-text-secondary dark:prose-blockquote:text-dark-text-secondary">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {value}
                </ReactMarkdown>
              </div>
            ) : (
              <div className="text-light-text-tertiary dark:text-dark-text-tertiary italic">
                No content to preview. Switch to Write mode to add content.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer with helpful tips */}
      {mode === 'write' && (
        <div className="bg-light-bg-sidebar dark:bg-dark-bg-sidebar border-t border-light-border dark:border-dark-border px-3 py-2">
          <div className="text-xs text-light-text-tertiary dark:text-dark-text-tertiary">
            <span className="font-medium">Markdown tips:</span> Use **bold**, *italic*, `code`, # headers, - lists, &gt; quotes
          </div>
        </div>
      )}
    </div>
  );
};