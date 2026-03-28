// src/core/aircraft.js
//
// The Aircraft class is the most important data structure in this sim.
// Every plane on the airport is one instance of this class.
// Its job is to HOLD STATE - to be the single source of truth
// about one aircraft at one moment in time.
//
// KEY CONCEPT: State Machine
// An aircraft is always in exactly ONE status at a time.
// It can only move to certain statuses from certain others.
// This is called a 'state machine' and it's on of the most useful patterns in game development
//
// Valid transitions:
// PARKED -> PUSHBACK -> TAXI -> HOLD_SHORT -> LINEUP -> DEPARTED
//
// You cannot go from PARKED directly to LINEUP.
// You cannot go backwards.
// This mirros real ATC procedure exactly.

// These are the valid statuses.
// We define them as a constant object so we can write Aircraft.STATUS.PARKED. instead of the string 'parked'.
// Why? Because if you mistype 'praked', JavaScript won't warn you.
// It'll just silently be wrong. Using a constant means a typo causes an immediate error, which is easier to debug.
const STATUS = {
  PARKED:     'parked',      // at gate, engine off, not yet called in
  REQUESTING: 'requesting',  // called in, waiting for pushback clearance
  PUSHBACK:   'pushback',    // pushing back from gate
  TAXI:       'taxi',        // taxiing under own power
  HOLD_SHORT: 'hold_short',  // stopped at hold short line, awaiting crossing clearance
  LINEUP:     'lineup',      // on runway, handed to tower
  DEPARTED:   'departed',    // gone — will be removed from sim shortly
};

// These are the aircraft types we'll simulate.
// Each has a real ICAO code and a display name.
const AIRCRAFT_TYPES = [
    { icao: 'B738', name: 'Boeing 737-800',   size: 'medium'},
    { icao: 'A320', name: 'Airbus A320',      size: 'medium'},
    { icao: 'B77W', name: 'Boeing 777-300ER', size: 'heavy'},
    { icao: 'A388', name: 'Airbus A380-800',  size: 'super'},
    { icao: 'E175', name: 'Embraer 175',      size: 'small'},
    { icao: 'B788', name: 'Boeing 787-8',     size: 'heavy'},
    { icao: 'A321', name: 'Airbus A321',      size: 'medium'},
    { icao: 'CRJ9', name: 'Bombardier CRJ9',  size: 'small'},
];

// Airline callsign prefixes and their spoken names.
// In real ATC, AAL is spoken "American", UAL is "United", etc.
const AIRLINES = [
    { prefix: 'AAL', spoken: 'American'     },
    { prefix: 'UAL', spoken: 'United'       },
    { prefix: 'DAL', spoken: 'Delta'        },
    { prefix: 'SWA', spoken: 'Southwest'    },
    { prefix: 'BAW', spoken: 'Speedbird'    },
    { prefix: 'DLH', spoken: 'Lufthansa'    },
    { prefix: 'AFR', spoken: 'Air France'   },
    { prefix: 'UAE', spoken: 'Emirates'     },
    { prefix: 'QFA', spoken: 'Qantas'       },
    { prefix: 'KAL', spoken: 'Korean'       },
];

class Aircraft {

    // The constructor runs once when you call 'new Aircraft(...)'.
    // It sets up the initial state of this aircraft.
    //
    // Parameters:
    //  id      - a unique number so we can tell aircraft apart
    //  gate    - the node ID string where this aircraft starts (e.g. 'Gate 1')
    //  airport - the full airport object from layout.js (we need its nodes)
    constructor(id, gate, airport) {

        // --- Identity ---
        this.id     = id;
        this.gate   = gate;

        // Pick a random airlinea nd aircraft type.
        // Math.random() returns a float between 0 and 1.
        // Multiplying by array.length and flooring it gives a random valid index.
        // This pattern comes up constantly: Memorize!
        const airline = AIRLINES[Math.floor(Math.random() * AIRLINES.length)];
        const actype  = AIRCRAFT_TYPES[Math.floor(Math.random() * AIRCRAFT_TYPES.length)];

        this.airline  = airline;
        this.actype   = actype;

        // Build the callsign: prefix + random 3-digit number, e.g. "AAL742"
        const flightNum = Math.floor(100 + Math.random() * 900);
        this.callsign   = airline.prefix + flightNum;

        // --- Position ---
        // posNode: which graph node the aircraft is currently AT
        // nextNode: which node it's currently moving TOWARD (null if still)
        // moveProgress: how far along the edge ot nextNode (0.0 = at posNode, 1.0 = at nextNode)
        this.posNode      = gate;
        this.nextNode     = null;
        this.moveProgress = 0;

        // The aircraft's current pixel postiion on screen.
        // We compute this from posNode/nextNode/moveProgress in physics.js.
        // We store it here so the renderer can read it without recomputing.
        this.x = 0;
        this.y = 0;

        // Heading in radians (for drawing the aircraft icon pointing the right way)
        this.heading = 0;

        // --- Route ---
        // The full list of node IDs this aircraft will travel through.
        // Starts at gate, ends at the hold short position.
        // We'll fill this in when the controller issues a taxi clearance.
        this.route    = [gate];   // just the gate for now
        this.routeIdx = 0;        // which step of the route we're currently at

        // --- State ---
        this.status = STATUS.PARKED;

        // Has the controller selected this aircraft?
        this.selected = false;
        
        // Has the controller issued a hold short clearance here?
        this.holdShortNode = null;

        //Should the aircraft stop and wait? (used for sequencing)
        this.holdPosition = false;

        // --- Timing ---
        // We record when things happened so we can show waiting times
        // and eventually score the player.
        this.spawnTime      = Date.now();
        this.requestTime    = null; // when they first called in
        this.clearedTime    = null; // When we gave pushback clearance
        this.departTime     = null; // When they left our frequency

        // Visual trail - We save recent positions so we can draw a line showing where the aircraft has been
        this.trail = []
    }

