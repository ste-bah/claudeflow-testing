/**
 * GNN Backpropagation - Gradient Computation for GNN Training
 *
 * Implements backward pass functions for all forward operations in gnn-math.ts.
 * This enables the GNN to learn from user feedback through gradient descent.
 *
 * PRD: PRD-GOD-AGENT-001
 * Task: TASK-GNN-001 (Mathematical Foundation)
 * Gap: GAP-GNN-002 (Backpropagation Support)
 *
 * CONSTITUTION COMPLIANCE:
 * - RULE-079: No magic numbers (uses VECTOR_DIM constant)
 * - RULE-089: Dimension consistency enforced in all operations
 *
 * Mathematical References:
 * - Softmax backward: Goodfellow et al. "Deep Learning", Section 6.2.2.3
 * - Attention backward: Vaswani et al. "Attention Is All You Need", Section 3.2.1
 * - Gradient clipping: Pascanu et al. "On the difficulty of training RNNs"
 *
 * @module src/god-agent/core/reasoning/gnn-backprop
 */
/**
 * Result of backward pass through a projection layer
 * Contains gradients with respect to weights and input
 *
 * @interface GradientResult
 * Implements: TASK-GNN-001 Section 2.2.1
 */
export interface GradientResult {
    /** Gradient with respect to weight matrix dL/dW (outputDim x inputDim) */
    dW: Float32Array[];
    /** Gradient with respect to input vector dL/dx (inputDim) */
    dx: Float32Array;
}
/**
 * Gradients for attention mechanism components
 * Contains gradients for Query, Key, and Value matrices
 *
 * @interface AttentionGradients
 * Implements: TASK-GNN-001 Section 2.2.2
 */
export interface AttentionGradients {
    /** Gradient with respect to Query vectors */
    dQ: Float32Array;
    /** Gradient with respect to Key vectors */
    dK: Float32Array;
    /** Gradient with respect to Value vectors */
    dV: Float32Array;
}
/**
 * Configuration for gradient computation
 *
 * @interface GradientConfig
 * Implements: TASK-GNN-001 Section 2.2.3
 */
export interface GradientConfig {
    /** Maximum gradient magnitude for clipping (prevents exploding gradients) */
    maxGradientNorm?: number;
    /** Epsilon for numerical stability in divisions */
    epsilon?: number;
    /** Whether to accumulate gradients (for batch processing) */
    accumulateGradients?: boolean;
}
/**
 * Clip gradients by norm to prevent exploding gradients
 * Implements: Pascanu et al. "On the difficulty of training RNNs"
 *
 * @param gradient - Gradient vector to clip
 * @param maxNorm - Maximum allowed L2 norm
 * @returns Clipped gradient vector
 */
export declare function clipGradient(gradient: Float32Array, maxNorm?: number): Float32Array;
/**
 * Check if gradient contains NaN or Inf values
 * Implements: TASK-GNN-001 AC-005 (edge cases)
 *
 * @param gradient - Gradient to check
 * @returns true if gradient is valid (no NaN/Inf)
 */
export declare function isGradientValid(gradient: Float32Array): boolean;
/**
 * Compute gradients for matrix-vector projection Y = Wx
 *
 * Given:
 * - Y = W * x (output = weights * input)
 * - dL/dY (gradient from upstream)
 *
 * Compute:
 * - dL/dW = dL/dY outer x^T (outer product)
 * - dL/dx = W^T * dL/dY (matrix-vector product)
 *
 * Mathematical derivation:
 * Y_i = sum_j(W_ij * x_j)
 * dL/dW_ij = dL/dY_i * dY_i/dW_ij = dL/dY_i * x_j
 * dL/dx_j = sum_i(dL/dY_i * dY_i/dx_j) = sum_i(dL/dY_i * W_ij) = (W^T * dL/dY)_j
 *
 * Implements: TASK-GNN-001 Section 2.2.1 (projection backward)
 * Gap: GAP-GNN-002
 *
 * @param gradient - Upstream gradient dL/dY (outputDim)
 * @param W - Weight matrix as array of rows (outputDim x inputDim)
 * @param x - Input vector (inputDim)
 * @param inputDim - Input dimension (default: VECTOR_DIM)
 * @param outputDim - Output dimension (default: VECTOR_DIM)
 * @param config - Optional gradient configuration
 * @returns GradientResult with dW and dx
 */
