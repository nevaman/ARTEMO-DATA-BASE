import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const allowedStaticHosts = new Set([
  'https.bolt.new',
  'https.stackblitz.com',
  'main.artemo.ai',
  'artemo.vercel.app',
]);

const dynamicOriginPatterns = [
  /\.local-credentialless\.webcontainer-api\.io$/,
  /\.w-credentialless-staticblitz\.com$/,
];

function resolveAllowedOrigin(originHeader: string | null): string | null {
  if (!originHeader) {
    return null;
  }

  try {
    const originUrl = new URL(originHeader);
    if (originUrl.protocol !== 'https:') {
      return null;
    }

    if (allowedStaticHosts.has(originUrl.host)) {
      return originUrl.origin;
    }

    if (dynamicOriginPatterns.some((pattern) => pattern.test(originUrl.host))) {
      return originUrl.origin;
    }
  } catch (_error) {
    return null;
  }

  return null;
}

function createCorsHeaders(originHeader: string | null) {
  const allowedOrigin = resolveAllowedOrigin(originHeader);

  return {
    'Access-Control-Allow-Origin': allowedOrigin ?? 'null',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

interface EmbeddingRequest {
  toolId?: string;
  text?: string;
  action: 'generate_tool_embedding' | 'generate_query_embedding';
}

async function generateEmbedding(text: string): Promise<number[]> {
  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiKey) {
    throw new Error('OpenAI API key not configured');
  }

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-ada-002',
      input: text,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`OpenAI API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

serve(async (req: Request) => {
  const originHeader = req.headers.get('origin');
  const corsHeaders = createCorsHeaders(originHeader);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { toolId, text, action }: EmbeddingRequest = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    if (action === 'generate_tool_embedding') {
      if (!toolId) {
        return new Response(
          JSON.stringify({ error: 'Tool ID is required for tool embedding generation' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get tool content for embedding
      const { data: toolContent, error: contentError } = await supabase
        .rpc('get_tool_content_for_embedding', { tool_id_param: toolId });

      if (contentError || !toolContent) {
        return new Response(
          JSON.stringify({ error: 'Failed to get tool content' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Generate embedding
      const embedding = await generateEmbedding(toolContent);
      const contentHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(toolContent))
        .then(buffer => Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join(''));

      // Store embedding
      const { error: upsertError } = await supabase
        .from('tool_embeddings')
        .upsert({
          tool_id: toolId,
          embedding: `[${embedding.join(',')}]`,
          content_hash: contentHash,
        }, {
          onConflict: 'tool_id'
        });

      if (upsertError) {
        console.error('Failed to upsert tool embedding:', upsertError);
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Failed to store tool embedding',
            details: upsertError.message
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Tool embedding generated successfully' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'generate_query_embedding') {
      if (!text) {
        return new Response(
          JSON.stringify({ error: 'Text is required for query embedding generation' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Generate embedding for user query
      const embedding = await generateEmbedding(text);

      // Find similar tools using vector search
      const { data: similarTools, error: vectorSearchError } = await supabase
        .rpc('find_similar_tools', {
          query_embedding: `[${embedding.join(',')}]`,
          similarity_threshold: 0.6,
          max_results: 5
        });

      if (vectorSearchError) {
        console.error('Vector search RPC failed:', vectorSearchError);
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Vector search failed',
            details: vectorSearchError.message,
            similarTools: [] // Return empty array instead of failing
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          similarTools: similarTools || [],
          embedding: embedding
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Embedding generation error:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to process embedding request',
        details: error.message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});