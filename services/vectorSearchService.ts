import { supabase, handleSupabaseError, isSupabaseAvailable } from '../lib/supabase';
import { Logger } from '../utils/logger';
import type { DynamicTool, ApiResponse } from '../types';
import { RecommendationEngine } from './recommendationEngine';
import { ToolRepository } from './toolRepository';

export interface SimilarTool {
  tool_id: string;
  title: string;
  description: string;
  category_name: string;
  similarity_score: number;
}

type RecommendationSource = 'supabase' | 'local';

interface RecommendationPayload {
  recommendedTool: DynamicTool | null;
  analysis: string;
  similarTools: SimilarTool[];
  tokensSaved: number;
  source: RecommendationSource;
  provenance: string;
}

export class VectorSearchService {
  private static instance: VectorSearchService;
  private recommendationEngine = RecommendationEngine.getInstance();
  private repository = ToolRepository.getInstance();
  
  static getInstance(): VectorSearchService {
    if (!VectorSearchService.instance) {
      VectorSearchService.instance = new VectorSearchService();
    }
    return VectorSearchService.instance;
  }

  /**
   * Generate embeddings for all tools that don't have them yet
   */
  async generateToolEmbeddings(): Promise<ApiResponse<{ processed: number; skipped: number }>> {
    if (!supabase || !isSupabaseAvailable()) {
      return { success: true, data: { processed: 0, skipped: 0 } };
    }

    try {
      // Get all active tools that need embeddings
      const { data: tools, error: toolsError } = await supabase
        .from('tools')
        .select(`
          id,
          title,
          description,
          updated_at,
          category:categories(name),
          questions:tool_questions(label)
        `)
        .eq('active', true);

      if (toolsError) {
        throw toolsError;
      }

      if (!tools || tools.length === 0) {
        return { success: true, data: { processed: 0, skipped: 0 } };
      }

      let processed = 0;
      let skipped = 0;

      for (const tool of tools) {
        try {
          // Check if embedding already exists and is up to date
          const { data: existingEmbedding, error: embeddingQueryError } = await supabase
            .from('tool_embeddings')
            .select('content_hash, updated_at')
            .eq('tool_id', tool.id)
            .single();

          // Handle the case where no embedding exists (this is expected for new tools)
          if (embeddingQueryError && embeddingQueryError.code !== 'PGRST116') {
            Logger.error({
              message: `Failed to query existing embedding for tool ${tool.id}`,
              code: 'EMBEDDING_QUERY_ERROR',
              details: embeddingQueryError.message,
              timestamp: new Date().toISOString(),
              correlationId: Logger.getCorrelationId(),
              component: 'VectorSearchService',
              severity: 'error',
            });
            continue;
          }

          // Create content hash to check if tool content changed
          const toolContent = `${tool.title} | ${tool.description} | ${tool.category?.name || ''} | ${tool.questions?.map((q: any) => q.label).join(' ') || ''}`;
          const contentHash = await this.generateContentHash(toolContent);

          // Skip if embedding exists and content hasn't changed
          if (existingEmbedding && existingEmbedding.content_hash === contentHash) {
            skipped++;
            continue;
          }

          // Generate new embedding
          const { error: embeddingError } = await supabase.functions.invoke('generate-embeddings', {
            body: {
              action: 'generate_tool_embedding',
              toolId: tool.id
            }
          });

          if (embeddingError) {
            Logger.error({
              message: `Failed to generate embedding for tool ${tool.id}`,
              code: 'EMBEDDING_GENERATION_ERROR',
              details: embeddingError.message,
              timestamp: new Date().toISOString(),
              correlationId: Logger.getCorrelationId(),
              component: 'VectorSearchService',
              severity: 'error',
            });
            continue;
          }

          processed++;
          
          // Add delay to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (error) {
          Logger.error({
            message: `Error processing tool ${tool.id} for embedding`,
            code: 'TOOL_EMBEDDING_ERROR',
            details: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString(),
            correlationId: Logger.getCorrelationId(),
            component: 'VectorSearchService',
            severity: 'error',
          });
        }
      }

      Logger.info('Tool embeddings generation completed', {
        component: 'VectorSearchService',
        processed,
        skipped,
        totalTools: tools.length,
      });

      return { success: true, data: { processed, skipped } };
    } catch (error: any) {
      const errorResponse = handleSupabaseError(error, 'generateToolEmbeddings');
      return { success: false, error: errorResponse.message };
    }
  }

