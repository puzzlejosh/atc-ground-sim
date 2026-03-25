// src/airport/layout.js
//
// An airport is a GRAPH: nodes connected by edges.
// A node is any named point: a gate, a taxiway intersection,
// a hold short line, or a runway threshold.
// Coordinates are in [0..1] normalized space — we multiply by
// canvas width/height at draw time, so the map scales to any screen.

const AIRPORTS = {

  KJFK: {
    icao: 'KJFK',
    name: 'John F. Kennedy International',
    atis: {
      info: 'Alpha',
      wind: '310/12KT',
      vis: '10SM',
      ceiling: 'CLR',
    },

    // Each node: [normalizedX, normalizedY]
    // Think of the canvas as a 1x1 square.
    // x=0 is left edge, x=1 is right edge.
    // y=0 is top edge, y=1 is bottom edge.
    nodes: {
      // Gates (where aircraft start)
      GA1: [0.08, 0.20],
      GA2: [0.08, 0.28],
      GA3: [0.08, 0.36],
      GA4: [0.08, 0.44],
      GB1: [0.08, 0.58],
      GB2: [0.08, 0.66],
      GB3: [0.08, 0.74],

      // Taxiway spine nodes (intersections)
      TA1: [0.20, 0.20],
      TA2: [0.20, 0.44],
      TA3: [0.20, 0.74],
      TB1: [0.38, 0.20],
      TB2: [0.38, 0.44],
      TB3: [0.38, 0.74],
      TC1: [0.55, 0.20],
      TC2: [0.55, 0.44],
      TC3: [0.55, 0.74],

      // Hold short positions (aircraft stop here and call in)
      HS_28L: [0.68, 0.30],
      HS_28R: [0.68, 0.62],

      // Runway thresholds (the ends of the runways)
      RWY_28L_NEAR: [0.72, 0.20],
      RWY_28L_FAR:  [0.72, 0.88],
      RWY_28R_NEAR: [0.85, 0.20],
      RWY_28R_FAR:  [0.85, 0.88],
    },

    // Edges define which nodes are directly connected.
    // The taxiway system is two-directional unless noted.
    edges: [
      // Gate aprons to taxiway spine A
      ['GA1', 'TA1'],
      ['GA2', 'TA1'],
      ['GA3', 'TA2'],
      ['GA4', 'TA2'],
      ['GB1', 'TA3'],
      ['GB2', 'TA3'],
      ['GB3', 'TA3'],

      // Spine A vertical (connects all A nodes)
      ['TA1', 'TA2'],
      ['TA2', 'TA3'],

      // Spine A to B horizontal connectors
      ['TA1', 'TB1'],
      ['TA2', 'TB2'],
      ['TA3', 'TB3'],

      // Spine B vertical
      ['TB1', 'TB2'],
      ['TB2', 'TB3'],

      // Spine B to C
      ['TB1', 'TC1'],
      ['TB2', 'TC2'],
      ['TB3', 'TC3'],

      // Spine C vertical
      ['TC1', 'TC2'],
      ['TC2', 'TC3'],

      // C to hold short
      ['TC1', 'HS_28L'],
      ['TC2', 'HS_28L'],
      ['TC3', 'HS_28R'],

      // Hold short to runway
      ['HS_28L', 'RWY_28L_NEAR'],
      ['HS_28R', 'RWY_28R_NEAR'],
    ],

    // Named runways with their two endpoint node IDs
    runways: [
      {
        id: '28L',
        nearNode: 'RWY_28L_NEAR',
        farNode: 'RWY_28L_FAR',
        label: '28L / 10R',
        heading: 280,
      },
      {
        id: '28R',
        nearNode: 'RWY_28R_NEAR',
        farNode: 'RWY_28R_FAR',
        label: '28R / 10L',
        heading: 280,
      },
    ],

    // Which nodes are gates (aircraft can spawn here)
    gates: ['GA1','GA2','GA3','GA4','GB1','GB2','GB3'],

    // Which nodes are hold short positions
    holdShorts: ['HS_28L', 'HS_28R'],

    // Active departure runway for this ATIS
    activeRunway: '28L',

    // Pre-computed taxi routes: gate → ordered list of nodes → hold short
    // We'll replace this with real pathfinding in Stage 3.
    // For now, explicit routes get the sim running.
    taxiRoutes: {
      GA1: ['GA1','TA1','TB1','TC1','HS_28L'],
      GA2: ['GA2','TA1','TB1','TC1','HS_28L'],
      GA3: ['GA3','TA2','TB2','TC2','HS_28L'],
      GA4: ['GA4','TA2','TB2','TC2','HS_28L'],
      GB1: ['GB1','TA3','TB3','TC3','HS_28R'],
      GB2: ['GB2','TA3','TB3','TC3','HS_28R'],
      GB3: ['GB3','TA3','TB3','TC3','HS_28R'],
    },
  },

};

// We export by attaching to window so other scripts can access it.
// (In a proper module system you'd use `export const AIRPORTS = ...`
// but we're keeping this simple for now.)
window.AIRPORTS = AIRPORTS;