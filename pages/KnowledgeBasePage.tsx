import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const topics = [
  { title: 'Getting Started', file: 'getting-started.md' },
  { title: 'Using the Tools', file: 'using-the-tools.md' },
  { title: 'Admin Guide', file: 'admin-guide.md' },
];

export const KnowledgeBasePage: React.FC = () => {
  const [content, setContent] = useState('');
  const [selectedTopic, setSelectedTopic] = useState(topics[0]);

  useEffect(() => {
    fetch(`/knowledge_base/${selectedTopic.file}`)
      .then((response) => response.text())
      .then((text) => setContent(text));
  }, [selectedTopic]);

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside className="w-64 bg-light-bg-sidebar dark:bg-dark-bg-sidebar p-4 border-r border-light-border dark:border-dark-border">
        <h2 className="text-lg font-semibold mb-4 text-light-text-primary dark:text-dark-text-primary">Topics</h2>
        <ul className="space-y-2">
          {topics.map((topic) => (
            <li key={topic.file}>
              <button
                onClick={() => setSelectedTopic(topic)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  selectedTopic.file === topic.file
                    ? 'bg-primary-accent text-white'
                    : 'text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-bg-page dark:hover:bg-dark-bg-page'
                }`}
              >
                {topic.title}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-y-auto">
        <article className="prose dark:prose-invert max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </article>
      </main>
    </div>
  );
};