export declare function project_backward(gradient: Float32Array, W: Float32Array[], x: Float32Array, inputDim?: number, outputDim?: number, config?: GradientConfig): GradientResult;
/**
 * Compute gradient through softmax function
 *
 * Given softmax output sigma = softmax(z), the Jacobian is:
 * dsigma_i/dz_j = sigma_i * (delta_ij - sigma_j)
 *
 * Where delta_ij is the Kronecker delta (1 if i=j, else 0)
 *
 * The gradient dL/dz is computed as:
 * dL/dz = diag(sigma) * dL/dsigma - sigma * (sigma^T * dL/dsigma)
 *
 * Simplified:
 * dL/dz_i = sigma_i * (dL/dsigma_i - sum_j(sigma_j * dL/dsigma_j))
 *         = sigma_i * (dL/dsigma_i - dot(sigma, dL/dsigma))
 *
 * Implements: TASK-GNN-001 Section 2.2.2 (softmax backward)
 * Reference: Goodfellow et al. "Deep Learning", Section 6.2.2.3
 * Gap: GAP-GNN-002
 *
 * @param gradient - Upstream gradient dL/dsigma
 * @param softmaxOutput - Output of forward softmax pass (sigma)
 * @param config - Optional gradient configuration
 * @returns Gradient with respect to softmax input (dL/dz)
 */
export declare function softmax_backward(gradient: Float32Array, softmaxOutput: Float32Array, config?: GradientConfig): Float32Array;
/**
 * Compute gradients for scaled dot-product attention
 *
 * Forward pass:
 * scores = (Q . K) / sqrt(d_k)
 * weights = softmax(scores)
 * output = weights . V
 *
 * Backward pass:
 * dL/dV = weights^T * dL/doutput
 * dL/dweights = dL/doutput * V^T
 * dL/dscores = softmax_backward(dL/dweights, weights)
 * dL/dQ = (dL/dscores * K) / sqrt(d_k)
 * dL/dK = (dL/dscores * Q) / sqrt(d_k)
 *
 * For single Q, K, V vectors (as used in graph attention):
 * score = (Q . K) / sqrt(d_k)
 * output = score * V
 *
 * Implements: TASK-GNN-001 Section 2.2.3 (attention backward)
 * Reference: Vaswani et al. "Attention Is All You Need", Section 3.2.1
 * Gap: GAP-GNN-002
 *
 * @param gradient - Upstream gradient dL/dOutput
 * @param Q - Query vector
 * @param K - Key vector
 * @param V - Value vector
 * @param attentionWeights - Softmax-normalized attention weights from forward pass
 * @param scale - Scaling factor (default: 1/sqrt(dim))
 * @param config - Optional gradient configuration
 * @returns AttentionGradients with dQ, dK, dV
 */
export declare function attention_backward(gradient: Float32Array, Q: Float32Array, K: Float32Array, V: Float32Array, attentionWeights: Float32Array, scale?: number, config?: GradientConfig): AttentionGradients;
/**
 * Distribute loss gradient across aggregated neighbor features
 *
 * In the forward pass, weighted aggregation computes:
 * output = sum_i(weight_i * feature_i)
 *
 * The backward pass distributes the gradient equally or proportionally:
 * dL/dfeature_i = weight_i * dL/doutput
 *
 * For mean aggregation (uniform weights), this simplifies to:
 * dL/dfeature_i = (1/N) * dL/doutput
 *
 * Implements: TASK-GNN-001 Section 2.2.4 (aggregate backward)
 * Gap: GAP-GNN-002
 *
 * @param gradient - Upstream gradient dL/dOutput
 * @param neighborContributions - Original neighbor feature vectors
 * @param weights - Optional attention weights (if not provided, uses uniform)
 * @param config - Optional gradient configuration
 * @returns Array of gradients, one per neighbor
 */
export declare function aggregate_backward(gradient: Float32Array, neighborContributions: Float32Array[], weights?: Float32Array, config?: GradientConfig): Float32Array[];
/**
 * Compute gradient through ReLU activation
 *
 * Forward: relu(x) = max(0, x)
 * Backward: drelu/dx = 1 if x > 0, else 0
 *
 * @param gradient - Upstream gradient
 * @param input - Original input to ReLU (pre-activation)
 * @returns Gradient with respect to input
 */
