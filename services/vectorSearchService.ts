import { supabase, handleSupabaseError } from '../lib/supabase';
import { Logger } from '../utils/logger';
import type { DynamicTool, ApiResponse } from '../types';

interface SimilarTool {
  tool_id: string;
  title: string;
  description: string;
  category_name: string;
  similarity_score: number;
}

export class VectorSearchService {
  private static instance: VectorSearchService;
  
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
    if (!supabase) {
      return { success: false, error: 'Supabase not connected' };
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
    if (!supabase) {
      return { success: false, error: 'Supabase not connected' };
    }

    try {
      // Generate embedding for user query
      const response = await supabase.functions.invoke('generate-embeddings', {
        body: {
          action: 'generate_query_embedding',
          text: userQuery
        }
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

      Logger.info('Vector search completed', {
        component: 'VectorSearchService',
        queryLength: userQuery.length,
        resultsFound: similarTools.length,
        threshold: similarityThreshold,
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
  async getOptimizedToolRecommendation(userQuery: string): Promise<ApiResponse<{
    recommendedTool: DynamicTool | null;
    analysis: string;
    similarTools: SimilarTool[];
    tokensSaved: number;
  }>> {
    if (!supabase) {
      return { success: false, error: 'Supabase not connected' };
    }

    try {
      // Step 1: Use vector search to find similar tools
      const similarToolsResponse = await this.findSimilarTools(userQuery, 5, 0.6);
      
      if (!similarToolsResponse.success) {
        // If vector search fails, return graceful fallback
        return {
          success: true,
          data: {
            recommendedTool: null,
            analysis: 'Vector search is currently unavailable. Please try the legacy search method or contact support.',
            similarTools: [],
            tokensSaved: 0
          }
        };
      }

      const similarTools = similarToolsResponse.data;

      if (similarTools.length === 0) {
        return {
          success: true,
          data: {
            recommendedTool: null,
            analysis: 'No suitable tools found for your request. Please try rephrasing or browse our tool categories.',
            similarTools: [],
            tokensSaved: 0
          }
        };
      }

      // Step 2: Create optimized prompt with only relevant tools
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

      // Step 3: Send optimized prompt to AI
      const { data: aiResponse, error: aiError } = await supabase.functions.invoke('ai-chat', {
        body: {
          toolId: 'tool-recommendation-optimized',
          messages: [{ id: '1', sender: 'user', text: optimizedPrompt }],
          correlationId: Logger.getCorrelationId(),
        }
      });

      if (aiError || !aiResponse?.response) {
        Logger.warn('AI service unavailable, falling back to basic recommendation', Logger.getCorrelationId(), {
          aiError: aiError?.message,
          hasResponse: !!aiResponse?.response
        });
        
        // Return the top similar tool as fallback
        if (similarTools.length > 0) {
          const topTool = similarTools[0];
          const { data: fullTool, error: toolError } = await supabase
            .from('tools')
            .select(`
              *,
              category:categories(*),
              questions:tool_questions(*)
            `)
            .eq('id', topTool.tool_id)
            .single();

          if (!toolError && fullTool) {
            const recommendedTool = {
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

            return {
              success: true,
              data: {
                recommendedTool,
                analysis: `Based on semantic similarity, "${topTool.title}" appears to be the best match for your request. This tool specializes in ${topTool.category_name.toLowerCase()} and should help you create the content you're looking for.`,
                similarTools,
                tokensSaved: 0
              }
            };
          }
        }
        
        // If we can't get tool details, return basic info
        return {
          success: true,
          data: {
            recommendedTool: null,
            analysis: 'AI recommendation service is temporarily unavailable. Please try selecting a tool manually from the categories below, or try again in a few minutes.',
            similarTools,
            tokensSaved: 0
          }
        };
      }

      // Step 4: Parse AI response
      const responseText = aiResponse.response;
      const toolMatch = responseText.match(/RECOMMENDED_TOOL:\s*(.+?)(?:\n|$)/);
      const analysisMatch = responseText.match(/ANALYSIS:\s*([\s\S]+)/);

      let recommendedTool: DynamicTool | null = null;
      let analysis = responseText;

      if (toolMatch && analysisMatch) {
        const recommendedToolTitle = toolMatch[1].trim();
        analysis = analysisMatch[1].trim();

        // Find the recommended tool in our similar tools list
        const foundSimilarTool = similarTools.find(tool => 
          tool.title.toLowerCase() === recommendedToolTitle.toLowerCase() ||
          tool.title.includes(recommendedToolTitle) ||
          recommendedToolTitle.includes(tool.title)
        );

        if (foundSimilarTool) {
          // Fetch full tool data
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
          }
        }
      }

      // Calculate tokens saved (rough estimate)
      const originalTokens = await this.estimateTokens(userQuery, await this.getAllToolsForEstimate());
      const optimizedTokens = await this.estimateTokens(userQuery, similarTools);
      const tokensSaved = Math.max(0, originalTokens - optimizedTokens);

      Logger.info('Optimized tool recommendation completed', {
        component: 'VectorSearchService',
        queryLength: userQuery.length,
        similarToolsFound: similarTools.length,
        recommendedTool: recommendedTool?.title || 'None',
        tokensSaved,
      });

      return {
        success: true,
        data: {
          recommendedTool,
          analysis,
          similarTools,
          tokensSaved
        }
      };

    } catch (error: any) {
      Logger.error({
        message: 'Vector search recommendation failed',
        code: 'VECTOR_SEARCH_ERROR',
        details: error.message,
        timestamp: new Date().toISOString(),
        correlationId: Logger.getCorrelationId(),
        component: 'VectorSearchService',
        severity: 'error',
      });

      return { success: false, error: error.message };
    }
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