import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// --- (Interfaces and Error Handling code remains the same) ---

interface ErrorResponse {
  message: string;
  code: string;
  details?: string;
  timestamp: string;
  correlationId?: string;
  component: string;
  severity: 'info' | 'warn' | 'error' | 'critical';
  retryCount?: number;
}

interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'critical';
  message: string;
  correlationId?: string;
  component: string;
  context?: Record<string, any>;
  error?: ErrorResponse;
}

class EdgeLogger {
  private static createLogEntry(
    level: 'info' | 'warn' | 'error' | 'critical',
    message: string,
    correlationId?: string,
    context?: Record<string, any>,
    error?: ErrorResponse
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      correlationId: correlationId || crypto.randomUUID(),
      component: 'ai-chat-function',
      context,
      error,
    };
  }

  static info(message: string, correlationId?: string, context?: Record<string, any>) {
    const logEntry = this.createLogEntry('info', message, correlationId, context);
    console.log(JSON.stringify(logEntry));
  }

  static warn(message: string, correlationId?: string, context?: Record<string, any>) {
    const logEntry = this.createLogEntry('warn', message, correlationId, context);
    console.warn(JSON.stringify(logEntry));
  }

  static error(error: ErrorResponse, correlationId?: string, context?: Record<string, any>) {
    const logEntry = this.createLogEntry('error', error.message, correlationId, context, error);
    console.error(JSON.stringify(logEntry));
  }

  static critical(error: ErrorResponse, correlationId?: string, context?: Record<string, any>) {
    const logEntry = this.createLogEntry('critical', error.message, correlationId, context, error);
    console.error(JSON.stringify(logEntry));
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-correlation-id',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function createErrorResponse(
  message: string,
  code: string,
  details?: string,
  severity: 'info' | 'warn' | 'error' | 'critical' = 'error',
  correlationId?: string
): ErrorResponse {
  return { message, code, details, timestamp: new Date().toISOString(), correlationId, component: 'ai-chat-function', severity };
}

function respondWithError(error: ErrorResponse, statusCode: number = 500, correlationId?: string): Response {
  EdgeLogger.error(error, correlationId);
  return new Response(JSON.stringify({ error }), { status: statusCode, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function callClaude(prompt: string, messages: any[], correlationId?: string): Promise<string> {
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!anthropicKey) throw new Error('Anthropic API key not configured');
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': anthropicKey, 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-sonnet-4-5-20250929', max_tokens: 2000, system: prompt, messages: messages.map(m => ({ role: m.sender === 'user' ? 'user' : 'assistant', content: m.text })) })
  });
  if (!response.ok) { const errorData = await response.json().catch(() => ({})); throw new Error(`Claude API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`); }
  const data = await response.json();
  return data.content[0].text;
}

async function callOpenAI(prompt: string, messages: any[], correlationId?: string): Promise<string> {
  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiKey) throw new Error('OpenAI API key not configured');
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'system', content: prompt }, ...messages.map(m => ({ role: m.sender === 'user' ? 'user' : 'assistant', content: m.text }))], max_tokens: 2000, temperature: 0.7 })
  });
  if (!response.ok) { const errorData = await response.json().catch(() => ({})); throw new Error(`OpenAI API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`); }
  const data = await response.json();
  return data.choices[0].message.content;
}

