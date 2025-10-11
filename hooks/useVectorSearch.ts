import { useState, useEffect } from 'react';
import { VectorSearchService } from '../services/vectorSearchService';
import { useTools } from './useTools';
import { Logger } from '../utils/logger';

export const useVectorSearch = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isGeneratingEmbeddings, setIsGeneratingEmbeddings] = useState(false);
  const [embeddingProgress, setEmbeddingProgress] = useState({ processed: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  
  const { tools } = useTools();
  const vectorService = VectorSearchService.getInstance();

  // Check if embeddings need to be generated
  useEffect(() => {
    const checkEmbeddingsStatus = async () => {
      if (tools.length === 0) return;
      
      try {
        // Check if we have embeddings for all active tools
        const response = await vectorService.generateToolEmbeddings();
        
        if (response.success) {
          const { processed, skipped } = response.data;
          
          if (processed > 0) {
            Logger.info('Generated embeddings for new tools', {
              component: 'useVectorSearch',
              processed,
              skipped,
            });
          }
          
          setIsInitialized(true);
          setEmbeddingProgress({ processed: processed + skipped, total: tools.length });
        } else {
          setError(response.error || 'Failed to initialize vector search');
        }
      } catch (err) {
        console.error('Vector search initialization error:', err);
        setError('Failed to initialize vector search');
      }
    };

    checkEmbeddingsStatus();
  }, [tools, vectorService]);

  const generateEmbeddingsForAllTools = async () => {
    setIsGeneratingEmbeddings(true);
    setError(null);
    
    try {
      const response = await vectorService.generateToolEmbeddings();
      
      if (response.success) {
        const { processed, skipped } = response.data;
        setEmbeddingProgress({ processed: processed + skipped, total: tools.length });
        setIsInitialized(true);
        
        Logger.info('Bulk embedding generation completed', {
          component: 'useVectorSearch',
          processed,
          skipped,
          totalTools: tools.length,
        });
      } else {
        setError(response.error || 'Failed to generate embeddings');
      }
    } catch (err) {
      console.error('Bulk embedding generation error:', err);
      setError('Failed to generate embeddings');
    } finally {
      setIsGeneratingEmbeddings(false);
    }
  };

  const findSimilarTools = async (query: string, maxResults: number = 5) => {
    try {
      const response = await vectorService.findSimilarTools(query, maxResults);
      
      if (response.success) {
        return response.data;
      } else {
        throw new Error(response.error);
      }
    } catch (err) {
      console.error('Similar tools search error:', err);
      throw err;
    }
  };

  const getOptimizedRecommendation = async (query: string) => {
    try {
      const response = await vectorService.getOptimizedToolRecommendation(query);
      
      if (response.success) {
        return response.data;
      } else {
        throw new Error(response.error);
      }
    } catch (err) {
      console.error('Optimized recommendation error:', err);
      throw err;
    }
  };

  return {
    isInitialized,
    isGeneratingEmbeddings,
    embeddingProgress,
    error,
    generateEmbeddingsForAllTools,
    findSimilarTools,
    getOptimizedRecommendation,
  };
};