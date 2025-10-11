import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useChatHistory } from '../hooks/useChatHistory';
import { useTools } from '../hooks/useTools';
import { HistoryView } from '../components/HistoryView';
import { useNotifications } from '../contexts/NotificationContext';

export const HistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const notifications = useNotifications();
  const { tools } = useTools();

  const handleViewChatDetail = (chatItem: any) => {
    navigate(`/chat/${chatItem.id}`);
  }; 

  const handleResumeChatSession = (chatItem: any) => {
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

  const handleClearHistory = () => {
    // This will be handled by the HistoryView component's internal logic
  };

  return (
    <HistoryView
      onViewChatDetail={handleViewChatDetail}
      onClearHistory={handleClearHistory}
      onResumeChatSession={handleResumeChatSession}
    />
  );
};