  /**
   * Find similar tools using vector search
   */
  async findSimilarTools(
    userQuery: string,
    maxResults: number = 5,
    similarityThreshold: number = 0.6
  ): Promise<ApiResponse<SimilarTool[]>> {
    if (!supabase || !isSupabaseAvailable()) {
      const local = await this.recommendationEngine.getRecommendation(userQuery);
      const similar = local.scores.slice(0, maxResults).map(score => ({
        tool_id: score.tool.id,
        title: score.tool.title,
        description: score.tool.description,
        category_name: score.tool.category,
        similarity_score: score.similarity,
      }));
      return { success: true, data: similar };
    }

    try {
      Logger.info('Starting vector search for similar tools', {
        component: 'VectorSearchService',
        method: 'findSimilarTools',
        queryLength: userQuery.length,
        maxResults,
        similarityThreshold,
      });

      // Generate embedding for user query
      Logger.info('Invoking generate-embeddings edge function', {
        component: 'VectorSearchService',
        action: 'generate_query_embedding',
        queryPreview: userQuery.substring(0, 100),
      });

      const response = await supabase.functions.invoke('generate-embeddings', {
        body: {
          action: 'generate_query_embedding',
          text: userQuery
        }
      });

      Logger.info('Received response from generate-embeddings edge function', {
        component: 'VectorSearchService',
        hasError: !!response.error,
        hasData: !!response.data,
      });

      // Check if the response itself failed
      if (response.error) {
        Logger.error({
          message: 'Edge function invocation failed',
          code: 'EDGE_FUNCTION_ERROR',
          details: response.error.message || 'Unknown edge function error',
          timestamp: new Date().toISOString(),
          correlationId: Logger.getCorrelationId(),
          component: 'VectorSearchService',
          severity: 'error',
        });
        throw new Error(response.error.message || 'Edge function failed');
      }

      const queryResult = response.data;

      Logger.info('Parsing query result from edge function', {
        component: 'VectorSearchService',
        success: queryResult?.success,
        hasSimilarTools: !!queryResult?.similarTools,
        similarToolsCount: queryResult?.similarTools?.length || 0,
      });
      
      if (!queryResult?.success) {
        Logger.error({
          message: 'Query embedding generation failed',
          code: 'EMBEDDING_GENERATION_ERROR',
          details: queryResult?.error || 'Unknown embedding error',
          timestamp: new Date().toISOString(),
          correlationId: Logger.getCorrelationId(),
          component: 'VectorSearchService',
          severity: 'error',
        });
        throw new Error(queryResult?.error || 'Failed to generate query embedding');
      }

      const similarTools = queryResult.similarTools || [];

      Logger.info('Vector search completed successfully', {
        component: 'VectorSearchService',
        queryLength: userQuery.length,
        resultsFound: similarTools.length,
        threshold: similarityThreshold,
        topResults: similarTools.slice(0, 3).map((t: SimilarTool) => ({
          title: t.title,
          similarity: t.similarity_score,
        })),
      });

      return { success: true, data: similarTools };
    } catch (error: any) {
      const errorResponse = handleSupabaseError(error, 'findSimilarTools');
      return { success: false, error: errorResponse.message };
    }
  }

