import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useChatHistory } from '../hooks/useChatHistory';
import { useTools } from '../hooks/useTools';
import { ChatDetailView } from '../components/ChatDetailView';
import { useNotifications } from '../contexts/NotificationContext';

export const ChatDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const notifications = useNotifications();
  const { chatHistory } = useChatHistory();
  const { tools } = useTools();

  const chatItem = chatHistory.find(chat => chat.id === id);

  if (!chatItem) {
    return (
      <div className="p-4 lg:p-6 max-w-5xl mx-auto w-full">
        <div className="text-center py-20">
          <h2 className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary mb-4">
            Chat Not Found
          </h2>
          <p className="text-light-text-secondary dark:text-dark-text-secondary mb-6">
            The chat session you're looking for doesn't exist or has been deleted.
          </p>
          <button
            onClick={() => navigate('/history')}
            className="px-4 py-2 bg-primary-accent text-text-on-accent rounded-md hover:opacity-85"
          >
            Back to History
          </button>
        </div>
      </div>
    );
  }

  const handleResume = () => {
    // Find the tool for this chat
    const tool = tools.find(t => t.id === chatItem.toolId);
    if (!tool) {
      notifications.error(
        `The tool "${chatItem.toolTitle}" is no longer available. It may have been deactivated or removed.`,
        'Tool Not Available'
      );
      return;
    }

    // Navigate to tool interface with chat session
    navigate(`/tools/${tool.id}`, { 
      state: { existingChatSession: chatItem } 
    });
  };

  return (
    <ChatDetailView
      chatItem={chatItem}
      onBack={() => navigate('/history')}
      onResume={handleResume}
    />
  );
};