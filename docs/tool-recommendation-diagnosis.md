# Tool Recommendation Deep-Dive Audit & Recovery Blueprint

## 1. Current Execution Path (What Runs Today)
1. **Dashboard & project modals guard on catalogue size.** Both `DashboardView.analyzePromptAndRecommendTool` and `ProjectDetailView.analyzePromptAndRecommendTool` bail out when the memoized `tools` array is empty, so no network request is fired if the hook never hydrates (`components/DashboardView.tsx` line 63 and `components/ProjectDetailView.tsx` line 134).
2. **`useTools` only talks to Supabase Admin APIs.** The hook retries `SupabaseApiService.getAllTools()` three times and then hard-sets an empty cache whenever the admin edge call fails or the auth session is unstable. There is no secondary data source (`hooks/useTools.ts` lines 24-58, 130-147).
3. **Supabase client short-circuits when env vars are missing or placeholder values are used.** `lib/supabase.ts` refuses to instantiate the client until both `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` pass stringent validation, so every downstream service receives `null` in local/demo mode (`lib/supabase.ts` lines 16-88).
4. **Optimized vector path stops immediately without Supabase.** `VectorSearchService.getOptimizedToolRecommendation` exits with `{ success: false, error: 'Supabase not connected' }`, causing the dashboard to flip into the legacy fallback (`services/vectorSearchService.ts` lines 242-290).
5. **Legacy fallback still depends on Supabase edge functions.** `AppApiService.sendChatMessage` returns a canned “demo response” that lacks the `RECOMMENDED_TOOL` tag whenever Supabase is down, so the regex parser never finds a tool even after falling back (`services/app.api.service.ts` lines 135-150).
6. **When Supabase is connected, additional prerequisites exist.**
   - The `generate-embeddings` edge function requires an OpenAI API key to create vectors and invoke the `find_similar_tools` RPC (`supabase/functions/generate-embeddings/index.ts` lines 15-78 and 102-146).
   - The `find_similar_tools` RPC expects populated `tool_embeddings`, active `tools`, and `categories`. Missing migrations or seed data return zero rows, which makes the UI show “No suitable tools found” (`supabase/migrations/20251011211204_phase_4_vector_search_system.sql` lines 14-92 and 100-133).
   - The `ai-chat` edge function demands Anthropic or OpenAI keys before it will produce a structured response (`supabase/functions/ai-chat/index.ts` lines 64-132).

## 2. Precise Failure Modes Observed
| Failure mode | Trigger | Result in UI |
| --- | --- | --- |
| **Empty catalogue guard** | Supabase not configured, session unstable, or admin role denied → `useTools` caches `[]`. | `analyzePromptAndRecommendTool` returns immediately, so no recommendation request is ever sent (`components/DashboardView.tsx` line 63; `components/ProjectDetailView.tsx` line 134). |
| **Vector pipeline disabled** | `supabase` singleton is `null`. | `getOptimizedToolRecommendation` exits early with `success: false`, Dashboard logs “Vector search failed” and cascades to legacy path with no data (`services/vectorSearchService.ts` lines 242-290). |
| **Legacy parser receives demo copy** | Supabase missing, or auth session unstable. | `AppApiService.sendChatMessage` returns a static tutorial string without `RECOMMENDED_TOOL`, regex fails, UI shows generic “AI recommendation service is temporarily unavailable” (`services/app.api.service.ts` lines 135-158; `components/DashboardView.tsx` lines 125-158). |
| **Embeddings RPC failure** | OpenAI key absent or `tool_embeddings` empty. | `generate-embeddings` returns `{ success: false, similarTools: [] }`, causing optimized path to degrade into “Vector search is currently unavailable” response (`supabase/functions/generate-embeddings/index.ts` lines 102-146; `services/vectorSearchService.ts` lines 260-321). |
| **LLM selection missing** | `ai-chat` edge function not deployed or LLM keys missing. | Optimized path gets `aiError`, falls back to top similar tool fetch; if that fetch fails, UI shows manual-selection message (`services/vectorSearchService.ts` lines 348-408). |

The combined effect is that **any single missing dependency (Supabase client, migrations, embeddings, OpenAI/Anthropic keys) stops the pipeline**. There is no local cache, so even perfectly valid prompts hit the first guard and terminate with no recommendation.

## 3. Immediate Recovery Plan (make it work reliably)
### Phase A – Deterministic Local Fallback (no Supabase required)
1. **Ship a static tool catalogue**
   - Add `database/static-tools.json` seeded from production. Include title, category, description, prompt metadata, and precomputed unit-normalized embedding vectors.
   - Version the dataset and document regeneration steps.
