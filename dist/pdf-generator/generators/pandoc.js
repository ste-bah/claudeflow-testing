/**
 * Pandoc PDF Generator
 *
 * Generates APA 7th Edition compliant PDFs using Pandoc with LaTeX.
 * Provides the highest quality output when LaTeX is available,
 * with HTML fallback for environments without LaTeX.
 *
 * @module pdf-generator/generators/pandoc
 */
import { execFile } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink, access, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { constants as fsConstants } from 'fs';
import { BaseGenerator } from './base-generator.js';
const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// =============================================================================
// PANDOC GENERATOR
// =============================================================================
/**
 * PDF generator using Pandoc with LaTeX for APA 7th Edition compliance.
 *
 * Features:
 * - High-quality PDF output via LaTeX
 * - HTML/CSS fallback when LaTeX unavailable
 * - Full APA 7th Edition heading hierarchy
 * - Running head with page numbers
 * - Hanging indent for references
 *
 * @example
 * ```typescript
 * const generator = new PandocGenerator();
 * await generator.checkAvailability();
 *
 * if (generator.available) {
 *   const result = await generator.generate(paper, { outputPath: 'paper.pdf' });
 *   console.log(result.success ? 'PDF created!' : result.error);
 * }
 * ```
 */
export class PandocGenerator extends BaseGenerator {
    /** Generator type identifier */
    type = 'pandoc-latex';
    /** Path to pandoc executable */
    pandocPath;
    /** Whether LaTeX (xelatex) is available - required for fontspec/system fonts */
    latexAvailable = false;
    /** Path to xelatex executable (for TinyTeX or non-PATH installations) */
    latexPath;
    /** Whether wkhtmltopdf is available for HTML fallback */
    wkhtmltopdfAvailable = false;
    /** Cached pandoc version */
    pandocVersion;
    /** Temporary files created during generation */
    tempFiles = [];
    /**
     * Create a new PandocGenerator.
     * @param pandocPath - Custom path to pandoc executable (optional)
     */
    constructor(pandocPath) {
        super();
        this.pandocPath = pandocPath || this.detectPandocPath();
    }
    // ===========================================================================
    // AVAILABILITY CHECKING
    // ===========================================================================
    /**
     * Check if Pandoc and related tools are available.
     * @returns Promise resolving to availability status
     */
    async checkAvailability() {
        const result = await this.detectAvailability();
        this.latexAvailable = result.latexAvailable;
        this.latexPath = result.latexPath;
        this.wkhtmltopdfAvailable = result.wkhtmltopdfAvailable;
        this.pandocVersion = result.pandocVersion;
        this._available = result.pandocAvailable;
        if (this._available) {
            this.log('info', `Pandoc ${this.pandocVersion?.full || 'unknown version'} available`);
            this.log('info', `LaTeX: ${this.latexAvailable ? 'yes' : 'no'}`);
            this.log('info', `wkhtmltopdf: ${this.wkhtmltopdfAvailable ? 'yes' : 'no'}`);
        }
        else {
            this.log('warn', 'Pandoc not available');
        }
        return this._available;
    }
    /**
     * Detect Pandoc installation path based on common locations.
     */
    detectPandocPath() {
        // Common Pandoc installation paths
        const commonPaths = [
            '/opt/anaconda3/bin/pandoc',
            '/usr/local/bin/pandoc',
            '/usr/bin/pandoc',
            '/opt/homebrew/bin/pandoc',
            process.env.PANDOC_PATH,
        ].filter(Boolean);
        // Return first path or default
        return commonPaths[0] || 'pandoc';
    }
    /**
     * Detect availability of Pandoc and related tools.
     */
    async detectAvailability() {
        const result = {
            pandocAvailable: false,
            latexAvailable: false,
            wkhtmltopdfAvailable: false,
        };
        // Check pandoc
        try {
            await access(this.pandocPath, fsConstants.X_OK);
            const { stdout } = await execFileAsync(this.pandocPath, ['--version'], {
                timeout: 5000,
            });
            result.pandocAvailable = true;
            result.pandocVersion = this.parsePandocVersion(stdout);
        }
        catch (error) {
            // Try 'pandoc' in PATH
            try {
                const { stdout } = await execFileAsync('pandoc', ['--version'], {
                    timeout: 5000,
                });
                this.pandocPath = 'pandoc';
                result.pandocAvailable = true;
                result.pandocVersion = this.parsePandocVersion(stdout);
            }
            catch {
                result.pandocAvailable = false;
            }
        }
        // Check LaTeX (xelatex) - required for fontspec/system fonts like Times New Roman
        try {
            const { stdout } = await execFileAsync('which', ['xelatex'], { timeout: 3000 });
            result.latexAvailable = true;
            result.latexPath = stdout.trim(); // Store the path found via which
        }
        catch {
            // Try common XeLaTeX paths including TinyTeX
            const homedir = process.env.HOME || '';
            const latexPaths = [
                '/Library/TeX/texbin/xelatex',
                '/usr/local/texlive/2023/bin/universal-darwin/xelatex',
                '/usr/local/texlive/2024/bin/universal-darwin/xelatex',
                '/usr/local/texlive/2025/bin/universal-darwin/xelatex',
                '/usr/bin/xelatex',
                // TinyTeX installation paths
                `${homedir}/Library/TinyTeX/bin/universal-darwin/xelatex`,
                `${homedir}/.TinyTeX/bin/universal-darwin/xelatex`,
            ];
            for (const latexPath of latexPaths) {
                try {
                    await access(latexPath, fsConstants.X_OK);
                    result.latexAvailable = true;
                    result.latexPath = latexPath; // Store the explicit path
                    break;
                }
                catch {
                    continue;
                }
            }
        }
        // Check wkhtmltopdf (HTML fallback)
        try {
            await execFileAsync('which', ['wkhtmltopdf'], { timeout: 3000 });
            result.wkhtmltopdfAvailable = true;
        }
        catch {
            result.wkhtmltopdfAvailable = false;
        }
        return result;
    }
    /**
     * Parse Pandoc version from --version output.
     */
    parsePandocVersion(output) {
        const match = output.match(/pandoc\s+(\d+)\.(\d+)(?:\.(\d+))?/i);
        if (match) {
            return {
                major: parseInt(match[1], 10),
                minor: parseInt(match[2], 10),
                patch: parseInt(match[3] || '0', 10),
                full: `${match[1]}.${match[2]}${match[3] ? '.' + match[3] : ''}`,
            };
        }
        return { major: 0, minor: 0, patch: 0, full: 'unknown' };
    }
    // ===========================================================================
    // PDF GENERATION
    // ===========================================================================
    /**
     * Generate a PDF from a formatted paper.
     * @param paper - The formatted paper to convert
     * @param options - Generation options
     * @returns Generation result
     */
    async generate(paper, options) {
        const startTime = Date.now();
        const warnings = [];
        this.tempFiles = [];
        try {
            // Validate inputs
            this.reportProgress('Validating inputs', 5);
            this.validateOptions(options);
            this.validatePaper(paper);
            // Check availability if not already done
            if (!this._available) {
                await this.checkAvailability();
                if (!this._available) {
                    throw new Error('Pandoc is not available on this system');
                }
            }
            // Convert to Markdown
            this.reportProgress('Converting to Markdown', 15);
            const markdown = this.formatToMarkdown(paper);
            // Ensure output directory exists
            const outputDir = dirname(options.outputPath);
            await mkdir(outputDir, { recursive: true });
            // Write temporary markdown file
            const tempDir = options.tempDir || outputDir;
            const tempMdPath = join(tempDir, `.temp-paper-${Date.now()}.md`);
            await writeFile(tempMdPath, markdown, 'utf-8');
            this.tempFiles.push(tempMdPath);
            // Get template path
            const templatePath = join(__dirname, '../templates/pandoc/apa7.tex');
            // Determine which engine to use
            const useLatex = this.latexAvailable;
            if (!useLatex && !this.wkhtmltopdfAvailable) {
                warnings.push('Neither LaTeX nor wkhtmltopdf available. PDF quality may be reduced.');
            }
            // Build Pandoc arguments
            this.reportProgress('Building Pandoc arguments', 25);
            const args = await this.buildPandocArgs(tempMdPath, options, templatePath, useLatex);
            // Run Pandoc
            this.reportProgress('Running Pandoc', 40);
            this.log('debug', `Executing: ${this.pandocPath} ${args.join(' ')}`);
            try {
                const { stdout, stderr } = await execFileAsync(this.pandocPath, args, {
                    timeout: 120000, // 2 minutes for complex documents
                    maxBuffer: 10 * 1024 * 1024, // 10MB buffer
                });
                if (stdout)
                    this.log('debug', `Pandoc stdout: ${stdout}`);
                if (stderr) {
                    this.log('warn', `Pandoc stderr: ${stderr}`);
                    warnings.push(`Pandoc warning: ${stderr.substring(0, 200)}`);
                }
            }
            catch (execError) {
                const error = execError;
                this.log('error', `Pandoc execution failed: ${error.message}`);
                if (error.stderr) {
                    this.log('error', `Pandoc stderr: ${error.stderr}`);
                }
                throw new Error(`Pandoc execution failed: ${error.message}. ${error.stderr || ''}`);
            }
            // Verify output was created
            this.reportProgress('Verifying output', 90);
            try {
                await access(options.outputPath, fsConstants.R_OK);
            }
            catch {
                throw new Error(`PDF was not created at expected path: ${options.outputPath}`);
            }
            // Cleanup temp files unless debug mode
            if (!options.keepIntermediateFiles) {
                await this.cleanup();
            }
            this.reportProgress('Complete', 100);
            return this.createSuccessResult(options.outputPath, Date.now() - startTime, warnings);
        }
        catch (error) {
            // Cleanup on error
            if (!options.keepIntermediateFiles) {
                await this.cleanup();
            }
            return this.createErrorResult(error, warnings);
        }
    }
    /**
     * Build Pandoc command-line arguments.
     */
    async buildPandocArgs(inputPath, options, templatePath, useLatex) {
        const args = [inputPath, '-o', options.outputPath];
        // PDF engine selection
        if (useLatex) {
            // Use explicit path if available (for TinyTeX or non-PATH installations)
            const pdfEngine = this.latexPath || 'xelatex';
            args.push(`--pdf-engine=${pdfEngine}`);
            // Check if template exists
            try {
                await access(templatePath, fsConstants.R_OK);
                args.push(`--template=${templatePath}`);
            }
            catch {
                this.log('warn', `LaTeX template not found at ${templatePath}, using defaults`);
            }
        }
        else if (this.wkhtmltopdfAvailable) {
            args.push('--pdf-engine=wkhtmltopdf');
            // Use CSS for HTML fallback
            const cssPath = join(__dirname, '../templates/pandoc/apa7.css');
            try {
                await access(cssPath, fsConstants.R_OK);
                args.push(`--css=${cssPath}`);
            }
            catch {
                this.log('warn', `CSS template not found at ${cssPath}, using defaults`);
            }
        }
        // LaTeX-specific options
        if (useLatex) {
            args.push('-V', 'geometry:margin=1in', '-V', 'fontsize=12pt', '-V', 'linestretch=2', '-V', 'indent=true', '-V', 'documentclass=article', '-V', 'mainfont=Times New Roman');
        }
        // Common options
        // Note: section numbering disabled by default (omitting --number-sections)
        args.push('--from=markdown', '--standalone');
        // Enable citation processing if available
        if (this.pandocVersion && this.pandocVersion.major >= 2) {
            args.push('--citeproc');
        }
        // Debug options
        if (options.debug) {
            args.push('--verbose');
        }
        return args;
    }
    // ===========================================================================
    // MARKDOWN FORMATTING
    // ===========================================================================
    /**
     * Convert a formatted paper to Pandoc Markdown.
     */
    formatToMarkdown(paper) {
        const lines = [];
        // YAML front matter
        lines.push('---');
        lines.push(`title: "${this.escapeYaml(paper.titlePage.title)}"`);
        // Authors
        lines.push('author:');
        for (const author of paper.titlePage.authors) {
            lines.push(`  - name: "${this.escapeYaml(author.name)}"`);
            if (author.affiliation) {
                lines.push(`    affiliation: "${this.escapeYaml(author.affiliation)}"`);
            }
            if (author.orcid) {
                lines.push(`    orcid: "${author.orcid}"`);
            }
        }
        // Running head
        if (paper.titlePage.runningHead) {
            lines.push(`running-head: "${this.escapeYaml(paper.titlePage.runningHead)}"`);
        }
        // Affiliations as array
        if (paper.titlePage.affiliations?.length > 0) {
            lines.push('institute:');
            for (const affiliation of paper.titlePage.affiliations) {
                lines.push(`  - "${this.escapeYaml(affiliation)}"`);
            }
        }
        // Keywords in front matter
        if (paper.abstract?.keywords?.length) {
            lines.push(`keywords: [${paper.abstract.keywords.map((k) => `"${this.escapeYaml(k)}"`).join(', ')}]`);
        }
        // Author note
        if (paper.titlePage.authorNote) {
            lines.push(`author-note: "${this.escapeYaml(paper.titlePage.authorNote)}"`);
        }
        // Document class and other LaTeX-specific options
        lines.push('documentclass: article');
        lines.push('papersize: letter');
        lines.push('geometry: margin=1in');
        lines.push('fontsize: 12pt');
        lines.push('linestretch: 2');
        lines.push('indent: true');
        lines.push('---');
        lines.push('');
        // Abstract
        if (paper.abstract) {
            lines.push('# Abstract {.unnumbered}');
            lines.push('');
            lines.push(paper.abstract.content);
            lines.push('');
            if (paper.abstract.keywords?.length) {
                lines.push(`*Keywords*: ${paper.abstract.keywords.join(', ')}`);
                lines.push('');
            }
            lines.push('\\newpage');
            lines.push('');
        }
        // Body content
        lines.push(this.formatBodyContent(paper.body.content, paper.body.sections));
        // References
        if (paper.references && paper.references.entries.length > 0) {
            lines.push('');
            lines.push('\\newpage');
            lines.push('');
            lines.push('# References {.unnumbered}');
            lines.push('');
            lines.push('::: {#refs .hanging-indent}');
            for (const ref of paper.references.entries) {
                lines.push(ref);
                lines.push('');
            }
            lines.push(':::');
        }
        // Appendices
        if (paper.appendices && paper.appendices.length > 0) {
            for (const appendix of paper.appendices) {
                lines.push('');
                lines.push('\\newpage');
                lines.push('');
                lines.push(`# Appendix ${appendix.label}: ${appendix.title} {.unnumbered}`);
                lines.push('');
                lines.push(appendix.content);
            }
        }
        return lines.join('\n');
    }
    /**
     * Format body content with proper markdown headings.
     */
    formatBodyContent(content, sections) {
        // If we have structured sections, use them
        if (sections && sections.length > 0) {
            return this.formatSections(sections);
        }
        // Otherwise return the raw content
        return content;
    }
    /**
     * Format sections recursively with proper markdown heading levels.
     */
    formatSections(sections, baseLevel = 1) {
        const lines = [];
        for (const section of sections) {
            // Create markdown heading (# for level 1, ## for level 2, etc.)
            const headingMarker = '#'.repeat(Math.min(section.level, 6));
            lines.push(`${headingMarker} ${section.title}`);
            lines.push('');
            if (section.content) {
                lines.push(section.content);
                lines.push('');
            }
            // Recursively format subsections
            if (section.subsections && section.subsections.length > 0) {
                lines.push(this.formatSections(section.subsections, baseLevel + 1));
            }
        }
        return lines.join('\n');
    }
    /**
     * Escape special characters for YAML strings.
     */
    escapeYaml(text) {
        return text.replace(/"/g, '\\"').replace(/\n/g, ' ');
    }
    // ===========================================================================
    // CLEANUP
    // ===========================================================================
    /**
     * Clean up temporary files created during generation.
     */
    async cleanup() {
        for (const file of this.tempFiles) {
            try {
                await unlink(file);
                this.log('debug', `Cleaned up temp file: ${file}`);
            }
            catch {
                // Ignore cleanup errors
                this.log('debug', `Failed to cleanup temp file: ${file}`);
            }
        }
        this.tempFiles = [];
    }
}
// =============================================================================
// FACTORY FUNCTION
// =============================================================================
/**
 * Create a new PandocGenerator instance.
 * @param pandocPath - Optional custom path to pandoc executable
 * @returns New PandocGenerator instance
 */
export function createPandocGenerator(pandocPath) {
    return new PandocGenerator(pandocPath);
}
//# sourceMappingURL=pandoc.js.map