/**
 * GraphDB Type Definitions
 * Provides types for hypergraph with temporal features
 */
// Temporal Granularity
export var Granularity;
(function (Granularity) {
    Granularity["Hourly"] = "Hourly";
    Granularity["Daily"] = "Daily";
    Granularity["Monthly"] = "Monthly";
})(Granularity || (Granularity = {}));
// Query Direction
export var QueryDirection;
(function (QueryDirection) {
    QueryDirection["Incoming"] = "incoming";
    QueryDirection["Outgoing"] = "outgoing";
    QueryDirection["Both"] = "both";
})(QueryDirection || (QueryDirection = {}));
//# sourceMappingURL=types.js.map