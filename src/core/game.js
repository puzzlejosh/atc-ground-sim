// src/core/game.js
//
// The game loop is the engine.
// Everything else is data and logic. This file drives it all.
//
// CONCEPT: Delta Time
// 'dt' = seconds since the last frame.
// On a 60fps machine, dt = 0.0167 sec/frame
// We mutliply all movement and timers by dt so the game runs at the same perceived speed regardless of frame rate.

// ------------------------------------------------------------------------
// GAME STATE
// All mutable (changeable) state lives here as one object.
// This makes it easy to see everything the game tracks at once,
// and means we're never hunting for a random global variable.
// ------------------------------------------------------------------------
const GameState = {

    // The simulation clock, in sec from midnight.
    // We start at 08:00 local = 28800 sec.
    simTime: 28800,

    // The timestamp of the last animation frame, in ms
    // Used to compute dt each frame.
    lastFrameTime: null,

    // All aircraft currently in the sim (array of Aircraft instances).
    aircraft: [],

    // The currently selected aircraft (one Aircraft instance, or null).
    selected: null,

    // Counter for assigning unique IDs to new aircraft.
    nextAircraftId: 1,

    // How many seconds until we spawn the next aircraft.
    // Starts low so traffic appears quickly at game stars.
    nextSpawnIn: 3,

    // Which airport we're controlling.
    // This is the full airport object from AIRPORTS in layout.js.
    airport: null,

    // Is the game pause?
    pause: false,

    // Time compression: 1 = real time, 2 = 2x speed, etc.
    timeScale: 1,

    // Player score and stats.
    stats: {
        departed: 0,
        conflicts: 0,
        avgWaitSeconds: 0,
    },
};

// ------------------------------------------------------------------------
// CANVAS SETUP
// We grab the canvas element and its 2D drawing context.
// 'ctx' is the object we call all drawing commands on.
// ------------------------------------------------------------------------
const canvas = document.getElementById('airport-canvas');
const ctx    = canvas.getContext('2d');

// We need the canvas to always match the window size.
// This function sets canvas.width and canvas.height to current window dims.
// We call it on load and whenever the window resizes.
function resizeCanvas() {
    canvas.width  = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
}

window.addEventListener('resize', () => {
    resizeCanvas();
    // AFter resize, immediately redraw so there's no blank flash.
    drawFrame();
});

// ------------------------------------------------------------------------
// SPAWNING
// Aircraft appear at random available gates and immediately call in requesting pushback.
// ------------------------------------------------------------------------

// Returns a list of gates that are currently empty.
function getAvailableGates() {
    const occupiedGates = new Set(
        GameState.aircraft
        .filter(ac => ac.status !== STATUS.DEPARTED)
        .map(ac => ac.gate)
    );
    return GameState.airport.gates.filter(g => !occupiedGates.has(g));
}

function spawnAircraft() {
    const available = getAvailableGates();
    if (available.length === 0) return;     // no room

    // Pick a ranodm free gate.
    const gate = available[Math.floor(Math.random() * available.length)];

    // Create the aircraft.
    const ac = new Aircraft(GameState.nextAircraftId++, gate, GameState.airport);

    // Set its pixel position immediately so it doesn't start at (0,0).
    const nodePos = getNodePosition(gate);
    ac.x = nodePos.x;
    ac.y = nodePos.y;

    // Add to the sim.
    GameState.aircraft.push(ac);

    // After a short random delay (1-4 sec of sim time),
    // the aircraft calls in requesting pushback.
    // We simulate this by scheduling a status change.
    const callInDelay = 1 + Math.random() * 3;
    setTimeout(() => {
        ac.requestPushback();
        // Trigger a comms message.
        // We'll define addComm in comms.js - for now we guard against it not existing yet.
        if (window.addComm) {
            const info = GameState.airport.atis.info;
            addComm('pilot', ac.callsign,
                `${GameState.airport.icao} Ground, ${ac.airline.spoken} ${ac.callsign.slice(3)}, ` +
                `gate ${gate}, ${ac.actype.icao}, ready for pushback, information ${info}.`
            );
        }
        if (window.updateStrips) updateStrips();
    }, callInDelay * 1000);
}