export declare function relu_backward(gradient: Float32Array, input: Float32Array): Float32Array;
/**
 * Compute gradient through Leaky ReLU activation
 *
 * Forward: leaky_relu(x) = x if x > 0, else 0.01 * x
 * Backward: dleaky_relu/dx = 1 if x > 0, else 0.01
 *
 * @param gradient - Upstream gradient
 * @param input - Original input to Leaky ReLU
 * @param alpha - Negative slope (default: 0.01)
 * @returns Gradient with respect to input
 */
export declare function leaky_relu_backward(gradient: Float32Array, input: Float32Array, alpha?: number): Float32Array;
/**
 * Compute gradient through Tanh activation
 *
 * Forward: tanh(x)
 * Backward: dtanh/dx = 1 - tanh(x)^2
 *
 * @param gradient - Upstream gradient
 * @param output - Output of tanh (post-activation)
 * @returns Gradient with respect to input
 */
export declare function tanh_backward(gradient: Float32Array, output: Float32Array): Float32Array;
/**
 * Compute gradient through Sigmoid activation
 *
 * Forward: sigmoid(x) = 1 / (1 + exp(-x))
 * Backward: dsigmoid/dx = sigmoid(x) * (1 - sigmoid(x))
 *
 * @param gradient - Upstream gradient
 * @param output - Output of sigmoid (post-activation)
 * @returns Gradient with respect to input
 */
export declare function sigmoid_backward(gradient: Float32Array, output: Float32Array): Float32Array;
/**
 * Generic activation backward dispatcher
 * Routes to appropriate backward function based on activation type
 *
 * @param gradient - Upstream gradient
 * @param inputOrOutput - Either input (for ReLU variants) or output (for tanh/sigmoid)
 * @param activation - Activation function type
 * @returns Gradient with respect to activation input
 */
export declare function activation_backward(gradient: Float32Array, inputOrOutput: Float32Array, activation: 'relu' | 'leaky_relu' | 'tanh' | 'sigmoid'): Float32Array;
/**
 * Complete backward pass for a single GNN layer
 *
 * Combines projection, activation, and optional residual backward passes.
 * Mirrors the forward pass in gnn-enhancer.ts applyLayer().
 *
 * Forward pass order:
 * 1. output = project(input, weights)
 * 2. output = activation(output)
 * 3. if residual: output = output + input; output = normalize(output)
 *
 * Backward pass order (reverse):
 * 1. if residual: gradient += gradient (residual connection)
 * 2. gradient = activation_backward(gradient)
 * 3. {dW, dx} = project_backward(gradient)
 *
 * Implements: TASK-GNN-001 Section 2.2.5 (layer backward)
 * Gap: GAP-GNN-002
 *
 * @param gradient - Upstream gradient dL/dOutput
 * @param input - Original layer input
 * @param weights - Weight matrix used in forward pass
 * @param preActivation - Output before activation (for activation backward)
 * @param postActivation - Output after activation
 * @param activation - Activation function type
 * @param useResidual - Whether residual connection was used
 * @param config - Optional gradient configuration
 * @returns GradientResult with weight and input gradients
 */
export declare function layer_backward(gradient: Float32Array, input: Float32Array, weights: Float32Array[], preActivation: Float32Array, postActivation: Float32Array, activation?: 'relu' | 'leaky_relu' | 'tanh' | 'sigmoid', useResidual?: boolean, config?: GradientConfig): GradientResult;
/**
 * Accumulate gradients for batch processing
 *
 * Used when processing multiple samples before updating weights.
 * Averages gradients over the batch.
 *
 * @param accumulated - Current accumulated gradients (modified in place)
 * @param newGradient - New gradient to add
 * @param batchSize - Total batch size for averaging
 */
export declare function accumulateGradient(accumulated: Float32Array, newGradient: Float32Array, batchSize?: number): void;
/**
 * Accumulate weight gradients for batch processing
 *
 * @param accumulated - Current accumulated weight gradients
 * @param newGradients - New weight gradients to add
 * @param batchSize - Total batch size for averaging
 */
export declare function accumulateWeightGradients(accumulated: Float32Array[], newGradients: Float32Array[], batchSize?: number): void;
/**
 * Create zeroed gradient accumulators for weight matrix
 *
 * @param numRows - Number of rows (output dimension)
 * @param numCols - Number of columns (input dimension)
 * @returns Zeroed weight gradient accumulator
 */
export declare function createWeightGradientAccumulator(numRows: number, numCols: number): Float32Array[];
//# sourceMappingURL=gnn-backprop.d.ts.map