import { ToolRepository } from './toolRepository';
import type { DynamicTool } from '../types';

interface TermVector {
  [term: string]: number;
}

export interface RecommendationScore {
  tool: DynamicTool;
  similarity: number;
}

export interface LocalRecommendationResult {
  recommendedTool: DynamicTool | null;
  analysis: string;
  scores: RecommendationScore[];
  sourceLabel: string;
}

export class RecommendationEngine {
  private static instance: RecommendationEngine;
  private repository = ToolRepository.getInstance();

  static getInstance(): RecommendationEngine {
    if (!RecommendationEngine.instance) {
      RecommendationEngine.instance = new RecommendationEngine();
    }
    return RecommendationEngine.instance;
  }

  private constructor() {}

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length > 2);
  }

  private computeTf(tokens: string[]): TermVector {
    const tf: TermVector = {};
    tokens.forEach((token) => {
      tf[token] = (tf[token] || 0) + 1;
    });

    const total = tokens.length || 1;
    Object.keys(tf).forEach((term) => {
      tf[term] = tf[term] / total;
    });
    return tf;
  }

  private computeIdf(documents: string[][]): TermVector {
    const idf: TermVector = {};
    const totalDocs = documents.length || 1;

    documents.forEach((tokens) => {
      const unique = new Set(tokens);
      unique.forEach((token) => {
        idf[token] = (idf[token] || 0) + 1;
      });
    });

    Object.keys(idf).forEach((term) => {
      idf[term] = Math.log((1 + totalDocs) / (1 + idf[term])) + 1;
    });

    return idf;
  }

  private computeTfIdf(tf: TermVector, idf: TermVector): TermVector {
    const vector: TermVector = {};
    Object.keys(tf).forEach((term) => {
      vector[term] = (tf[term] || 0) * (idf[term] || 0);
    });
    return vector;
  }

  private cosineSimilarity(a: TermVector, b: TermVector): number {
    const allTerms = new Set([...Object.keys(a), ...Object.keys(b)]);
    let dot = 0;
    let aMag = 0;
    let bMag = 0;

    allTerms.forEach((term) => {
      const aVal = a[term] || 0;
      const bVal = b[term] || 0;
      dot += aVal * bVal;
      aMag += aVal * aVal;
      bMag += bVal * bVal;
    });

    if (aMag === 0 || bMag === 0) {
      return 0;
    }

    return dot / (Math.sqrt(aMag) * Math.sqrt(bMag));
  }

  private buildExplanation(tool: DynamicTool, overlap: string[], sourceLabel: string): string {
    const highlight = overlap.length > 0 ? ` Key overlaps: ${overlap.slice(0, 3).join(', ')}.` : '';
    return `Using our ${sourceLabel}, we recommend ${tool.title} for ${tool.category.toLowerCase()} work. ${tool.description}${highlight}`;
  }

  private buildSourceLabel(source: string): string {
    return source === 'supabase' ? 'Supabase catalogue snapshot' : 'local demo catalogue';
  }

  async getRecommendation(userQuery: string): Promise<LocalRecommendationResult> {
    const { documents, source } = await this.repository.getSearchableTools();

    if (!userQuery.trim() || documents.length === 0) {
      return {
        recommendedTool: null,
        analysis: 'No tools are available yet. Please add tools in the admin panel.',
        scores: [],
        sourceLabel: this.buildSourceLabel(source),
      };
    }

    const documentTokens = documents.map((doc) => this.tokenize(doc.text));
    const idf = this.computeIdf(documentTokens);
    const docVectors = documentTokens.map((tokens) => this.computeTfIdf(this.computeTf(tokens), idf));

    const queryTokens = this.tokenize(userQuery);
    if (queryTokens.length === 0) {
      return {
        recommendedTool: null,
        analysis: 'Please provide more detail so we can suggest a tool.',
        scores: [],
        sourceLabel: this.buildSourceLabel(source),
      };
    }

    const queryVector = this.computeTfIdf(this.computeTf(queryTokens), idf);

    const scores = documents.map((doc, index) => ({
      tool: doc.tool,
      similarity: Number(this.cosineSimilarity(queryVector, docVectors[index]).toFixed(4)),
    }));

    const ordered = scores.sort((a, b) => b.similarity - a.similarity);
    const positive = ordered.filter((item) => item.similarity > 0);
    const bestMatch = positive[0] ?? ordered[0] ?? null;

    if (!bestMatch || bestMatch.similarity === 0) {
      return {
        recommendedTool: null,
        analysis: 'We could not find a close match. Try adding more context about your goal, audience, or deliverable.',
        scores: ordered.slice(0, 5),
        sourceLabel: this.buildSourceLabel(source),
      };
    }

    const overlapTerms = queryTokens.filter((token) =>
      this.tokenize(documents.find((doc) => doc.tool.id === bestMatch.tool.id)?.text || '').includes(token)
    );

    return {
      recommendedTool: bestMatch.tool,
      analysis: this.buildExplanation(bestMatch.tool, overlapTerms, this.buildSourceLabel(source)),
      scores: ordered.slice(0, 5),
      sourceLabel: this.buildSourceLabel(source),
    };
  }
}