2. **Introduce a `ToolRepository` service**
   - Create `services/toolRepository.ts` with `getTools({ allowStale: boolean })` and `getToolById`.
   - Implementation: if `isSupabaseAvailable()` is false or `useTools` gets a non-200 response, read from the static JSON; otherwise hydrate from Supabase and cache locally.
   - Update `useTools` to depend on the repository instead of `SupabaseApiService`, removing the “return []” branch (`hooks/useTools.ts`).
3. **Create a local recommendation engine**
   - Add `services/recommendationEngine.ts` that performs cosine similarity between the user prompt embedding (generated with a lightweight in-browser model such as `text-embedding-3-small` via client-side API) and the static vectors, or uses TF-IDF/Fuse.js scoring.
   - Expose `getRecommendation(prompt, tools)` and always return `{ tool, explanation, similarTools }` even offline.
   - Update `VectorSearchService` to call the local engine when Supabase is absent or any edge invocation fails.
4. **Relax frontend guards and surface status**
   - Replace `if (!userPrompt.trim() || tools.length === 0) return;` with a warning toast plus a call to the repository-backed engine so users still see a suggestion (`components/DashboardView.tsx`, `components/ProjectDetailView.tsx`).
   - Render a badge or banner indicating whether the result came from “Local demo dataset” or “Supabase vector search” so QA can verify which path executed.
5. **Provide operational messaging**
   - Extend the legacy fallback copy to explain which dependency is missing (Supabase URL, migrations, embeddings job, AI keys).
   - Add a diagnostics panel (reusing `VectorSearchStatus`) to show Supabase connection, embeddings availability, and edge function health checks.

### Phase B – Harden the Supabase pipeline
1. **Health-check middleware**
   - Implement `SupabaseHealthService` that pings `getTools`, `find_similar_tools`, and `ai-chat` during startup, caching the status for the UI.
2. **Embedding lifecycle automation**
   - Add a CLI/cron job (`scripts/refresh-embeddings.ts`) that recomputes embeddings when tool content changes. Store `content_hash` and `model_version` in `tool_embeddings` to skip redundant jobs (`supabase/migrations/...` already exposes columns).
3. **Edge function observability**
   - Stream `EdgeLogger` output into a Supabase `edge_logs` table with correlation IDs so support can trace failures end-to-end.
4. **Feature flag rollout**
   - Gate the new hybrid engine behind an environment toggle (`VITE_RECO_ENGINE=hybrid`) to safely switch between local-only, Supabase-only, and hybrid flows during rollout.

## 4. Scalable Architecture for 100+ Tools
### Retrieval & Ranking Strategy
1. **Metadata pre-filtering**: Add a `tool_metadata` JSONB column with arrays of tags (content type, funnel stage, tone, industry). Filter candidates in SQL before vector search to keep latency low.
2. **Vector similarity**: Continue using `pgvector` but move to IVF indexes tuned for thousands of rows (already scaffolded in migration). Store `embedding`, `content_hash`, `model_version`, and `updated_at`.
3. **Learning-to-rank layer**: Log `tool_recommendation_events` (prompt, selected tool, outcome metrics). Train a gradient-boosted or LambdaMART model to re-rank the top ~20 candidates before the LLM call.
4. **LLM reasoning step**: Keep final explanation generation in the `ai-chat` function but pass only the top 3 candidates plus structured metadata to reduce token cost.

### Data Model Additions
- `tool_prompts` table for versioned prompt instructions & examples.
- `tool_capabilities` join table mapping tools to structured capability tags.
- `tool_recommendation_events` capturing prompt features, tool surfaced, user action (accepted/ignored), latency, and fallback path.
- `recommendation_runs` table that logs the end-to-end pipeline (source=local/static/vector, similarity scores, LLM latency) for debugging and analytics.

### Why this is future-proof
- Deterministic local fallback guarantees the UI always returns a tool, even in onboarding, demos, or when edge services are degraded.
- Hybrid pipeline separates concerns: metadata filter for precision, pgvector for recall, LTR for personalization, and LLM for articulation. Each layer can scale independently as the catalogue grows beyond 100 tools.
- Observability tables plus health checks let you detect drift (e.g., embeddings stale, LLM keys revoked) before users notice outages.

## 5. Owner Checklist to Implement
1. **Day 0**: Commit static dataset + repository + local engine. Update `useTools` and dashboard guards. Ship status banner.
2. **Day 1**: Add Supabase health checks and detailed error messaging. Instrument logging tables.
3. **Day 2**: Stand up embedding refresh script & schedule. Document API key requirements for both edge functions.
4. **Day 3**: Implement metadata schema extensions and start logging recommendation events.
5. **Day 4+**: Train initial ranking model from event data, integrate into pipeline, and enable A/B switch via feature flag.

Following the above plan removes every single-point-of-failure currently blocking recommendations and lays the groundwork for a resilient, scalable engine that keeps working as you onboard 100+ complex tools.