// --- START: CORRECTED FUNCTION ---
async function callAIWithFallback(
    toolConfig: any,
    messages: any[],
    knowledgeBaseId?: string,
    clientProfile?: any,
    correlationId?: string
): Promise<string> {
    const models = [toolConfig.primary_model, ...(toolConfig.fallback_models || [])];
    let lastError: any;

    // Step 1: Initialize a variable to hold our knowledge base text.
    let knowledgeBaseContent = '';

    // Step 2: Fetch content from the database if a knowledgeBaseId is provided.
    if (knowledgeBaseId) {
        try {
            const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
            const { data: kbFile, error: kbError } = await supabase
                .from('knowledge_base_files')
                .select('processed_content')
                .eq('id', knowledgeBaseId)
                .single();

            if (kbError) {
                // Log the error but don't stop the process
                EdgeLogger.error(createErrorResponse('Database query for knowledge base file failed.', 'KB_FETCH_ERROR', kbError.message, 'error', correlationId));
            } else if (kbFile?.processed_content) {
                // If successful, store the content
                knowledgeBaseContent = kbFile.processed_content;
            }
        } catch (kbFetchError) {
            EdgeLogger.warn('Exception during knowledge base fetch.', correlationId, {
                knowledgeBaseId,
                error: kbFetchError instanceof Error ? kbFetchError.message : 'Unknown error',
            });
        }
    }

    // Step 3: Combine with any permanent knowledge base from the tool's configuration.
    const permanentKb = toolConfig.knowledge_base_file?.processed_content || '';
    if (permanentKb) {
        knowledgeBaseContent = permanentKb + '\n\n' + knowledgeBaseContent;
    }

    // Step 4: Build the final prompt, adding context blocks if they exist.
    let enhancedPrompt = toolConfig.prompt_instructions;

    if (clientProfile) {
        const clientContext = `You are writing for a client named "${clientProfile.name}". Their target audience is: ${clientProfile.audience}. Write in a ${clientProfile.tone} tone and ${clientProfile.language} language.${clientProfile.sample ? ` Here is a sample of their preferred writing style: "${clientProfile.sample}"` : ''}`;
        enhancedPrompt = `${clientContext}\n\n${enhancedPrompt}`;
    }
    
    // This now correctly checks the fetched content and appends it.
    if (knowledgeBaseContent.trim()) {
        enhancedPrompt += `\n\nKnowledge Base Context:\n${knowledgeBaseContent.trim()}`;
    }

    // Step 5: Loop through AI models with the complete prompt.
    for (let i = 0; i < models.length; i++) {
        const model = models[i];
        try {
            let response: string;
            switch (model.toLowerCase()) {
                case 'claude':
                    response = await callClaude(enhancedPrompt, messages, correlationId);
                    break;
                case 'openai':
                case 'chatgpt':
                case 'gpt-4':
                    response = await callOpenAI(enhancedPrompt, messages, correlationId);
                    break;
                default:
                    throw new Error(`Unsupported AI model: ${model}`);
            }
            return response;
        } catch (error: any) {
            lastError = error;
            EdgeLogger.error(createErrorResponse(`AI model ${model} failed`, getAIErrorCode(error), error.message, 'error', correlationId), correlationId);
            if (i < models.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }
    throw lastError;
}
// --- END: CORRECTED FUNCTION ---

function getAIErrorCode(error: any): string {
    const errorMessage = error.message?.toLowerCase() || '';
    if (errorMessage.includes('rate limit')) return 'AI_RATE_LIMIT_EXCEEDED';
    if (errorMessage.includes('unavailable') || errorMessage.includes('timeout')) return 'AI_MODEL_UNAVAILABLE';
    if (errorMessage.includes('content policy') || errorMessage.includes('violation')) return 'AI_CONTENT_POLICY_VIOLATION';
    if (errorMessage.includes('token') || errorMessage.includes('length')) return 'AI_TOKEN_LIMIT_EXCEEDED';
    if (errorMessage.includes('network') || errorMessage.includes('fetch')) return 'AI_NETWORK_ERROR';
    return 'AI_UNKNOWN_ERROR';
}

serve(async (req: Request) => {
    const correlationId = req.headers.get('x-correlation-id') || crypto.randomUUID();
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const requestBody = await req.json();
        const { toolId, messages, knowledgeBaseId, clientProfile } = requestBody;

        EdgeLogger.info("Received request from frontend", correlationId, {
            toolId,
            messageCount: messages?.length || 0,
            hasKnowledgeBaseId: !!knowledgeBaseId,
            knowledgeBaseId: knowledgeBaseId,
        });

        if (!toolId) return respondWithError(createErrorResponse('Tool ID is required', 'MISSING_TOOL_ID', undefined, 'warn', correlationId), 400);
        if (!messages || !Array.isArray(messages)) return respondWithError(createErrorResponse('Messages array is required', 'INVALID_MESSAGES', undefined, 'warn', correlationId), 400);
        
        const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

        const { data: toolConfig, error: toolError } = await supabase
            .from('tools')
            .select(`*, knowledge_base_file:knowledge_base_files(processed_content)`)
            .eq('id', toolId)
            .single();

        if (toolError || !toolConfig) {
            return respondWithError(createErrorResponse('Tool not found or inactive', 'TOOL_NOT_FOUND', toolError?.message, 'warn', correlationId), 404);
        }
        
        const aiResponse = await callAIWithFallback(
            toolConfig,
            messages,
            knowledgeBaseId,
            clientProfile,
            correlationId
        );
        
        const authHeader = req.headers.get('authorization');
        if (authHeader) {
            try {
                const token = authHeader.replace('Bearer ', '');
                const { data: { user } } = await supabase.auth.getUser(token);
                if (user) {
                    await supabase.from('usage_analytics').insert({
                        user_id: user.id,
                        tool_id: toolId,
                        action_type: 'ai_chat_completion',
                        metadata: {
                            model_used: toolConfig.primary_model,
                            // --- FIX: Corrected variable name from `knowledgeBase` to `knowledgeBaseId` ---
                            had_knowledge_base: !!knowledgeBaseId || !!toolConfig.knowledge_base_file_id,
                        }
                    });
                }
            } catch (analyticsError) {
                EdgeLogger.warn('Failed to log usage analytics', correlationId, { error: analyticsError instanceof Error ? analyticsError.message : 'Unknown error' });
            }
        }
        
        return new Response(
            JSON.stringify({ response: aiResponse }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json', 'x-correlation-id': correlationId } }
        );

    } catch (error: any) {
        return respondWithError(createErrorResponse('Failed to process AI chat request', 'AI_CHAT_PROCESSING_ERROR', error.message, 'error', correlationId), 500);
    }
});