    // ------------------------------------------------------------------------
    // STATE TRANSITIONS
    // These methods change the aircraft's status.
    // Putting them here means all status-change logic lives in one place.
    // The game loop and UI call these methods; they don't set wstatus directly.
    // ------------------------------------------------------------------------

    // Called when the aircraft first raiods in requesting pushback.
    requestPushback() {
        if (this.status !== STATUS.PARKED) return; // guard: Can only do this when PARKED
        this.status      = STATUS.REQUESTING;
        this.requestTime = Date.now();
    }

    // Called when the controller approves pushback.
    approvePushback(route) {
        if (this.status !== STATUS.REQUESTING) return;
        this.status      = STATUS.PUSHBACK;
        this.clearedTime = Date.now();

        // The controller is also providing the taxi route here.
        // We set the full route and point to the first step after the gate.
        this.route     = route;
        this.routeIdx  = 0;
    }

    // Called when pushback is complete and taxi begins.
    beginTaxi() {
        if (this.status !== STATUS.PUSHBACK) return;
        this.status = STATUS.TAXI;
    }

    // Called automatically when the aircraft reaches a hold short node.
    arriveHoldShort() {
        if (this.status !== STATUS.TAXI) return;
        this.status   = STATUS.HOLD_SHORT;
        this.nextNode = null;           // stop moving
        this.moveProgress = 0;
    }

    // Called when the controller clears the aircraft to cross the runway.
    clearToCross() {
        if (this.status !== STATUS.HOLD_SHORT) return;
        this.status = STATUS.TAXI;      // back to taxiing, so it continues moving
        this.holdShortNode = null;
    }

    // CAlled when the aircraft reaches the runway and is handed ot tower.
    handoffToTower() {
        if (this.status !== STATUS.TAXI && this.status !== STATUS.HOLD_SHORT) return;
        this.status     = STATUS.LINEUP;
        this.departTime = Date.now();
    }

    // Called a few seconds after handoff, to clean up the aircraft.
    depart() {
        this.status = STATUS.DEPARTED;
    }

    // ------------------------------------------------------------------------
    // HELPERS
    // Small utility methods the renderer and UI will call.
    // ------------------------------------------------------------------------

    // How many seconds has this aircraft been waiting since it called in?
    waitSeconds() {
        if (!this.requestTime) return 0;
        return Math.floor((Date.now() - this.requestTime) / 1000);
    }

    // Returns a color string based on status - used by renderer.
    statusColor() {
        const colors = {
            [STATUS.PARKED]:     '#2a4a2a',
            [STATUS.REQUESTING]: '#3a7ab8',
            [STATUS.PUSHBACK]:   '#4a9a4a',
            [STATUS.TAXI]:       '#4a9a4a',
            [STATUS.HOLD_SHORT]: '#c8900a',
            [STATUS.LINEUP]:     '#7a5ab8',
            [STATUS.DEPARTED]:   '#1a2a1a',
        };
        return colors[this.status] || '#ffffff';
    }

    // Is this aircraft actively moving on the taxiway?
    isMoving() {
        return (
            this.status === STATUS.PUSHBACK ||
            this.status === STATUS.TAXI
        ) && !this.holdPosition;
    }

}

// Make STATUS and Aircraft available to other scripts.
window.STATUS   = STATUS;
window.Aircraft = Aircraft;