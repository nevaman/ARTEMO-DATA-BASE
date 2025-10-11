import React from 'react';
import { useVectorSearch } from '../hooks/useVectorSearch';
import { useTools } from '../hooks/useTools';

interface VectorSearchStatusProps {
  onGenerateEmbeddings?: () => void;
}

export const VectorSearchStatus: React.FC<VectorSearchStatusProps> = ({ onGenerateEmbeddings }) => {
  const { 
    isInitialized, 
    isGeneratingEmbeddings, 
    embeddingProgress, 
    error,
    generateEmbeddingsForAllTools 
  } = useVectorSearch();
  
  const { tools } = useTools();

  const handleGenerateEmbeddings = async () => {
    await generateEmbeddingsForAllTools();
    if (onGenerateEmbeddings) {
      onGenerateEmbeddings();
    }
  };

  // Component now operates silently without UI status indicators
  return null;
};