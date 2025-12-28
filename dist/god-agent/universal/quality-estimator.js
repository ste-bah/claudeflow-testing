/**
 * Quality Estimator for God Agent Auto-Feedback
 *
 * Estimates interaction quality based on output characteristics
 * to enable automatic feedback without explicit user input.
 *
 * Part of PRD FR-11 (Sona Engine) implementation.
 */
/**
 * Estimate quality of an interaction based on output characteristics.
 *
 * Quality factors:
 * - Length: Longer, more detailed responses score higher
 * - Code blocks: Technical content with code examples
 * - Structure: Lists, headers, organized content
 * - Mode relevance: Mode-specific quality indicators
 *
 * @param interaction - The interaction to assess
 * @param threshold - Auto-store threshold (default 0.6)
 * @returns Quality score between 0 and 1
 */
export function estimateQuality(interaction, threshold = 0.6) {
    const assessment = assessQuality(interaction, threshold);
    return assessment.score;
}
/**
 * Perform detailed quality assessment with factor breakdown.
 *
 * @param interaction - The interaction to assess
 * @param threshold - Auto-store threshold (default 0.6)
 * @returns Detailed quality assessment
 */
export function assessQuality(interaction, threshold = 0.6) {
    const output = interaction.output;
    const mode = interaction.mode;
    // Factor 1: Length scoring (0-0.25)
    let lengthScore = 0;
    if (output.length > 200)
        lengthScore += 0.05;
    if (output.length > 500)
        lengthScore += 0.05;
    if (output.length > 1000)
        lengthScore += 0.05;
    if (output.length > 2000)
        lengthScore += 0.05;
    if (output.length > 4000)
        lengthScore += 0.05;
    lengthScore = Math.min(lengthScore, 0.25);
    // Factor 2: Code content scoring (0-0.25)
    let codeScore = 0;
    const codeBlocks = (output.match(/```/g) || []).length / 2;
    if (codeBlocks >= 1)
        codeScore += 0.1;
    if (codeBlocks >= 2)
        codeScore += 0.05;
    if (codeBlocks >= 3)
        codeScore += 0.05;
    if (codeBlocks >= 5)
        codeScore += 0.05;
    codeScore = Math.min(codeScore, 0.25);
    // Factor 3: Structure scoring (0-0.25)
    let structureScore = 0;
    // Check for bullet lists
    if (output.includes('\n- ') || output.includes('\n* '))
        structureScore += 0.05;
    // Check for numbered lists
    if (/\n\d+\.\s/.test(output))
        structureScore += 0.05;
    // Check for headers
    if (output.includes('\n## ') || output.includes('\n### '))
        structureScore += 0.05;
    // Check for paragraphs (multiple newlines)
    if ((output.match(/\n\n/g) || []).length >= 3)
        structureScore += 0.05;
    // Check for inline code
    if ((output.match(/`[^`]+`/g) || []).length >= 3)
        structureScore += 0.05;
    structureScore = Math.min(structureScore, 0.25);
    // Factor 4: Mode relevance scoring (0-0.25)
    let modeScore = 0.1; // Base score for any response
    switch (mode) {
        case 'code':
            // Code mode: prioritize code blocks and technical content
            if (codeBlocks >= 1)
                modeScore += 0.1;
            if (codeBlocks >= 2)
                modeScore += 0.05;
            // Check for function/class definitions
            if (/\b(function|class|const|let|var|def|async)\b/.test(output))
                modeScore += 0.05;
            break;
        case 'research':
            // Research mode: prioritize length and structure
            if (output.length > 2000)
                modeScore += 0.1;
            if (structureScore >= 0.15)
                modeScore += 0.05;
            // Check for citations or references
            if (/\[\d+\]|source|reference|according to/i.test(output))
                modeScore += 0.05;
            break;
        case 'write':
            // Write mode: prioritize length and coherent structure
            if (output.length > 1500)
                modeScore += 0.1;
            if ((output.match(/\n\n/g) || []).length >= 5)
                modeScore += 0.05;
            // Check for natural prose flow
            if (output.split('.').length >= 10)
                modeScore += 0.05;
            break;
        case 'general':
        default:
            // General mode: balanced scoring
            if (output.length > 300)
                modeScore += 0.05;
            if (structureScore >= 0.1 || codeScore >= 0.1)
                modeScore += 0.05;
            break;
    }
    modeScore = Math.min(modeScore, 0.25);
    // Calculate total score
    const totalScore = Math.min(lengthScore + codeScore + structureScore + modeScore, 1.0);
    return {
        score: totalScore,
        factors: {
            length: lengthScore,
            structure: structureScore,
            codeContent: codeScore,
            modeRelevance: modeScore,
        },
        meetsThreshold: totalScore >= threshold,
        qualifiesForPattern: totalScore >= 0.8,
    };
}
/**
 * Determine verdict based on quality score.
 * Maps to ReasoningBank feedback verdict types.
 *
 * @param quality - Quality score 0-1
 * @returns Verdict string for feedback
 */
export function qualityToVerdict(quality) {
    if (quality >= 0.7)
        return 'correct';
    if (quality >= 0.4)
        return 'neutral';
    return 'incorrect';
}
/**
 * Calculate L-score (learning potential) from quality and novelty.
 * Used by SonaEngine for weight updates.
 *
 * @param quality - Quality score 0-1
 * @param novelty - Novelty score 0-1 (how different from existing patterns)
 * @returns L-score for learning weight calculation
 */
export function calculateLScore(quality, novelty = 0.5) {
    // L-score combines quality with novelty
    // High quality + high novelty = high learning potential
    // High quality + low novelty = refinement of existing patterns
    // Low quality = minimal learning
    return quality * (0.7 + 0.3 * novelty);
}
//# sourceMappingURL=quality-estimator.js.map