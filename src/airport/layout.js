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

    nodes: {
      // Gates
      GA1: [0.35, 0.20],
      GA2: [0.35, 0.30],
      GA3: [0.35, 0.40],
      GA4: [0.35, 0.50],
      GB1: [0.35, 0.60],
      GB2: [0.35, 0.70],
      GB3: [0.35, 0.80],

      // Taxiway Alpha (spine closest to gates)
      A1: [0.45, 0.20],
      A2: [0.45, 0.50],
      A3: [0.45, 0.80],

      // Taxiway Bravo (middle spine)
      B1: [0.55, 0.20],
      B2: [0.55, 0.50],
      B3: [0.55, 0.80],

      // Taxiway Charlie (closest to runway)
      C1: [0.65, 0.20],
      C2: [0.65, 0.50],
      C3: [0.65, 0.80],

      // Hold short positions
      HS_28L: [0.75, 0.30],
      HS_28R: [0.75, 0.65],

      // Runway endpoints
      RWY_28L_NEAR: [0.82, 0.10],
      RWY_28L_FAR:  [0.82, 0.90],
      RWY_28R_NEAR: [0.93, 0.10],
      RWY_28R_FAR:  [0.93, 0.90],
    },

    edges: [
      // Gates to Alpha
      ['GA1', 'A1'],
      ['GA2', 'A1'],
      ['GA3', 'A2'],
      ['GA4', 'A2'],
      ['GB1', 'A3'],
      ['GB2', 'A3'],
      ['GB3', 'A3'],

      // Alpha vertical
      ['A1', 'A2'],
      ['A2', 'A3'],

      // Alpha to Bravo
      ['A1', 'B1'],
      ['A2', 'B2'],
      ['A3', 'B3'],

      // Bravo vertical
      ['B1', 'B2'],
      ['B2', 'B3'],

      // Bravo to Charlie
      ['B1', 'C1'],
      ['B2', 'C2'],
      ['B3', 'C3'],

      // Charlie vertical
      ['C1', 'C2'],
      ['C2', 'C3'],

      // Charlie to hold short
      ['C1', 'HS_28L'],
      ['C2', 'HS_28L'],
      ['C3', 'HS_28R'],

      // Hold short to runway
      ['HS_28L', 'RWY_28L_NEAR'],
      ['HS_28R', 'RWY_28R_NEAR'],
    ],

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

    gates: ['GA1','GA2','GA3','GA4','GB1','GB2','GB3'],

    holdShorts: ['HS_28L', 'HS_28R'],

    activeRunway: '28L',

    taxiRoutes: {
      GA1: ['GA1','A1','B1','C1','HS_28L'],
      GA2: ['GA2','A1','B1','C1','HS_28L'],
      GA3: ['GA3','A2','B2','C2','HS_28L'],
      GA4: ['GA4','A2','B2','C2','HS_28L'],
      GB1: ['GB1','A3','B3','C3','HS_28R'],
      GB2: ['GB2','A3','B3','C3','HS_28R'],
      GB3: ['GB3','A3','B3','C3','HS_28R'],
    },
  },

};

window.AIRPORTS = AIRPORTS;