// ------------------------------------------------------------------------
// THE GAME LOOP
// This is the heartbeat. It runs every frame.
// ------------------------------------------------------------------------
function gameLoop(timestamp) {

    // On the very first frame, lastFrameTime is null.
    // We just record the time and skip the update - dt would be garbage.
    if (GameState.lastFrameTime === null) {
        GameState.lastFrameTime = timestamp;
        requestAnimationFrame(gameLoop);
        return;
    }

    // dt = time since last frame, in seconds.
    // We cap it at 0.1 sec (100ms). Why?
    // If the user switches tabs, the browser throttles requestAnimationFrame.
    // When they come back, dt could be 10 sec - which would teleport all the aircraft. The cap prevents that.
    const dt = Math.min((timestamp - GameState.lastFrameTime) / 100, 0.1) * GameState.timeScale;
    GameState.lastFrameTime = timestamp;

    if (!GameState.pause) {

        // Advance simulation clock
        GameState.simTime += dt;

        // Spawn timer
        GameState.nextSpawnIn -= dt;
        if (GameState.nextSpawnIn <= 0) {
            const activeCount = GameState.aircraft.filter(
                ac => ac.status !== STATUS.DEPARTED
            ).length;
            if (activeCount < 7) {
                spawnAircraft();
            }
            // Next spawn in 12-25 real seconds (divided by timeScale)
            GameState.nextspawnIn = (12 + Math.random() * 13);
        }

        // Update all aircraft positions (physics.js does this)
        if (window.updatePhysics) {
            updatePhysics(dt);
        }

        // Clean up departed aircraft after 20 sec
        GameState.aircraft = GameState.aircraft.filter(ac => {
            return ac.status !== STATUS.DEPARTED ||
            (Date.now() - ac.departTime) < 20000;
        });
    }

    // Draw - happens every frame even when paused
    drawFrame();

    // Update HUD clock
    if (window.updateHUD) updateHUD();

    // Schedule the next frame
    requestAnimationFrame(gameLoop);
} 

// ------------------------------------------------------------------------
// INPUT HANDLING
// Clicking the canvas selects/deselects aircraft.
// ------------------------------------------------------------------------
canvas.addEventListener('click', (event) => {
    // Get the click position relative to the canvas, not the whole page.
    const rect = canvas.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;

    // Find the closest aircraft to the click point.
    let closestAC   = null;
    let closestDist = Infinity;

    for (const ac of GameState.aircraft) {
        if (ac.status === STATUS.DEPARTED) continue;
        const dist = Math.hypot(ac.x - clickX, ac.y - clickY);
        if (dist < closestDist) {
            closestDist = dist;
            closestAC   = ac;
        }
    }

    // Only select if click was within 24 pixels of an aircraft.
    if (closestAC && closestDist < 24) {
        GameState.selected = closestAC;
    } else {
        GameState.selected = null;  // click on empty space = deselect
    }

    // Whenever the selection changes, update the action buttons.
    if (window.updateActionBar) updateActionBar();
    if (window.updateStrips)    updateStrips();
});

// ------------------------------------------------------------------------
// INIT
// This runs once when the page loads.
// ------------------------------------------------------------------------
function init() {
    // Set hte airport. Right now we hardcode KJFK.
    // Later we'll let player choose.
    GameState.airport = AIRPORTS.KJFK;

    // Size the canvas correctly before first draw.
    resizeCanvas();

    // Start with a couple of aircraft already at gates
    // so the player has something to do immediatley.
    for (let i = 0; i < 3; i++) {
        setTimeout(() => spawnAircraft(), i * 1500);
    }

    // Start the game loop.
    // Pass the function itself (not a call to it) - this is the standard pattern.
    requestAnimationFrame(gameLoop);
}

// Run init when the DOM is fully loaded.
// If scripts are at the bottom of body, this fires immediately,
// but the pattern is good practice regardless.
window.addEventListener('DOMContentLoaded', init);

// Make things available to other scripts
window.GameState       = GameState;
window.getNodePosition = getNodePosition;
window.canvas          = canvas;
window.ctx             = ctx;