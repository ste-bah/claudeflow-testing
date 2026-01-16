/**
 * ApiService - HTTP client for backend communication
 *
 * Provides methods to fetch data from the Express observability server
 * at localhost:3847. Falls back gracefully when server is unavailable.
 *
 * @module services/api/ApiService
 */

const DEFAULT_BASE_URL = 'http://localhost:3847';

/**
 * Configuration for the API service
 */
export interface ApiConfig {
  /** Base URL of the backend server */
  baseUrl: string;
  /** Request timeout in milliseconds */
  timeout?: number;
}

/**
 * Raw event from the backend API
 */
export interface ApiEvent {
  id: string;
  timestamp: number;
  component: string;
  operation: string;
  status: string;
  duration_ms?: number | null;
  metadata: Record<string, unknown>;
  trace_id?: string | null;
  span_id?: string | null;
  created_at: number;
}

/**
 * Raw agent from the backend API
 */
export interface ApiAgent {
  id: string;
  name: string;
  type?: string;
  category?: string;
  status: string;
  lastSeen: number;
  taskCount: number;
  pipelineId?: string;
}

/**
 * Raw pipeline from the backend API
 */
export interface ApiPipeline {
  id: string;
  name: string;
  status: string;
  totalSteps: number;
  completedSteps: number;
  currentStep: string | null;
  steps: string[];
  stages: Array<{
    name: string;
    status: string;
    agentType?: string;
    phase?: string;
    startTime: number;
    endTime?: number;
  }>;
  startTime: number;
  duration: number;
  taskType: string;
  progress?: number;
}

/**
 * Memory episode from the backend
 */
export interface ApiEpisode {
  id: string;
  type: string;
  domain: string;
  timestamp: number;
  linked: boolean;
}

/**
 * Memory pattern from the backend
 */
export interface ApiPattern {
  id: string;
  quality: number;
  outcome: string;
  timestamp: number;
}

/**
 * Learning statistics from the backend
 */
export interface ApiLearningStats {
  totalTrajectories: number;
  baselineQuality: number;
  learnedQuality: number;
  improvement: number;
  patternsLearned: number;
  adaptations: number;
  feedbackCount: number;
  lastUpdated: string;
}

/**
 * Health check response
 */
export interface ApiHealthResponse {
  status: string;
  uptime: number;
  clientCount: number;
  eventCount: number;
  bufferUsage: number;
  dbSize: number;
}

/**
 * ApiService class for backend communication
 */
class ApiService {
  private baseUrl: string;
  private timeout: number;

  constructor(config: ApiConfig = { baseUrl: DEFAULT_BASE_URL }) {
    this.baseUrl = config.baseUrl;
    this.timeout = config.timeout ?? 30000;
  }

  /**
   * Check if the backend server is available
   * @returns Promise<boolean> - true if server is healthy
   */
  async health(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/health`, {
        signal: AbortSignal.timeout(5000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get health details from the backend
   * @returns Promise<ApiHealthResponse>
   */
  async getHealthDetails(): Promise<ApiHealthResponse> {
    const res = await fetch(`${this.baseUrl}/api/health`, {
      signal: AbortSignal.timeout(this.timeout),
    });
    if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
    return res.json();
  }

  /**
   * Fetch historical events from the backend
   * @param limit - Maximum number of events to fetch
   * @returns Promise<ApiEvent[]>
   */
  async getEvents(limit = 10000): Promise<ApiEvent[]> {
    const res = await fetch(`${this.baseUrl}/api/events?limit=${limit}`, {
      signal: AbortSignal.timeout(this.timeout),
    });
    if (!res.ok) throw new Error(`Failed to fetch events: ${res.status}`);
    const data = await res.json();
    return data.events ?? data;
  }

  /**
   * Fetch active agents from the backend
   * @returns Promise<ApiAgent[]>
   */
  async getAgents(): Promise<ApiAgent[]> {
    const res = await fetch(`${this.baseUrl}/api/agents`, {
      signal: AbortSignal.timeout(this.timeout),
    });
    if (!res.ok) throw new Error(`Failed to fetch agents: ${res.status}`);
    const data = await res.json();
    return data.agents ?? data;
  }

  /**
   * Fetch active pipelines from the backend
   * @returns Promise<ApiPipeline[]>
   */
  async getPipelines(): Promise<ApiPipeline[]> {
    const res = await fetch(`${this.baseUrl}/api/pipelines`, {
      signal: AbortSignal.timeout(this.timeout),
    });
    if (!res.ok) throw new Error(`Failed to fetch pipelines: ${res.status}`);
    const data = await res.json();
    return data.pipelines ?? data;
  }

  /**
   * Fetch memory episodes from the backend
   * @returns Promise<ApiEpisode[]>
   */
  async getMemoryEpisodes(): Promise<ApiEpisode[]> {
    const res = await fetch(`${this.baseUrl}/api/memory/episodes`, {
      signal: AbortSignal.timeout(this.timeout),
    });
    if (!res.ok) throw new Error(`Failed to fetch episodes: ${res.status}`);
    const data = await res.json();
    return data.recentEpisodes ?? data.episodes ?? [];
  }

  /**
   * Fetch memory patterns from the backend
   * @returns Promise<ApiPattern[]>
   */
  async getMemoryPatterns(): Promise<ApiPattern[]> {
    const res = await fetch(`${this.baseUrl}/api/memory/patterns`, {
      signal: AbortSignal.timeout(this.timeout),
    });
    if (!res.ok) throw new Error(`Failed to fetch patterns: ${res.status}`);
    const data = await res.json();
    return data.patterns ?? [];
  }

  /**
   * Fetch memory reasoning data from the backend
   * @returns Promise<{ stats: object; recentPatterns: ApiPattern[] }>
   */
  async getMemoryReasoning(): Promise<{ stats: Record<string, unknown>; recentPatterns: ApiPattern[] }> {
    const res = await fetch(`${this.baseUrl}/api/memory/reasoning`, {
      signal: AbortSignal.timeout(this.timeout),
    });
    if (!res.ok) throw new Error(`Failed to fetch reasoning: ${res.status}`);
    return res.json();
  }

  /**
   * Fetch learning statistics from the backend
   * @returns Promise<ApiLearningStats>
   */
  async getLearningStats(): Promise<ApiLearningStats> {
    const res = await fetch(`${this.baseUrl}/api/learning/stats`, {
      signal: AbortSignal.timeout(this.timeout),
    });
    if (!res.ok) throw new Error(`Failed to fetch learning stats: ${res.status}`);
    return res.json();
  }

  /**
   * Fetch system metrics from the backend
   * @returns Promise<object>
   */
  async getSystemMetrics(): Promise<Record<string, unknown>> {
    const res = await fetch(`${this.baseUrl}/api/system/metrics`, {
      signal: AbortSignal.timeout(this.timeout),
    });
    if (!res.ok) throw new Error(`Failed to fetch system metrics: ${res.status}`);
    return res.json();
  }

  /**
   * Update the base URL for the API service
   * @param url - New base URL
   */
  setBaseUrl(url: string): void {
    this.baseUrl = url;
  }

  /**
   * Get the current base URL
   * @returns Current base URL
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }
}

// Export singleton instance
export const apiService = new ApiService();

// Export class for testing
export { ApiService };

export default apiService;
