/**
 * RLM Context Store — Context-as-Environment pattern (PRD Section 6)
 *
 * Implements:
 * - Namespace-based external context storage
 * - REPL operations (read/write/retrieve)
 * - Selective retrieval via LEANN for 10M+ token handling
 * - llm_query() recursive sub-call infrastructure
 * - Session persistence
 */
export interface ILLMRequest {
    context: string;
    prompt: string;
    config: {
        model: 'opus' | 'sonnet' | 'haiku';
        maxTokens: number;
        temperature: number;
    };
    metadata?: {
        agentId: string;
        phase: number;
        taskId: string;
        parentRequestId?: string;
        depth?: number;
    };
}
export interface ILLMResponse {
    content: string;
    usage: {
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
        contextTokens: number;
    };
    metadata: {
        requestId: string;
        model: string;
        latencyMs: number;
        finishReason: string;
        depth: number;
    };
}
export interface IRLMContextStore {
    read(namespace: string): string | undefined;
    write(namespace: string, content: string): void;
    retrieve(query: string, namespaces: string[], maxTokens: number): Promise<string>;
    llmQuery(request: ILLMRequest): Promise<ILLMResponse>;
    save(path: string): Promise<void>;
    load(path: string): Promise<boolean>;
    getTokenCount(namespace: string): number;
    getTotalTokenCount(): number;
    getNamespaces(): string[];
}
export declare class RLMContextStore implements IRLMContextStore {
    private options?;
    private store;
    private leannService?;
    constructor(options?: {
        leannService?: typeof RLMContextStore.prototype.leannService;
        maxRecursionDepth?: number;
    } | undefined);
    read(namespace: string): string | undefined;
    write(namespace: string, content: string): void;
    retrieve(query: string, namespaces: string[], maxTokens: number): Promise<string>;
    llmQuery(request: ILLMRequest): Promise<ILLMResponse>;
    save(path: string): Promise<void>;
    load(path: string): Promise<boolean>;
    getTokenCount(namespace: string): number;
    getTotalTokenCount(): number;
    getNamespaces(): string[];
    private estimateTokens;
}
//# sourceMappingURL=rlm-context-store.d.ts.map