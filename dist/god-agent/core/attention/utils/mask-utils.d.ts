/**
 * Attention Mask Utilities
 *
 * Provides functions for creating and manipulating attention masks.
 *
 * Mask Semantics (PyTorch convention):
 * - true: Attend to this position
 * - false: Mask out this position (prevent attention)
 */
/**
 * Generate causal (lower triangular) attention mask
 *
 * Prevents tokens from attending to future positions.
 * Used in autoregressive language modeling.
 *
 * Pattern for seqLen=4:
 * ```
 * [[true,  false, false, false],   // Token 0 attends only to itself
 *  [true,  true,  false, false],   // Token 1 attends to 0, 1
 *  [true,  true,  true,  false],   // Token 2 attends to 0, 1, 2
 *  [true,  true,  true,  true ]]   // Token 3 attends to all
 * ```
 *
 * @param seqLen Sequence length
 * @returns Boolean mask [seq_len × seq_len] (flattened row-major)
 *          Semantics: true=attend, false=mask out (PyTorch convention)
 *
 * @example
 * ```typescript
 * const mask = createCausalMask(3);
 * // Returns: [true, false, false,
 * //           true, true,  false,
 * //           true, true,  true]
 *
 * const output = attention.forward(query, key, value, mask, 3);
 * ```
 */
export declare function createCausalMask(seqLen: number): boolean[];
/**
 * Create full attention mask (no masking)
 *
 * All positions can attend to all other positions.
 *
 * @param seqLen Sequence length
 * @returns Boolean mask [seq_len × seq_len] with all true
 */
export declare function createFullMask(seqLen: number): boolean[];
/**
 * Validate mask dimensions and semantics
 *
 * @param mask Attention mask
 * @param seqLen Expected sequence length
 * @returns True if valid
 */
export declare function validateMask(mask: boolean[], seqLen: number): boolean;
//# sourceMappingURL=mask-utils.d.ts.map