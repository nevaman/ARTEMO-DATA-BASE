// components/ChatMessage.tsx (Final Version with User Border)

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Message } from '../types';
import * as Icons from './Icons';

// This component remains the same, it works well.
const CodeBlock = ({ node, inline, className, children, ...props }: any) => {
    const [isCopied, setIsCopied] = React.useState(false);
    const match = /language-(\w+)/.exec(className || '');
    const codeText = String(children).replace(/\n$/, '');

    const handleCopy = () => {
        navigator.clipboard.writeText(codeText);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    return !inline ? (
        <div className="my-4 rounded-md bg-dark-bg-page border border-dark-border text-sm">
            <div className="flex items-center justify-between px-4 py-1.5 border-b border-dark-border">
                <span className="text-xs font-sans text-dark-text-tertiary">{match ? match[1] : 'code'}</span>
                <button onClick={handleCopy} className="flex items-center gap-1.5 text-xs text-dark-text-tertiary hover:text-dark-text-primary transition-colors">
                    {isCopied ? <Icons.CheckIcon className="w-4 h-4 text-green-400" /> : <Icons.CopyIcon className="w-4 h-4" />}
                    {isCopied ? 'Copied!' : 'Copy'}
                </button>
            </div>
            <pre className="p-4 overflow-x-auto font-mono" {...props}>{children}</pre>
        </div>
    ) : (
        <code className="px-1 py-0.5 bg-light-border dark:bg-dark-border rounded font-mono text-sm" {...props}>
            {children}
        </code>
    );
};

// Manually styles each HTML tag for markdown
const markdownComponents = {
    h1: ({node, ...props}: any) => <h1 className="text-2xl font-bold my-4" {...props} />,
    h2: ({node, ...props}: any) => <h2 className="text-xl font-bold my-3" {...props} />,
    h3: ({node, ...props}: any) => <h3 className="text-lg font-bold my-3" {...props} />,
    p: ({node, ...props}: any) => <p className="my-4 leading-relaxed" {...props} />,
    ul: ({node, ...props}: any) => <ul className="list-disc list-inside my-4 pl-4 space-y-2" {...props} />,
    ol: ({node, ...props}: any) => <ol className="list-decimal list-inside my-4 pl-4 space-y-2" {...props} />,
    li: ({node, ...props}: any) => <li className="pl-2" {...props} />,
    blockquote: ({node, ...props}: any) => <blockquote className="border-l-4 border-primary-accent bg-light-bg-sidebar dark:bg-dark-bg-component pl-4 italic my-4 py-2" {...props} />,
    code: CodeBlock,
};

const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const ChatMessage: React.FC<{
    message: Message;
    onAddToEditor?: (text: string) => void;
}> = ({ message, onAddToEditor }) => {
    const [copied, setCopied] = React.useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(message.text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    
    if (message.sender === 'system') {
        return (
            <div className="w-full text-center text-sm text-light-text-tertiary dark:text-dark-text-tertiary py-2 my-2">
                <Icons.PaperclipIcon className="w-3 h-3 inline-block mr-1.5" /> {message.text}
            </div>
        );
    }

    const isUser = message.sender === 'user';
    const isAi = message.sender === 'ai';

    return (
        <div className={`flex items-start gap-3 w-full ${isUser ? 'justify-end' : ''}`}>
            {isAi && <Icons.ArtemoIcon className="w-8 h-8 text-primary-accent flex-shrink-0 mt-1" />}
            
            <div className={`flex flex-col max-w-3xl ${isUser ? 'items-end' : 'w-full items-start'}`}>
                <div className={`px-3 py-2 rounded-xl text-left font-sans text-light-text-secondary dark:text-dark-text-secondary ${
                    isUser
                        // --- THIS IS THE FIX: Added border classes ---
                        ? 'bg-light-bg-component dark:bg-dark-bg-component text-light-text-primary dark:text-dark-text-primary border border-light-border dark:border-dark-border'
                        : ''
                }`}>
                    
                    {message.file && (
                         <div className="mb-3 p-3 border border-light-border dark:border-dark-border rounded-md flex items-center gap-3 bg-black/5 dark:bg-white/5">
                            <Icons.FileTextIcon className="w-6 h-6 text-light-text-tertiary dark:text-dark-text-tertiary flex-shrink-0" />
                            <div>
                                <p className="font-medium text-sm text-light-text-primary dark:text-dark-text-primary">{message.file.name}</p>
                                <p className="text-xs text-light-text-tertiary dark:text-dark-text-tertiary">{formatFileSize(message.file.size)}</p>
                            </div>
                        </div>
                    )}
                    
                    <ReactMarkdown 
                        remarkPlugins={[remarkGfm]}
                        components={markdownComponents}
                    >
                        {message.text}
                    </ReactMarkdown>
                </div>
                
                {isAi && (
                    <div className="mt-2 flex items-center gap-3">
                        <button 
                            onClick={handleCopy}
                            className="flex items-center gap-1.5 p-1 rounded-md text-xs font-medium text-light-text-tertiary dark:text-dark-text-tertiary hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                            title="Copy text"
                        >
                            {copied 
                                ? <><Icons.CheckIcon className="w-3.5 h-3.5 text-primary-accent" /> Copied</> 
                                : <><Icons.CopyIcon className="w-3.5 h-3.5" /> Copy</>
                            }
                        </button>
                        {onAddToEditor && (
                            <button 
                                onClick={() => onAddToEditor && onAddToEditor(message.text)}
                                className="flex items-center gap-1.5 p-1 rounded-md text-xs font-medium text-light-text-tertiary dark:text-dark-text-tertiary hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                                title="Add to editor"
                            >
                                <Icons.FileTextIcon className="w-3.5 h-3.5" /> Add to Editor
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};