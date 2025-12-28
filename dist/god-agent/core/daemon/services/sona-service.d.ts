/**
 * Sona Service - IPC wrapper for SonaEngine
 * TASK-DAEMON-003: Service Registry & Integration
 *
 * Exposes trajectory tracking and weight management via JSON-RPC 2.0
 */
import type { SonaEngine } from '../../learning/sona-engine.js';
import type { Route, PatternID, TrajectoryID, Weight } from '../../learning/sona-types.js';
import { type ServiceHandler } from '../service-registry.js';
/**
 * Sona service parameters
 */
export interface ISonaCreateTrajectoryParams {
    route: Route;
    patterns: PatternID[];
    context?: string[];
}
export interface ISonaProvideFeedbackParams {
    trajectoryId: TrajectoryID;
    quality: number;
    lScore?: number;
}
export interface ISonaGetWeightParams {
    patternId: PatternID;
    route: Route;
}
export interface ISonaSetWeightParams {
    patternId: PatternID;
    route: Route;
    weight: Weight;
}
/**
 * Create SONA service handler
 *
 * @param sonaEngine - SonaEngine instance
 * @returns Service handler with method map
 */
export declare function createSonaService(sonaEngine: SonaEngine): ServiceHandler;
//# sourceMappingURL=sona-service.d.ts.map