/**
 * PipelineTracker - Track DAI-002 pipeline execution with step-by-step progress
 *
 * Implements pipeline execution tracking with per-step timing, status, and overall progress.
 * Maintains bounded list of active and completed pipelines with FIFO eviction.
 *
 * @module observability/pipeline-tracker
 * @see TASK-OBS-004-PIPELINE-TRACKER.md
 * @see TECH-OBS-001-IMPLEMENTATION.md Section 3.5
 */
import { createComponentLogger, ConsoleLogHandler, LogLevel } from '../core/observability/index.js';
const logger = createComponentLogger('PipelineTracker', {
    minLevel: LogLevel.WARN,
    handlers: [new ConsoleLogHandler()]
});
// =============================================================================
// Implementation
// =============================================================================
/**
 * PipelineTracker implementation
 *
 * Implements:
 * - [REQ-OBS-06]: Pipeline execution monitoring
 * - [REQ-OBS-10]: Pipeline status and per-step execution tracking
 * - [RULE-OBS-004]: Memory bounds enforcement (20 completed max)
 */
export class PipelineTracker {
    activityStream;
    // Active pipelines by ID
    active = new Map();
    // Completed pipelines (FIFO, max 20)
    completed = [];
    // Maximum completed pipelines to retain
    MAX_COMPLETED = 20;
    /**
     * Create a new PipelineTracker
     * @param activityStream ActivityStream for event emission
     */
    constructor(activityStream) {
        this.activityStream = activityStream;
    }
    /**
     * Start tracking a new pipeline
     * Implements [REQ-OBS-10]: Track pipeline start
     *
     * @param pipeline Pipeline start configuration
     * @returns Unique pipeline ID (format: pipe_{name}_{timestamp}_{random})
     */
    startPipeline(pipeline) {
        // Generate pipeline ID
        const pipelineId = this.generatePipelineId(pipeline.name);
        // Initialize steps as pending
        const steps = pipeline.steps.map((stepName) => ({
            id: '', // Will be set when step starts
            name: stepName,
            status: 'pending',
        }));
        // Create pipeline status
        const pipelineStatus = {
            id: pipelineId,
            name: pipeline.name,
            status: 'running',
            startTime: Date.now(),
            totalSteps: pipeline.steps.length,
            completedSteps: 0,
            steps,
            progress: 0,
        };
        // Store in active map
        this.active.set(pipelineId, pipelineStatus);
        // Emit pipeline_started event
        this.activityStream.push({
            id: `evt_${Date.now()}_${this.randomId()}`,
            timestamp: Date.now(),
            component: 'pipeline',
            operation: 'pipeline_started',
            status: 'running',
            metadata: {
                pipelineId,
                name: pipeline.name,
                taskType: pipeline.taskType,
                totalSteps: pipeline.steps.length,
                steps: pipeline.steps,
                ...pipeline.metadata,
            },
        });
        return pipelineId;
    }
    /**
     * Start a pipeline step
     *
     * @param pipelineId Pipeline ID
     * @param step Step start configuration
     * @returns Unique step ID
     */
    startStep(pipelineId, step) {
        const pipeline = this.active.get(pipelineId);
        if (!pipeline) {
            logger.warn('Attempted to start step in unknown pipeline', { pipelineId });
            return '';
        }
        // Find the step by name
        const stepIndex = pipeline.steps.findIndex((s) => s.name === step.name && s.status === 'pending');
        if (stepIndex === -1) {
            logger.warn('Step not found or already started in pipeline', { stepName: step.name, pipelineId });
            return '';
        }
        // Generate step ID
        const stepId = this.generateStepId(pipelineId, stepIndex);
        // Update step status
        pipeline.steps[stepIndex] = {
            id: stepId,
            name: step.name,
            status: 'running',
            startTime: Date.now(),
            agentType: step.agentType,
        };
        // Update current step
        pipeline.currentStep = step.name;
        // Emit step_started event
        this.activityStream.push({
            id: `evt_${Date.now()}_${this.randomId()}`,
            timestamp: Date.now(),
            component: 'pipeline',
            operation: 'step_started',
            status: 'running',
            metadata: {
                pipelineId,
                stepId,
                stepName: step.name,
                stepIndex,
                agentType: step.agentType,
            },
        });
        return stepId;
    }
    /**
     * Mark a step as completed
     *
     * @param pipelineId Pipeline ID
     * @param stepId Step ID
     * @param result Step result data
     */
    completeStep(pipelineId, stepId, result) {
        const pipeline = this.active.get(pipelineId);
        if (!pipeline) {
            logger.warn('Attempted to complete step in unknown pipeline', { pipelineId });
            return;
        }
        // Find the step by ID
        const step = pipeline.steps.find((s) => s.id === stepId);
        if (!step) {
            logger.warn('Step not found in pipeline (complete)', { stepId, pipelineId });
            return;
        }
        // Calculate duration
        const endTime = Date.now();
        const durationMs = step.startTime ? endTime - step.startTime : 0;
        // Update step status
        step.status = 'success';
        step.endTime = endTime;
        step.durationMs = durationMs;
        // Update pipeline progress
        pipeline.completedSteps++;
        pipeline.progress = (pipeline.completedSteps / pipeline.totalSteps) * 100;
        // Clear current step if all completed
        if (pipeline.completedSteps === pipeline.totalSteps) {
            pipeline.currentStep = undefined;
        }
        else {
            // Set current step to next pending step
            const nextStep = pipeline.steps.find((s) => s.status === 'pending');
            pipeline.currentStep = nextStep?.name;
        }
        // Emit step_completed event
        this.activityStream.push({
            id: `evt_${Date.now()}_${this.randomId()}`,
            timestamp: Date.now(),
            component: 'pipeline',
            operation: 'step_completed',
            status: 'success',
            durationMs,
            metadata: {
                pipelineId,
                stepId,
                stepName: step.name,
                progress: pipeline.progress,
                completedSteps: pipeline.completedSteps,
                totalSteps: pipeline.totalSteps,
                filesModified: result.filesModified,
            },
        });
    }
    /**
     * Mark a step as failed
     *
     * @param pipelineId Pipeline ID
     * @param stepId Step ID
     * @param error Error that caused failure
     */
    failStep(pipelineId, stepId, error) {
        const pipeline = this.active.get(pipelineId);
        if (!pipeline) {
            logger.warn('Attempted to fail step in unknown pipeline', { pipelineId });
            return;
        }
        // Find the step by ID
        const step = pipeline.steps.find((s) => s.id === stepId);
        if (!step) {
            logger.warn('Step not found in pipeline (fail)', { stepId, pipelineId });
            return;
        }
        // Calculate duration
        const endTime = Date.now();
        const durationMs = step.startTime ? endTime - step.startTime : 0;
        // Update step status
        step.status = 'error';
        step.endTime = endTime;
        step.durationMs = durationMs;
        step.error = error.message;
        // Emit step_failed event
        this.activityStream.push({
            id: `evt_${Date.now()}_${this.randomId()}`,
            timestamp: Date.now(),
            component: 'pipeline',
            operation: 'step_failed',
            status: 'error',
            durationMs,
            metadata: {
                pipelineId,
                stepId,
                stepName: step.name,
                error: error.message,
            },
        });
    }
    /**
     * Mark pipeline as completed
     *
     * @param pipelineId Pipeline ID
     * @param result Pipeline result data
     */
    completePipeline(pipelineId, result) {
        const pipeline = this.active.get(pipelineId);
        if (!pipeline) {
            logger.warn('Attempted to complete unknown pipeline', { pipelineId });
            return;
        }
        // Update pipeline status
        const endTime = Date.now();
        pipeline.status = 'success';
        pipeline.endTime = endTime;
        pipeline.currentStep = undefined;
        // Move from active to completed
        this.active.delete(pipelineId);
        this.addCompleted(pipeline);
        // Emit pipeline_completed event
        this.activityStream.push({
            id: `evt_${Date.now()}_${this.randomId()}`,
            timestamp: Date.now(),
            component: 'pipeline',
            operation: 'pipeline_completed',
            status: 'success',
            durationMs: result.totalDurationMs,
            metadata: {
                pipelineId,
                name: pipeline.name,
                totalSteps: pipeline.totalSteps,
                completedSteps: pipeline.completedSteps,
                progress: pipeline.progress,
            },
        });
    }
    /**
     * Mark pipeline as failed
     *
     * @param pipelineId Pipeline ID
     * @param error Error that caused failure
     */
    failPipeline(pipelineId, error) {
        const pipeline = this.active.get(pipelineId);
        if (!pipeline) {
            logger.warn('Attempted to fail unknown pipeline', { pipelineId });
            return;
        }
        // Calculate duration
        const endTime = Date.now();
        const durationMs = endTime - pipeline.startTime;
        // Update pipeline status
        pipeline.status = 'error';
        pipeline.endTime = endTime;
        pipeline.currentStep = undefined;
        // Move from active to completed
        this.active.delete(pipelineId);
        this.addCompleted(pipeline);
        // Emit pipeline_failed event
        this.activityStream.push({
            id: `evt_${Date.now()}_${this.randomId()}`,
            timestamp: Date.now(),
            component: 'pipeline',
            operation: 'pipeline_failed',
            status: 'error',
            durationMs,
            metadata: {
                pipelineId,
                name: pipeline.name,
                error: error.message,
                completedSteps: pipeline.completedSteps,
                totalSteps: pipeline.totalSteps,
            },
        });
    }
    /**
     * Get all active pipelines
     * @returns Array of active pipeline statuses
     */
    getActive() {
        return Array.from(this.active.values());
    }
    /**
     * Get a pipeline by ID
     * @param pipelineId Pipeline ID
     * @returns Pipeline status or null if not found
     */
    getById(pipelineId) {
        // Check active first
        const activePipeline = this.active.get(pipelineId);
        if (activePipeline) {
            return activePipeline;
        }
        // Check completed
        const completedPipeline = this.completed.find((p) => p.id === pipelineId);
        return completedPipeline || null;
    }
    /**
     * Get statistics about tracker state
     */
    getStats() {
        return {
            activeCount: this.active.size,
            completedCount: this.completed.length,
            maxCompleted: this.MAX_COMPLETED,
        };
    }
    // ===========================================================================
    // Private Methods
    // ===========================================================================
    /**
     * Generate a unique pipeline ID
     * Format: pipe_{name}_{timestamp}_{random}
     *
     * @param name Pipeline name
     * @returns Unique pipeline ID
     */
    generatePipelineId(name) {
        const timestamp = Date.now();
        const random = this.randomId();
        return `pipe_${name}_${timestamp}_${random}`;
    }
    /**
     * Generate a unique step ID
     * Format: step_{pipelineId}_{stepIndex}_{random}
     *
     * @param pipelineId Pipeline ID
     * @param stepIndex Step index
     * @returns Unique step ID
     */
    generateStepId(pipelineId, stepIndex) {
        const random = this.randomId();
        return `step_${pipelineId}_${stepIndex}_${random}`;
    }
    /**
     * Generate a random 6-character ID
     * @returns Random alphanumeric string
     */
    randomId() {
        return Math.random().toString(36).substring(2, 8);
    }
    /**
     * Add a completed pipeline to the completed list
     * Implements FIFO eviction when exceeding MAX_COMPLETED
     *
     * @param pipeline The completed pipeline
     */
    addCompleted(pipeline) {
        // Add to end of array
        this.completed.push(pipeline);
        // Evict oldest if exceeding max
        if (this.completed.length > this.MAX_COMPLETED) {
            this.completed.shift(); // Remove first (oldest)
        }
    }
}
// =============================================================================
// Default Export
// =============================================================================
export default PipelineTracker;
//# sourceMappingURL=pipeline-tracker.js.map