  /**
   * Get optimized tool recommendation using vector search
   */
  async getOptimizedToolRecommendation(userQuery: string): Promise<ApiResponse<RecommendationPayload>> {
    if (!userQuery.trim()) {
      return {
        success: true,
        data: {
          recommendedTool: null,
          analysis: 'Please describe what you want to create so we can recommend the right tool.',
          similarTools: [],
          tokensSaved: 0,
          source: 'local',
          provenance: 'Input validation',
        },
      };
    }

    if (!supabase || !isSupabaseAvailable()) {
      return this.buildLocalRecommendation(userQuery, 'Supabase client not configured');
    }

    try {
      Logger.info('Starting optimized tool recommendation process', {
        component: 'VectorSearchService',
        method: 'getOptimizedToolRecommendation',
        queryLength: userQuery.length,
        queryPreview: userQuery.substring(0, 100),
      });

      const similarToolsResponse = await this.findSimilarTools(userQuery, 5, 0.6);

      Logger.info('Received response from findSimilarTools', {
        component: 'VectorSearchService',
        success: similarToolsResponse.success,
        dataLength: similarToolsResponse.data?.length || 0,
        hasError: !!similarToolsResponse.error,
      });

      if (!similarToolsResponse.success) {
        return this.buildLocalRecommendation(userQuery, similarToolsResponse.error);
      }

      const similarTools = similarToolsResponse.data || [];

      if (similarTools.length === 0) {
        return this.buildLocalRecommendation(userQuery, 'Vector index returned no matches');
      }

      const optimizedPrompt = `You are an AI assistant that analyzes user requests and recommends the most appropriate copywriting tool from a curated list of relevant tools.

Relevant tools (pre-filtered using semantic similarity):
${similarTools.map(tool =>
  `- **${tool.title}** (${tool.category_name}): ${tool.description} [Similarity: ${(tool.similarity_score * 100).toFixed(1)}%]`
).join('\n')}

User request: "${userQuery}"

Based on the semantic similarity scores and your analysis:
1. Select the MOST APPROPRIATE tool from the list above
2. Explain why this tool is the perfect match
3. Provide actionable insights about their content creation goal

Respond in this format:
RECOMMENDED_TOOL: [exact tool title from the list]
ANALYSIS: [detailed analysis explaining why this tool matches their needs and how it will help them achieve their content goals]`;

      const { data: aiResponse, error: aiError } = await supabase.functions.invoke('ai-chat', {
        body: {
          toolId: 'tool-recommendation-optimized',
          messages: [{ id: '1', sender: 'user', text: optimizedPrompt }],
          correlationId: Logger.getCorrelationId(),
        }
      });

      if (aiError || !aiResponse?.response) {
        Logger.warn('VectorSearchService: ai-chat invocation failed, using local fallback', {
          error: aiError?.message || 'No response',
        });
        return this.buildLocalRecommendation(userQuery, aiError?.message || 'AI response missing');
      }

      const responseText = aiResponse.response;
      const toolMatch = responseText.match(/RECOMMENDED_TOOL:\s*(.+?)(?:\n|$)/);
      const analysisMatch = responseText.match(/ANALYSIS:\s*([\s\S]+)/);

      let recommendedTool: DynamicTool | null = null;
      let analysis = `This is the best recommended tool based on your query: '${userQuery}'.`;

      if (toolMatch) {
        const recommendedToolTitle = toolMatch[1].trim();
        const foundSimilarTool = similarTools.find(tool =>
          tool.title.toLowerCase() === recommendedToolTitle.toLowerCase() ||
          tool.title.includes(recommendedToolTitle) ||
          recommendedToolTitle.includes(tool.title)
        );

        if (foundSimilarTool) {
          const { data: fullTool, error: toolError } = await supabase
            .from('tools')
            .select(`
              *,
              category:categories(*),
              questions:tool_questions(*)
            `)
            .eq('id', foundSimilarTool.tool_id)
            .single();

          if (!toolError && fullTool) {
            recommendedTool = {
              id: fullTool.id,
              title: fullTool.title,
              category: fullTool.category?.name || 'Other',
              description: fullTool.description,
              active: fullTool.active,
              featured: fullTool.featured,
              primaryModel: fullTool.primary_model,
              fallbackModels: fullTool.fallback_models || [],
              promptInstructions: fullTool.prompt_instructions,
              questions: (fullTool.questions || [])
                .sort((a: any, b: any) => a.question_order - b.question_order)
                .map((q: any) => ({
                  id: q.id,
                  label: q.label,
                  type: q.type,
                  placeholder: q.placeholder,
                  required: q.required,
                  order: q.question_order,
                  options: q.options,
                })),
            };
          } else {
            const fallbackTool = await this.repository.getToolById(foundSimilarTool.tool_id);
            if (fallbackTool) {
              recommendedTool = fallbackTool;
            }
          }
        }
      }

      if (!recommendedTool) {
        return this.buildLocalRecommendation(userQuery, 'LLM response missing actionable tool reference');
      }

      const originalTokens = await this.estimateTokens(userQuery, await this.getAllToolsForEstimate());
      const optimizedTokens = await this.estimateTokens(userQuery, similarTools);
      const tokensSaved = Math.max(0, originalTokens - optimizedTokens);

      return {
        success: true,
        data: {
          recommendedTool,
          analysis,
          similarTools,
          tokensSaved,
          source: 'supabase',
          provenance: 'Supabase vector search',
        },
      };

    } catch (error: any) {
      Logger.warn('VectorSearchService: Supabase pipeline failed, using local recommendation', {
        error: error.message,
      });
      return this.buildLocalRecommendation(userQuery, error.message);
    }
  }

  private async buildLocalRecommendation(userQuery: string, reason?: string): Promise<ApiResponse<RecommendationPayload>> {
    const local = await this.recommendationEngine.getRecommendation(userQuery);
    const similarTools: SimilarTool[] = local.scores.slice(0, 5).map(score => ({
      tool_id: score.tool.id,
      title: score.tool.title,
      description: score.tool.description,
      category_name: score.tool.category,
      similarity_score: score.similarity,
    }));

    const analysis = local.recommendedTool
      ? `This is the best recommended tool based on your query: '${userQuery}'.`
      : [local.analysis, reason].filter(Boolean).join(' — ');

    return {
      success: true,
      data: {
        recommendedTool: local.recommendedTool,
        analysis,
        similarTools,
        tokensSaved: 0,
        source: 'local',
        provenance: local.sourceLabel,
      },
    };
  }

  private async generateContentHash(content: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private async getAllToolsForEstimate(): Promise<any[]> {
    if (!supabase) return [];
    
    const { data: tools } = await supabase
      .from('tools')
      .select('title, description, category:categories(name)')
      .eq('active', true);
    
    return tools || [];
  }

  private async estimateTokens(query: string, tools: any[]): Promise<number> {
    // Rough token estimation (1 token ≈ 4 characters)
    const queryTokens = Math.ceil(query.length / 4);
    const toolsTokens = tools.reduce((total, tool) => {
      const toolText = `${tool.title} ${tool.description} ${tool.category_name || tool.category?.name || ''}`;
      return total + Math.ceil(toolText.length / 4);
    }, 0);
    
    return queryTokens + toolsTokens + 200; // Add overhead for prompt structure
  }
}