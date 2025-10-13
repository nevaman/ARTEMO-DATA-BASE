import staticTools from '../database/static-tools.json';
import { SupabaseApiService } from './supabaseApi';
import { isSupabaseAvailable } from '../lib/supabase';
import { Logger } from '../utils/logger';
import type { DynamicTool, ToolQuestion } from '../types';

export type ToolDataSource = 'supabase' | 'static';

interface RepositoryOptions {
  allowStale?: boolean;
}

interface RepositoryResult {
  tools: DynamicTool[];
  source: ToolDataSource;
}

interface SearchDocument {
  tool: DynamicTool;
  text: string;
}

type RawStaticTool = Omit<DynamicTool, 'questions'> & {
  questions: (ToolQuestion & { order?: number })[];
  searchSummary?: string;
  keywords?: string[];
};

type StaticMetadata = {
  searchSummary?: string;
  keywords?: string[];
};

export class ToolRepository {
  private static instance: ToolRepository;
  private cache: DynamicTool[] | null = null;
  private cacheSource: ToolDataSource = 'static';
  private searchDocuments: SearchDocument[] = [];
  private staticTools: DynamicTool[] = [];
  private staticMetadata: Map<string, StaticMetadata> = new Map();
  private api = SupabaseApiService.getInstance();

  static getInstance(): ToolRepository {
    if (!ToolRepository.instance) {
      ToolRepository.instance = new ToolRepository();
    }
    return ToolRepository.instance;
  }

  private constructor() {
    this.bootstrapStaticDataset();
  }

  private bootstrapStaticDataset() {
    const parsed = (staticTools as RawStaticTool[]).map((tool) => {
      const { searchSummary, keywords, questions, ...rest } = tool;
      const normalizedQuestions = (questions || []).map((question, index) => ({
        ...question,
        order: question.order ?? index + 1,
        required: question.required ?? false,
      }));

      if (searchSummary || keywords) {
        this.staticMetadata.set(tool.id, {
          searchSummary,
          keywords,
        });
      }

      return {
        ...rest,
        questions: normalizedQuestions,
      } as DynamicTool;
    });

    this.staticTools = parsed;
    this.rebuildSearchDocuments(parsed, 'static');
  }

  private rebuildSearchDocuments(tools: DynamicTool[], source: ToolDataSource) {
    this.searchDocuments = tools.map((tool) => ({
      tool,
      text: this.composeSearchText(tool, source),
    }));
  }

  private composeSearchText(tool: DynamicTool, source: ToolDataSource): string {
    const questionLabels = (tool.questions || [])
      .map((question) => question.label)
      .join(' ');

    const promptInstructions = tool.promptInstructions ?? '';

    const metadata = this.staticMetadata.get(tool.id);
    const extra = metadata
      ? [metadata.searchSummary, ...(metadata.keywords || [])].join(' ')
      : '';

    return [
      tool.title,
      tool.category,
      tool.description,
      promptInstructions,
      questionLabels,
      extra,
      source === 'supabase' ? '' : 'local demo dataset',
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
  }

  async getTools(options: RepositoryOptions = {}): Promise<RepositoryResult> {
    const { allowStale = true } = options;

    if (this.cache && allowStale) {
      return { tools: this.cache, source: this.cacheSource };
    }

    if (isSupabaseAvailable()) {
      try {
        const response = await this.api.getAllTools();
        if (response.success && response.data) {
          this.cache = response.data;
          this.cacheSource = 'supabase';
          this.rebuildSearchDocuments(response.data, 'supabase');
          return { tools: response.data, source: 'supabase' };
        }

        Logger.warn('ToolRepository: Falling back to static dataset after Supabase error', {
          error: response.error,
        });
      } catch (error) {
        Logger.warn('ToolRepository: Supabase fetch failed, using static dataset', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    this.cache = this.staticTools;
    this.cacheSource = 'static';
    this.rebuildSearchDocuments(this.staticTools, 'static');
    return { tools: this.staticTools, source: 'static' };
  }

  async getSearchableTools(options: RepositoryOptions = {}): Promise<{
    tools: DynamicTool[];
    documents: SearchDocument[];
    source: ToolDataSource;
  }> {
    const result = await this.getTools(options);

    if (this.cache !== result.tools || this.searchDocuments.length === 0) {
      this.rebuildSearchDocuments(result.tools, result.source);
    }

    return {
      tools: result.tools,
      documents: this.searchDocuments,
      source: result.source,
    };
  }

  async getToolById(id: string): Promise<DynamicTool | null> {
    if (!this.cache) {
      await this.getTools();
    }

    const fromCache = this.cache?.find((tool) => tool.id === id);
    if (fromCache) {
      return fromCache;
    }

    return this.staticTools.find((tool) => tool.id === id) ?? null;
  }

  getMetadata(toolId: string): StaticMetadata | undefined {
    return this.staticMetadata.get(toolId);
  }

  invalidateCache() {
    this.cache = null;
  }
}
