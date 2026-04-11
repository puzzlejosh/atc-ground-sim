// src/core/utils.js
// Shared utility functions used across all files

// Converts a node ID (like 'GA1') to pixel coordinates on the canvas.
// This is used constantly - by the renderer, physics, UI.

function getNodePosition(nodeId) {
    const node = GameState.airport.nodes[nodeId];
    if (!node) {
        console.error(`Unknown node: ${nodeId}`);
        return { x: 0, y: 0};
    }
    return {
        x: node[0] * canvas.clientWidth,
        y: node[1] * canvas.clientHeight,
    };
}