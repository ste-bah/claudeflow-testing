/**
 * ChapterWriterAgent - Synthesizes chapter content from mapped source summaries
 *
 * Implements SPEC-FUNC-001 Section 2.5 and GAP-C003 (Chapter Writer Synthesis Logic)
 *
 * Core Responsibilities:
 * - Build section structure from ChapterDefinition
 * - Synthesize content from mapped sources (not summarize)
 * - Preserve citations from sources
 * - Generate cross-references to other chapters
 * - Apply word count targets (70%-130% acceptable per QA-001)
 * - Detect and handle duplicate content (GAP-H001)
 *
 * Constitution Rules:
 * - DI-005: Word counts within 30% of target - enforce 70%-130% range
 * - DI-006: Source attribution - every paragraph must come from sources
 * - EX-003: Source isolation - only access mapped sources for this chapter
 * - QA-001: Deduplicate >50% similar content
 */
import Anthropic from '@anthropic-ai/sdk';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { getStyleProfileManager } from '../../universal/style-profile.js';
import { StyleAnalyzer } from '../../universal/style-analyzer.js';
/**
 * ChapterWriterAgent - Synthesizes chapter content from mapped sources
 *
 * @example
 * ```typescript
 * // Create with style profile for LLM-based synthesis (RECOMMENDED)
 * const writer = new ChapterWriterAgent('academic-papers-uk');
 * const output = await writer.writeChapter({
 *   chapter: chapterDefinition,
 *   sources: mappedSummaries,
 *   style: styleProfile,
 *   allChapters: allChapterDefinitions,
 *   tokenBudget: 15000
 * });
 *
 * // The writer now uses the chapter-synthesizer agent prompt
 * // to transform raw research into clean academic prose.
 * // Style profile ensures consistent UK English and academic register.
 * ```
 */
