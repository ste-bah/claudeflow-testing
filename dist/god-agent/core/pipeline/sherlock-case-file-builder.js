/**
 * Sherlock Case File Builder
 *
 * Builds case files and generates markdown reports for forensic investigations.
 * Extracted from sherlock-phase-reviewer.ts for constitution compliance (< 500 lines).
 *
 * @module src/god-agent/core/pipeline/sherlock-case-file-builder
 * @see docs/god-agent-coding-pipeline/PRD-god-agent-coding-pipeline.md Section 2.3.4
 */
import { PHASE_NAMES, } from './sherlock-phase-reviewer-types.js';
/**
 * Build complete case file from investigation results.
 *
 * @param params - Case file parameters
 * @returns Complete case file
 */
export function buildCaseFile(params) {
    const { phase, tier, verdict, confidence, evidenceSummary, verificationResults, adversarialFindings, chainOfCustody, remediations, } = params;
    const timestamp = new Date();
    const caseId = `PHASE-${phase}-REVIEW-${timestamp.toISOString().replace(/[:.]/g, '-')}`;
    return {
        caseId,
        phase,
        subject: `${PHASE_NAMES[phase]} Verification`,
        tier,
        verdict,
        confidence,
        evidenceSummary,
        verificationResults,
        adversarialFindings,
        chainOfCustody,
        remediations,
        investigator: `sherlock-holmes-phase-${phase}`,
        timestamp,
    };
}
// ═══════════════════════════════════════════════════════════════════════════
// CASE FILE REPORT GENERATOR
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Generate markdown report from case file.
 *
 * @param caseFile - Case file to format
 * @returns Markdown-formatted case file report
 */
export function getCaseFileReport(caseFile) {
    const lines = [
        '## SHERLOCK HOLMES CASE FILE',
        '',
        `### Case ID: ${caseFile.caseId}`,
        `### Subject: ${caseFile.subject}`,
        `### Investigation Tier: ${caseFile.tier.toUpperCase()}`,
        '',
        `### VERDICT: ${caseFile.verdict}`,
        '',
        '### Evidence Summary',
        '| Source | Status | Notes |',
        '|--------|--------|-------|',
    ];
    for (const e of caseFile.evidenceSummary) {
        lines.push(`| ${e.source} | ${e.status} | ${e.notes} |`);
    }
    lines.push('', '### Verification Matrix Results');
    lines.push('| Check | Method | Expected | Actual | Verdict |');
    lines.push('|-------|--------|----------|--------|---------|');
    for (const v of caseFile.verificationResults) {
        lines.push(`| ${v.check} | ${v.method} | ${v.expected} | ${v.actual} | ${v.passed ? 'PASS' : 'FAIL'} |`);
    }
    lines.push('', '### Adversarial Analysis');
    for (const a of caseFile.adversarialFindings) {
        lines.push(`- **${a.persona}**: ${a.findings}`);
    }
    lines.push('', '### Chain of Custody');
    caseFile.chainOfCustody.forEach((c, i) => {
        lines.push(`${i + 1}. ${c.event}: ${c.timestamp.toISOString()}`);
    });
    if (caseFile.remediations.length > 0) {
        lines.push('', '### Remediation Required');
        caseFile.remediations.forEach((r, i) => {
            lines.push(`${i + 1}. ${r}`);
        });
    }
    lines.push('', '### Sign-Off');
    lines.push(`- Investigator: ${caseFile.investigator}`);
    lines.push(`- Confidence: ${caseFile.confidence}`);
    return lines.join('\n');
}
//# sourceMappingURL=sherlock-case-file-builder.js.map