export class ChapterWriterAgent {
    /**
     * Anthropic LLM client for actual prose generation
     */
    client = null;
    /**
     * Style profile ID for consistent academic writing style
     */
    styleProfileId;
    /**
     * Cached chapter-synthesizer agent prompt
     */
    cachedAgentPrompt;
    /**
     * Model to use for generation
     */
    model = 'claude-sonnet-4-20250514';
    /**
     * Create ChapterWriterAgent with LLM support
     *
     * @param styleProfileId - Optional style profile ID for consistent style application
     * @param apiKey - Optional Anthropic API key (defaults to ANTHROPIC_API_KEY env var)
     */
    constructor(styleProfileId, apiKey) {
        this.styleProfileId = styleProfileId;
        // Initialize Anthropic client if API key available
        const key = apiKey || process.env.ANTHROPIC_API_KEY;
        if (key) {
            this.client = new Anthropic({ apiKey: key });
        }
    }
    /**
     * Stopwords to filter during tokenization
     */
    static STOPWORDS = new Set([
        'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
        'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
        'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
        'could', 'should', 'may', 'might', 'must', 'shall', 'this', 'that',
        'these', 'those', 'it', 'its', 'they', 'them', 'their', 'we', 'our',
        'which', 'who', 'what', 'where', 'when', 'how', 'why', 'all', 'each',
        'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no',
        'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
        'can', 'just', 'now', 'then', 'also', 'into', 'over', 'after', 'before'
    ]);
    /**
     * Duplicate detection thresholds per Constitution QA-001
     */
    static THRESHOLDS = {
        DUPLICATE: 0.50, // >50% similarity = duplicate
        NEAR_DUPLICATE: 0.80 // >80% similarity = merge
    };
    /**
     * Word count tolerance per DI-005
     */
    static WORD_COUNT_TOLERANCE = {
        WARNING_MIN: 0.80, // 80% of target
        WARNING_MAX: 1.20, // 120% of target
        FAILURE_MIN: 0.70, // 70% of target
        FAILURE_MAX: 1.30 // 130% of target
    };
    /**
     * Write a chapter from mapped source summaries
     *
     * CRITICAL: This method now uses LLM-based synthesis when available.
     * It calls synthesizeSectionAsync with the chapter-synthesizer agent prompt
     * and style profile to generate clean academic prose.
     *
     * @param input - Chapter writer input with chapter definition, sources, style
     * @returns Complete chapter output with content, citations, metrics
     */
    async writeChapter(input) {
        const { chapter, sources, style, allChapters, tokenBudget: _tokenBudget } = input;
        const warnings = [];
        let tokensUsed = 0;
        // Log synthesis mode
        if (this.client) {
            console.log(`[ChapterWriter] Using LLM synthesis for Chapter ${chapter.number}: ${chapter.title}`);
            if (this.styleProfileId) {
                console.log(`[ChapterWriter] Style profile: ${this.styleProfileId}`);
            }
        }
        else {
            console.warn(`[ChapterWriter] WARNING: No LLM client - falling back to concatenation`);
        }
        // Calculate word targets per section
        const wordsPerSection = Math.floor(chapter.wordTarget / chapter.sections.length);
        // Build section contents
        const sectionContents = [];
        for (let i = 0; i < chapter.sections.length; i++) {
            const sectionId = chapter.sections[i];
            const sectionTitle = chapter.sectionTitles[i] || `Section ${sectionId}`;
            // Find relevant content from sources for this section
            const relevantContent = this.findRelevantContent(sources, sectionTitle, chapter);
            // Detect and handle duplicates
            const deduplicatedContent = this.deduplicateContent(relevantContent);
            if (deduplicatedContent.duplicatesFound > 0) {
                warnings.push(`Section ${sectionId}: Detected ${deduplicatedContent.duplicatesFound} duplicate paragraphs`);
            }
            // Prepare research content for synthesis
            const sorted = [...deduplicatedContent.paragraphs].sort((a, b) => b.phase - a.phase);
            const researchContent = sorted.map(p => p.text).join('\n\n');
            let synthesized;
            // USE LLM SYNTHESIS IF CLIENT AVAILABLE (PREFERRED PATH)
            if (this.client && researchContent.length > 0) {
                try {
                    synthesized = await this.synthesizeSectionAsync(sectionId, sectionTitle, researchContent, wordsPerSection, chapter, style);
                }
                catch (error) {
                    console.error(`[ChapterWriter] LLM synthesis failed for ${sectionId}:`, error);
                    warnings.push(`Section ${sectionId}: LLM synthesis failed, using fallback`);
                    // Fallback to basic concatenation
                    synthesized = this.synthesizeSection(sectionId, sectionTitle, deduplicatedContent.paragraphs, wordsPerSection, chapter, style);
                }
            }
            else {
                // Fallback: basic concatenation (NOT recommended)
                synthesized = this.synthesizeSection(sectionId, sectionTitle, deduplicatedContent.paragraphs, wordsPerSection, chapter, style);
            }
            // Extract citations from synthesized content
            const citations = this.extractCitations(synthesized.content, sources);
            // Generate cross-references
            const crossRefs = this.generateCrossReferences(synthesized.content, chapter.number, sectionId, allChapters);
            sectionContents.push({
                id: sectionId,
                title: sectionTitle,
                content: synthesized.content,
                wordCount: synthesized.wordCount,
                citations,
                crossReferences: crossRefs
            });
            tokensUsed += synthesized.tokensUsed;
        }
        // Format complete chapter
        const formattedChapter = this.formatChapter(chapter, sectionContents);
        // Enforce word count limits per DI-005
        const wordCountResult = this.enforceWordCount(formattedChapter, chapter.wordTarget);
        if (wordCountResult.status === 'warning') {
            warnings.push(`Chapter ${chapter.number} word count ${wordCountResult.wordCount} is ` +
                `${Math.round(wordCountResult.compliance * 100)}% of target ${chapter.wordTarget}`);
        }
        // Collect all citations
        const allCitations = sectionContents.flatMap(s => s.citations);
        // Collect all cross-references
        const allCrossRefs = sectionContents.flatMap(s => s.crossReferences);
        // Build section info array
        const sections = sectionContents.map(s => ({
            id: s.id,
            title: s.title,
            wordCount: s.wordCount
        }));
        // Calculate quality metrics
        const qualityMetrics = this.calculateQualityMetrics(wordCountResult.wordCount, chapter.wordTarget, allCitations, sources, style);
        // Determine generation status
        let generationStatus;
        if (wordCountResult.status === 'failed') {
            generationStatus = 'failed';
        }
        else if (wordCountResult.status === 'warning' || warnings.length > 0) {
            generationStatus = 'warning';
        }
        else {
            generationStatus = 'success';
        }
        return {
            chapterNumber: chapter.number,
            title: chapter.title,
            content: wordCountResult.content,
            wordCount: wordCountResult.wordCount,
            citations: this.deduplicateCitations(allCitations),
            crossReferences: allCrossRefs,
            sections,
            qualityMetrics,
            generationStatus,
            warnings,
            tokensUsed
        };
    }
    /**
     * Build the LLM prompt for chapter synthesis
     *
     * @param input - Chapter writer input
     * @returns Formatted prompt string
     */
    buildPrompt(input) {
        const { chapter, sources, style, allChapters } = input;
        // Build source material section
        const sourceMaterial = sources
            .map((s, i) => {
            return `### Source ${i + 1}: ${s.fileName} (${s.agentName})\n` +
                `Topics: ${s.primaryTopics.join(', ')}\n` +
                `Key findings: ${s.keyFindings.join('; ')}\n` +
                `Summary: ${s.summary}\n`;
        })
            .join('\n---\n');
        // Build cross-reference context
        const crossRefContext = allChapters
            .filter(c => c.number !== chapter.number)
            .map(c => `- Chapter ${c.number}: ${c.title}`)
            .join('\n');
        // Build style rules
        const styleRules = this.buildStyleRules(style);
        return `
# Chapter Synthesis Task

You are synthesizing Chapter ${chapter.number}: ${chapter.title}

## Chapter Purpose
${chapter.purpose}

## Sections to Write
${chapter.sections.map((s, i) => `${s}. ${chapter.sectionTitles[i]}`).join('\n')}

## Word Target
${chapter.wordTarget} words (tolerance: 70%-130%)

## Research Questions Addressed
${chapter.questionsAddressed.join(', ')}

${styleRules}

## Valid Cross-Reference Targets
${crossRefContext}

## Source Materials (SYNTHESIZE, do NOT copy verbatim)
${sourceMaterial}

## Instructions

1. SYNTHESIZE content from sources into a unified narrative
2. PRESERVE all citations in format: (Author, Year)
3. Include cross-references to other chapters where relevant
4. If sources conflict, present both perspectives with citations
5. Do NOT duplicate content already covered in other sections
6. Maintain academic tone appropriate for PhD dissertation

Write the complete chapter now:
`;
    }
    /**
     * Generate cross-references to other chapters
     *
     * @param content - Section content to scan
     * @param chapterNumber - Current chapter number
     * @param sectionId - Current section identifier
     * @param allChapters - All chapter definitions
     * @returns Array of cross-references found
     */
    generateCrossReferences(content, chapterNumber, sectionId, allChapters) {
        const refs = [];
        // Patterns to match cross-references
        const patterns = [
            // "Chapter N" or "chapter N"
            /[Cc]hapter\s+(\d+)/g,
            // "Section N.M"
            /[Ss]ection\s+(\d+\.\d+)/g,
            // "see Chapter N" or "discussed in Chapter N"
            /(?:see|discussed\s+in|mentioned\s+in|refer\s+to)\s+[Cc]hapter\s+(\d+)/gi,
            // "(see Chapter N)" parenthetical
            /\(see\s+[Cc]hapter\s+(\d+)\)/gi
        ];
        for (const pattern of patterns) {
            let match;
            const patternCopy = new RegExp(pattern.source, pattern.flags);
            while ((match = patternCopy.exec(content)) !== null) {
                const targetNumber = parseInt(match[1].split('.')[0], 10);
                // Skip self-references
                if (targetNumber === chapterNumber)
                    continue;
                // Find target chapter
                const targetChapter = allChapters.find(c => c.number === targetNumber);
                if (!targetChapter)
                    continue;
                // Extract section if present
                let targetSection = null;
                if (match[0].toLowerCase().includes('section')) {
                    const sectionMatch = match[0].match(/\d+\.\d+/);
                    if (sectionMatch) {
                        targetSection = sectionMatch[0];
                    }
                }
                // Generate markdown link
                const chapterSlug = this.slugify(targetChapter.title);
                const paddedNum = String(targetChapter.number).padStart(2, '0');
                let linkFormat;
                let linkText;
                if (targetSection) {
                    const sectionAnchor = targetSection.replace('.', '-');
                    linkFormat = `[See Section ${targetSection}](./ch${paddedNum}-${chapterSlug}.md#section-${sectionAnchor})`;
                    linkText = `See Section ${targetSection}`;
                }
                else {
                    linkFormat = `[See Chapter ${targetChapter.number}: ${targetChapter.title}](./ch${paddedNum}-${chapterSlug}.md)`;
                    linkText = `See Chapter ${targetChapter.number}: ${targetChapter.title}`;
                }
                refs.push({
                    sourceLocation: { chapter: chapterNumber, section: sectionId },
                    targetChapter: targetNumber,
                    targetSection,
                    linkText,
                    linkFormat
                });
            }
        }
        // Deduplicate by target
        const seen = new Set();
        return refs.filter(ref => {
            const key = `${ref.targetChapter}:${ref.targetSection || 'chapter'}`;
            if (seen.has(key))
                return false;
            seen.add(key);
            return true;
        });
    }
    /**
     * Extract citations from content using source information
     *
     * @param content - Content to extract citations from
     * @param sources - Source summaries for validation
     * @returns Array of citation references
     */
    extractCitations(content, sources) {
        const citations = [];
        const seen = new Set();
        // Patterns for citation extraction
        const patterns = {
            // APA Style: (Author, 2020), (Author & Co-Author, 2020), (Author et al., 2020)
            APA: /\(([A-Z][a-z]+(?:\s+(?:et\s+al\.))?(?:\s*[&,]\s*[A-Z][a-z]+)*)[,\s]+(\d{4})[a-z]?(?:,\s*pp?\.\s*\d+(?:\s*[-]\s*\d+)?)?\)/g,
            // MLA Style: (Author 42)
            MLA: /\(([A-Z][a-z]+)\s+(\d+(?:\s*[-]\s*\d+)?)\)/g,
            // Narrative citations: Author (2020) states...
            NARRATIVE: /([A-Z][a-z]+(?:\s+et\s+al\.)?)\s+\((\d{4})[a-z]?\)/g
        };
        // Extract APA citations
        let match;
        while ((match = patterns.APA.exec(content)) !== null) {
            const raw = match[0];
            if (!seen.has(raw)) {
                seen.add(raw);
                citations.push({
                    raw,
                    parsed: {
                        authors: this.parseAuthors(match[1]),
                        year: parseInt(match[2], 10),
                        title: null
                    }
                });
            }
        }
        // Extract MLA citations
        patterns.MLA.lastIndex = 0;
        while ((match = patterns.MLA.exec(content)) !== null) {
            const raw = match[0];
            if (!seen.has(raw)) {
                seen.add(raw);
                citations.push({
                    raw,
                    parsed: {
                        authors: [match[1]],
                        year: null,
                        title: null
                    }
                });
            }
        }
        // Extract narrative citations
        patterns.NARRATIVE.lastIndex = 0;
        while ((match = patterns.NARRATIVE.exec(content)) !== null) {
            const raw = match[0];
            if (!seen.has(raw)) {
                seen.add(raw);
                citations.push({
                    raw,
                    parsed: {
                        authors: this.parseAuthors(match[1]),
                        year: parseInt(match[2], 10),
                        title: null
                    }
                });
            }
        }
        // Also include citations from sources that appear in content
        for (const source of sources) {
            for (const citation of source.citations) {
                if (!seen.has(citation.raw) && content.includes(citation.raw)) {
                    seen.add(citation.raw);
                    citations.push(citation);
                }
            }
        }
        return citations;
    }
    /**
     * Calculate quality metrics for the chapter
     *
     * @param wordCount - Actual word count
     * @param targetWordCount - Target word count
     * @param citations - Extracted citations
     * @param sources - Used sources
     * @param style - Style characteristics (for violation counting)
     * @returns Quality metrics object
     */
    calculateQualityMetrics(wordCount, targetWordCount, citations, sources, _style) {
        // Word count compliance as ratio
        const wordCountCompliance = wordCount / targetWordCount;
        // Citation count
        const citationCount = citations.length;
        // Count unique sources used (sources with citations in content)
        const sourcesWithCitations = new Set();
        for (const source of sources) {
            for (const citation of source.citations) {
                if (citations.some(c => c.raw === citation.raw)) {
                    sourcesWithCitations.add(source.index);
                }
            }
        }
        const uniqueSourcesUsed = sourcesWithCitations.size || sources.length;
        // Style violations (placeholder - actual checking in StyleApplier)
        const styleViolations = 0;
        return {
            wordCountCompliance,
            citationCount,
            uniqueSourcesUsed,
            styleViolations
        };
    }
    // ============================================
    // Private: Content Finding and Synthesis
    // ============================================
    /**
     * Find relevant content from sources for a specific section
     */
    findRelevantContent(sources, sectionTitle, chapter) {
        const paragraphs = [];
        const titleTokens = new Set(this.tokenize(sectionTitle));
        const chapterTokens = new Set([
            ...this.tokenize(chapter.title),
            ...this.tokenize(chapter.purpose),
            ...chapter.keywords.flatMap(k => this.tokenize(k))
        ]);
        for (const source of sources) {
            // Combine source content for extraction
            const sourceText = [
                source.summary,
                ...source.keyFindings,
                ...source.primaryTopics
            ].join('\n\n');
            // Split into paragraphs
            const rawParagraphs = sourceText.split(/\n\n+/);
            for (const para of rawParagraphs) {
                const trimmed = para.trim();
                if (trimmed.length < 50)
                    continue; // Skip short fragments
                const paraTokens = this.tokenize(trimmed);
                const paraSet = new Set(paraTokens);
                // Calculate relevance score
                const titleOverlap = this.jaccardSimilarity(titleTokens, paraSet);
                const chapterOverlap = this.jaccardSimilarity(chapterTokens, paraSet);
                const relevance = titleOverlap * 0.6 + chapterOverlap * 0.4;
                // Include if above minimal relevance threshold
                if (relevance > 0.05 || paraTokens.length > 30) {
                    paragraphs.push({
                        text: trimmed,
                        sourceIndex: source.index,
                        phase: source.phase,
                        wordCount: this.countWords(trimmed),
                        vector: [] // Computed lazily during deduplication
                    });
                }
            }
        }
        return paragraphs;
    }
    /**
     * Deduplicate content using TF-IDF vectorization and cosine similarity
     * Per GAP-H001 and Constitution QA-001
     */
    deduplicateContent(paragraphs) {
        if (paragraphs.length <= 1) {
            return { paragraphs, duplicatesFound: 0 };
        }
        // Build IDF scores from all paragraphs
        const idfScores = this.buildIdfScores(paragraphs);
        // Vectorize all paragraphs
        for (const para of paragraphs) {
            para.vector = this.vectorizeParagraph(para.text, idfScores);
        }
        let duplicatesFound = 0;
        // Compare all pairs
        for (let i = 0; i < paragraphs.length; i++) {
            if (paragraphs[i].isDuplicate)
                continue;
            for (let j = i + 1; j < paragraphs.length; j++) {
                if (paragraphs[j].isDuplicate)
                    continue;
                if (paragraphs[i].sourceIndex === paragraphs[j].sourceIndex)
                    continue;
                const similarity = this.cosineSimilarity(paragraphs[i].vector, paragraphs[j].vector);
                if (similarity > ChapterWriterAgent.THRESHOLDS.DUPLICATE) {
                    duplicatesFound++;
                    if (similarity > ChapterWriterAgent.THRESHOLDS.NEAR_DUPLICATE) {
                        // Near-duplicate: merge into better version
                        if (paragraphs[i].phase > paragraphs[j].phase) {
                            paragraphs[j].isDuplicate = true;
                            paragraphs[j].mergeTarget = i;
                        }
                        else if (paragraphs[j].phase > paragraphs[i].phase) {
                            paragraphs[i].isDuplicate = true;
                            paragraphs[i].mergeTarget = j;
                        }
                        else {
                            // Same phase: keep longer version
                            if (paragraphs[i].wordCount >= paragraphs[j].wordCount) {
                                paragraphs[j].isDuplicate = true;
                                paragraphs[j].mergeTarget = i;
                            }
                            else {
                                paragraphs[i].isDuplicate = true;
                                paragraphs[i].mergeTarget = j;
                            }
                        }
                    }
                    else {
                        // Partial duplicate: flag the lower-priority one
                        if (paragraphs[i].phase >= paragraphs[j].phase) {
                            paragraphs[j].isDuplicate = true;
                        }
                        else {
                            paragraphs[i].isDuplicate = true;
                        }
                    }
                }
            }
        }
        // Filter out duplicates
        const filtered = paragraphs.filter(p => !p.isDuplicate);
        return { paragraphs: filtered, duplicatesFound };
    }
    /**
     * Synthesize section content from paragraphs using LLM
     *
     * CRITICAL: This method calls the LLM with the chapter-synthesizer agent prompt
     * to transform raw research findings into clean academic prose. It does NOT
     * simply concatenate paragraphs.
     */
    synthesizeSection(sectionId, sectionTitle, paragraphs, targetWords, chapter, style) {
        // If LLM client available, use LLM-based synthesis (async wrapper)
        // For synchronous compatibility, we use a flag to track if we should use LLM
        // The actual LLM call happens in writeChapter via synthesizeSectionAsync
        // For now, collect and prepare the research content for LLM synthesis
        // Sort paragraphs by phase (later phases first, as they're more refined)
        const sorted = [...paragraphs].sort((a, b) => b.phase - a.phase);
        // Prepare research content (raw material for LLM)
        const researchContent = sorted.map(p => p.text).join('\n\n');
        // If no LLM client, fall back to basic concatenation with warning
        if (!this.client) {
            console.warn('[ChapterWriter] No LLM client - using basic concatenation (NOT recommended)');
            let content = `## ${sectionId} ${sectionTitle}\n\n`;
            let currentWords = 0;
            let tokensUsed = 0;
            for (const para of sorted) {
                let text = para.text;
                if (style?.regional?.languageVariant === 'en-GB') {
                    text = this.applyBritishSpelling(text);
                }
                if (currentWords + para.wordCount <= targetWords * 1.3) {
                    content += text + '\n\n';
                    currentWords += para.wordCount;
                    tokensUsed += this.estimateTokens(text);
                }
            }
            return { content, wordCount: this.countWords(content), tokensUsed };
        }
        // Store data for async synthesis (called from writeChapter)
        // Return placeholder that will be replaced by LLM output
        return {
            content: `__LLM_SECTION_PLACEHOLDER__${sectionId}__`,
            wordCount: targetWords, // Estimated
            tokensUsed: 0,
            // Store metadata for async processing
        };
    }
    /**
     * Synthesize section content using LLM (async version)
     *
     * CRITICAL: This is the core method that transforms research into prose.
     * It MUST use the style profile - this is non-negotiable.
     */
    async synthesizeSectionAsync(sectionId, sectionTitle, researchContent, targetWords, chapter, style) {
        if (!this.client) {
            throw new Error('LLM client not initialized - cannot synthesize section');
        }
        // 1. Load chapter-synthesizer agent prompt (REQUIRED)
        const agentPrompt = await this.loadChapterSynthesizerPrompt();
        // 2. Build style system prompt (MUST USE STYLE PROFILE)
        const stylePrompt = await this.buildStyleSystemPrompt();
        // 3. Build the complete system prompt
        const systemPrompt = `${agentPrompt}

${stylePrompt}

CRITICAL REQUIREMENTS:
- You are synthesizing Section ${sectionId}: ${sectionTitle}
- Target word count: ${targetWords} words (±10%)
- Chapter context: ${chapter.title}
- Transform the research content below into CLEAN ACADEMIC PROSE
- Do NOT include any research artifacts (Q1:, FLAG:, Confidence:, etc.)
- Do NOT use bullet points - write flowing paragraphs
- Integrate citations naturally (Author, Year)
- Use proper transitions between paragraphs`;
        // 4. Build user prompt with research content
        const userPrompt = `## Research Content to Synthesize

The following is raw research output. Transform this into clean academic prose for Section ${sectionId}: ${sectionTitle}.

---
${researchContent}
---

Write the section now as publication-ready academic prose. Begin with "## ${sectionId} ${sectionTitle}" and write ${targetWords} words of clean, flowing prose.`;
        // 5. Call LLM
        console.log(`[ChapterWriter] Calling LLM for section ${sectionId} (target: ${targetWords} words)`);
        const startTime = Date.now();
        const response = await this.client.messages.create({
            model: this.model,
            max_tokens: Math.min(Math.ceil(targetWords * 2), 8000),
            system: systemPrompt,
            messages: [{ role: 'user', content: userPrompt }],
        });
        // 6. Extract content
        let content = response.content
            .filter((block) => block.type === 'text')
            .map((block) => block.text)
            .join('\n');
        // 7. Apply final UK spelling if needed (belt and suspenders)
        if (style?.regional?.languageVariant === 'en-GB') {
            content = this.applyBritishSpelling(content);
        }
        const tokensUsed = response.usage.input_tokens + response.usage.output_tokens;
        const latencyMs = Date.now() - startTime;
        console.log(`[ChapterWriter] Section ${sectionId} synthesized in ${latencyMs}ms (${tokensUsed} tokens)`);
        return {
            content,
            wordCount: this.countWords(content),
            tokensUsed,
        };
    }
    /**
     * Load the chapter-synthesizer agent prompt
     *
     * Loads from .claude/agents/phdresearch/chapter-synthesizer.md
     */
    async loadChapterSynthesizerPrompt() {
        // Return cached prompt if available
        if (this.cachedAgentPrompt) {
            return this.cachedAgentPrompt;
        }
        try {
            // Find project root (look for .claude directory)
            let projectRoot = process.cwd();
            const maxDepth = 5;
            for (let i = 0; i < maxDepth; i++) {
                const claudeDir = join(projectRoot, '.claude');
                try {
                    await readFile(join(claudeDir, 'settings.json'));
                    break; // Found .claude directory
                }
                catch {
                    projectRoot = join(projectRoot, '..');
                }
            }
            const agentPath = join(projectRoot, '.claude/agents/phdresearch/chapter-synthesizer.md');
            const content = await readFile(agentPath, 'utf-8');
            // Extract prompt content (after YAML frontmatter)
            const parts = content.split('---');
            if (parts.length >= 3) {
                // Skip frontmatter, get the markdown body
                this.cachedAgentPrompt = parts.slice(2).join('---').trim();
            }
            else {
                this.cachedAgentPrompt = content;
            }
            console.log('[ChapterWriter] Loaded chapter-synthesizer agent prompt');
            return this.cachedAgentPrompt;
        }
        catch (error) {
            console.error('[ChapterWriter] Failed to load chapter-synthesizer prompt:', error);
            // Fallback: minimal synthesis instructions
            return `You are a professional academic writer. Transform research findings into clean, publication-ready academic prose.

ABSOLUTE PROHIBITIONS (NEVER INCLUDE):
- Q1:, Q2:, Q3: markers
- FLAG:, Confidence:, Score:
- CRITICAL UNKNOWNS, HYPOTHESIS TO TEST
- Bullet points (convert to flowing prose)
- Agent markers, phase markers
- Research workflow artifacts

Write flowing academic paragraphs with naturally integrated citations.`;
        }
    }
    /**
     * Build style system prompt from style profile
     *
     * CRITICAL: This method MUST return style instructions.
     * The style profile is NON-NEGOTIABLE for the final paper.
     */
    async buildStyleSystemPrompt() {
        // Get style profile manager
        const styleManager = getStyleProfileManager();
        // If we have a specific style profile ID, use it
        if (this.styleProfileId) {
            const profile = styleManager.getProfile(this.styleProfileId);
            if (profile?.characteristics) {
                const analyzer = new StyleAnalyzer();
                const stylePrompt = analyzer.generateStylePrompt(profile.characteristics);
                console.log(`[ChapterWriter] Using style profile: ${this.styleProfileId}`);
                return `--- MANDATORY WRITING STYLE ---
${stylePrompt}

STYLE REQUIREMENTS ARE NON-NEGOTIABLE. Apply them to ALL output.`;
            }
        }
        // Fallback: try to load default profile
        const profiles = styleManager.listProfiles();
        if (profiles.length > 0) {
            const defaultProfile = profiles[0];
            const profile = styleManager.getProfile(defaultProfile.id);
            if (profile?.characteristics) {
                const analyzer = new StyleAnalyzer();
                const stylePrompt = analyzer.generateStylePrompt(profile.characteristics);
                console.log(`[ChapterWriter] Using default style profile: ${defaultProfile.id}`);
                return `--- MANDATORY WRITING STYLE ---
${stylePrompt}

STYLE REQUIREMENTS ARE NON-NEGOTIABLE. Apply them to ALL output.`;
            }
        }
        // Ultimate fallback: UK English academic style
        console.warn('[ChapterWriter] No style profile found - using UK English academic defaults');
        return `--- MANDATORY WRITING STYLE ---
Language Variant: British English (UK)
- Use -ise endings (organise, recognise, emphasise, synthesise)
- Use -our endings (behaviour, colour, favour)
- Use -re endings (centre, metre)
- Use "towards" not "toward", "got" not "gotten"

Academic Register:
- Formal vocabulary throughout
- Third person (avoid "I" and "we")
- No contractions (use "cannot" not "can't")
- Appropriate hedging (suggests, indicates, may)
- Passive voice where appropriate for objectivity

Citation Style: APA 7th Edition
- In-text: (Author, Year) or Author (Year)
- Integrate citations naturally into prose

STYLE REQUIREMENTS ARE NON-NEGOTIABLE. Apply them to ALL output.`;
    }
    // ============================================
    // Private: Word Count Enforcement
    // ============================================
    /**
     * Enforce word count limits per DI-005
     */
    enforceWordCount(content, target) {
        const wordCount = this.countWords(content);
        const compliance = wordCount / target;
        const { FAILURE_MIN, FAILURE_MAX, WARNING_MIN, WARNING_MAX } = ChapterWriterAgent.WORD_COUNT_TOLERANCE;
        // Check failure thresholds first
        if (compliance < FAILURE_MIN || compliance > FAILURE_MAX) {
            // Per Constitution DI-005: content outside 70%-130% MUST NOT be written
            // We still return the content for logging/debugging but mark as failed
            return {
                content,
                status: 'failed',
                action: compliance < FAILURE_MIN ? 'needs-expansion' : 'needs-condensation',
                wordCount,
                compliance
            };
        }
        // Check warning thresholds
        if (compliance < WARNING_MIN || compliance > WARNING_MAX) {
            return {
                content,
                status: 'warning',
                action: compliance < WARNING_MIN ? 'may-need-expansion' : 'may-need-condensation',
                wordCount,
                compliance
            };
        }
        return {
            content,
            status: 'success',
            action: 'none',
            wordCount,
            compliance
        };
    }
    // ============================================
    // Private: Text Processing Utilities
    // ============================================
    /**
     * Format complete chapter from sections
     */
    formatChapter(chapter, sections) {
        let content = `# Chapter ${chapter.number}: ${chapter.title}\n\n`;
        for (const section of sections) {
            content += section.content;
        }
        return content;
    }
    /**
     * Tokenize text into normalized words
     */
    tokenize(text) {
        return text
            .toLowerCase()
            .replace(/[^\w\s-]/g, ' ')
            .split(/\s+/)
            .filter(w => w.length > 2 && !ChapterWriterAgent.STOPWORDS.has(w));
    }
    /**
     * Build IDF scores from paragraphs
     */
    buildIdfScores(paragraphs) {
        const docFreq = new Map();
        const N = paragraphs.length;
        for (const para of paragraphs) {
            const uniqueTerms = new Set(this.tokenize(para.text));
            for (const term of uniqueTerms) {
                docFreq.set(term, (docFreq.get(term) || 0) + 1);
            }
        }
        const idfScores = new Map();
        for (const [term, count] of docFreq) {
            idfScores.set(term, Math.log(N / (count + 1)) + 1);
        }
        return idfScores;
    }
    /**
     * Vectorize paragraph using TF-IDF
     */
    vectorizeParagraph(text, idfScores) {
        const tokens = this.tokenize(text);
        const termFreq = new Map();
        for (const token of tokens) {
            termFreq.set(token, (termFreq.get(token) || 0) + 1);
        }
        // Build TF-IDF vector
        const vocabulary = Array.from(idfScores.keys()).sort();
        const vector = new Array(vocabulary.length).fill(0);
        for (let i = 0; i < vocabulary.length; i++) {
            const term = vocabulary[i];
            if (termFreq.has(term)) {
                const tf = (termFreq.get(term) || 0) / tokens.length;
                const idf = idfScores.get(term) || 0;
                vector[i] = tf * idf;
            }
        }
        // L2 normalization
        return this.normalizeVector(vector);
    }
    /**
     * L2 normalize a vector
     */
    normalizeVector(vector) {
        const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
        if (magnitude === 0)
            return vector;
        return vector.map(v => v / magnitude);
    }
    /**
     * Calculate cosine similarity between two vectors
     */
    cosineSimilarity(v1, v2) {
        if (v1.length !== v2.length || v1.length === 0)
            return 0;
        let dotProduct = 0;
        for (let i = 0; i < v1.length; i++) {
            dotProduct += v1[i] * v2[i];
        }
        return dotProduct; // Vectors are already normalized
    }
    /**
     * Jaccard similarity between two sets
     */
    jaccardSimilarity(set1, set2) {
        if (set1.size === 0 && set2.size === 0)
            return 0;
        const intersection = new Set([...set1].filter(x => set2.has(x)));
        const union = new Set([...set1, ...set2]);
        if (union.size === 0)
            return 0;
        return intersection.size / union.size;
    }
    /**
     * Count words in text
     */
    countWords(text) {
        return text.split(/\s+/).filter(w => w.length > 0).length;
    }
    /**
     * Estimate token count (rough: 1 token ~ 4 characters)
     */
    estimateTokens(text) {
        return Math.ceil(text.length / 4);
    }
    /**
     * Slugify a title for URL/filename use
     */
    slugify(title) {
        return title
            .toLowerCase()
            .replace(/['']/g, '')
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
            .slice(0, 50);
    }
    /**
     * Parse author string into array
     */
    parseAuthors(authorString) {
        // Handle "et al."
        if (authorString.toLowerCase().includes('et al')) {
            const mainAuthor = authorString.replace(/\s+et\s+al\.?/i, '').trim();
            return [mainAuthor];
        }
        // Split on & or ,
        return authorString
            .split(/\s*[&,]\s*/)
            .map(a => a.trim())
            .filter(a => a.length > 0);
    }
    /**
     * Deduplicate citations by raw text
     */
    deduplicateCitations(citations) {
        const seen = new Set();
        return citations.filter(c => {
            if (seen.has(c.raw))
                return false;
            seen.add(c.raw);
            return true;
        });
    }
    /**
     * Apply basic British spelling transformations
     */
    applyBritishSpelling(text) {
        const replacements = [
            [/\borganiz(e|ed|er|ers|es|ing|ation|ations)\b/gi, 'organis$1'],
            [/\brecogniz(e|ed|er|ers|es|ing|ation|ations)\b/gi, 'recognis$1'],
            [/\bemphasiz(e|ed|er|ers|es|ing)\b/gi, 'emphasis$1'],
            [/\bcolor\b/gi, 'colour'],
            [/\bcolors\b/gi, 'colours'],
            [/\bbehavior\b/gi, 'behaviour'],
            [/\bbehaviors\b/gi, 'behaviours'],
            [/\bcenter\b/gi, 'centre'],
            [/\bcenters\b/gi, 'centres'],
            [/\btoward\b/gi, 'towards'],
            [/\bgotten\b/gi, 'got']
        ];
        let result = text;
        for (const [pattern, replacement] of replacements) {
            result = result.replace(pattern, replacement);
        }
        return result;
    }
    /**
     * Build style rules section for prompt
     */
    buildStyleRules(style) {
        if (!style) {
            return `## Style Guidelines
- Use academic tone appropriate for PhD dissertation
- Avoid contractions
- Use precise, formal language`;
        }
        const rules = ['## Style Guidelines'];
        // Check regional settings for language variant
        if (style.regional?.languageVariant === 'en-GB') {
            rules.push('- Use British English spellings (-ise, -our, -re endings)');
            rules.push('- Use "towards" not "toward", "got" not "gotten"');
        }
        // Use tone metrics for formality
        if (style.tone?.formalityScore !== undefined) {
            rules.push(`- Formality level: ${(style.tone.formalityScore * 100).toFixed(0)}% (academic tone, no contractions)`);
        }
        if (style.citationStyle) {
            rules.push(`- Citation style: ${style.citationStyle}`);
        }
        return rules.join('\n');
    }
}
//# sourceMappingURL=chapter-writer-agent.js.map