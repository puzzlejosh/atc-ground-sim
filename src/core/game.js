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
// Converts a node ID (like 'GA1') to pixel coordinates on the canvas.
// This is used constantly - by the renderer, physics, UI.
// ------------------------------------------------------------------------
function getNodePosition(nodeID) {
    const node = GameState.airport.nodes[nodeID];
    if (!node) {
        console.error(`Unknown node: ${nodeID}`);
        return { x: 0, y: 0};
    }
    // node is [normalizedX, normalizedY]
    // Multiply by canvas size ot get actual pixels.
    return {
        x: node[0] * canvas.width,
        y: node[1] * canvas.height,
    };
}

// ------------------------------------------------------------------------
// RENDERING
// All drawing commands go here.
// The renderer reads state - it never changes it.
// ------------------------------------------------------------------------
function drawFrame () {
    const W = canvas.width;
    const H = canvas.height;

    // Clear the canvas each frame. We're drawing everything from scratch.
    // Think of it like erasing a whiteboard before drawing again.
    ctx.clearRect(0, 0, W, H);
    
    // --- Background ---
    ctx.fillStyle = '#080c08';
    ctx.fillRect(0, 0, W, H);

    if (!GameState.airport) return;     // nothing to draw yet

    // --- Draw taxiways (edges) ---
    // Each edge is an array of two node IDs: ['GA1', 'TA1']
    // We look up both nodes, get their pixel positions, draw a line.
    for (const edge of GameState.airport.edges) {
        const a = getNodePosition(edge[0]);
        const b = getNodePosition(edge[1]);

        // Outer (dark asphalt fill)
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = '#1c2a1c';
        ctx.lineWidth   = 12;
        ctx.lineCap     = 'round';
        ctx.stroke();

        // Inner (slightly lighter to give depth)
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = '#243024';
        ctx.lineWidth   = 9;
        ctx.lineCap     = 'round';
        ctx.stroke();

        // Centerline dashes (yellow, like real taxiways)
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = 'rgba(180, 160, 40, 0.35';
        ctx.lineWidth   = 1;
        ctx.setLineDash([8,10]);
        ctx.stroke();
        ctx.setLineDash([]);    // IMPORTANT: always reset dash after using it
    }

    // --- Draw runways ---
    for (const rwy of GameState.airport.runways) {
        const a = getNodePosition(rwy.nearNode);
        const b = getNodePosition(rwy.farNode);
        
        // Runway surface
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = '#141c14';
        ctx.lineWidth   = 18;
        ctx.lineCap     = 'square';
        ctx.stroke();

        // Runway edges (white stripes)
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = 'rgba(200, 200, 200, 0.15)';
        ctx.lineWidth   = 26;
        ctx.lineCap     = 'square';
        ctx.stroke();

        // Centerline dashes (white)
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = 'rgba(220, 220, 180, 0.5)';
        ctx.lineWidth   = 1.5;
        ctx.setLineDash([16,16]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Runway label
        const midX = (a.x + b.x) / 2;
        const midY = (a.y + b.y) / 2;
        ctx.fillstyle = 'rgba(140, 160, 140, 0.7)';
        ctx.font      = 'bold 11px Courier New';
        ctx.textAlign = 'center';
        ctx.fillText(rwy.label, midX, midY - 18);
    }

    // --- Draw hold short bars ---
    for (const hsId of GameState.airport.holdShorts) {
        const pos = getNodePosition(hsId);

        // Four yellow/black bars - similar to real life
        for (let i = 0; i < 4; i++) {
            ctx.fillStyle = i % 2 === 0? '#c8900a' : '#141c14';
            ctx.fillRect(pos.x - 16 + i * 8, pos.y  - 3, 8, 6);
        }

        ctx.fillStyle = 'rgba(100, 144, 10, 0.7)';
        ctx.font      = '9px Courier New';
        ctx.textAlign = 'center';
        ctx.fillText('HOLD', pos.x, pos.y - 7);
    }

    // --- Draw gate markers ---
    for (const gateId of GameState.airport.gates) {
        const pos = getNodePosition(gateId);
        const occupied = GameState.aircraft.some(
            ac => ac.gate === gateId && ac.status !== STATUS.DEPARTED
        );

        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 6, 0, Math.PI * 2);
        ctx.fillStyle   = occupied ? '#1e3a1e' : '#141c14';
        ctx.strokeStyle = occupied ? '#3a6a3a' : '#2a3a2a';
        ctx.lineWidth   = 1;
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#4a7a4a';
        ctx.font      = '9px Courier New';
        ctx.textAlign = 'center';
        ctx.fillText(gateId, pos.x, pos.y - 10);
    }

    // --- Draw aircraft trails ---
    for (const ac of GameState.aircraft) {
        if (ac.trail.length < 2) continue;
        ctx.beginPath();
        ctx.moveTo(ac.trail[0].x, ac.trail[0].y);
        for (let i = 1; i < ac.trail.length; i++) {
            ctx.lineTo(ac.trail[i].x, ac.trail[i].y);
        }
        ctx.strokeStyle = 'rgba(74, 154, 74, 0.12)';
        ctx.lineWidth   = 2;
        ctx.stroke();
    }

    // --- Draw aircraft ---
    for (const ac of GameState.aircraft) {
        if (ac.status === STATUS.DEPARTED) continue;

        const isSelected = GameState.selected && GameState.selected.id === ac.id;
        const color = ac.statusColor();

        // Selection ring
        if (isSelected) {
            ctx.beginPath();
            ctx.arc(ac.x, ac.y, 18, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(120, 210, 120, 0.6)';
            ctx.lineWidth   = 1.5;
            ctx.stroke();
        }

        // Aircraft icon - a small triangle pointing in the direction of travel.
        // We rotate the canvas coordinate system, draw the traignel pointing 'up',
        // then restore - this is the standard way to draw rotated shapes.
        ctx.save();                    // save the current transform state
        ctx.translate(ac.x, ac.y);     // move origin to aircraft positions
        ctx.rotate(ac.heading);        // rotate by aircraft heading

        ctx.beginPath();
        ctx.moveTo(0, -7);             // nose
        ctx.lineTo(5, 5);              // right wing root
        ctx.lineTo(0, 2);              // tail notch
        ctx.lineTo(-5, 5);             // left wing root
        ctx.closePath();

        ctx.fillStyle = color;
        ctx.fill();
        if (isSelected) {
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth   = 1;
            ctx.stroke();
        }

        ctx.restore();                 // restore the transform - crucial

        // Callsign label
        ctx.fillStyle = isSelected ? '#ffffff' : '#c8e8c8';
        ctx.font      = `${isSelected ? 'bold ' : ''}10px Courier New`;
        ctx.textAlign = 'left';
        ctx.fillText(ac.callsign, ac.x + 10, ac.y + 3);

        // Status label (smaller, dimmer)
        ctx.fillStyle = '#babeba';
        ctx.font      = '8px Courier New';
        ctx.fillText(ac.status.replace('_', ' ').toUpperCase(), ac.x + 10, ac.y + 12);

        // Amber flash for aircraft waiting too long at hold short
        if (ac.status === STATUS.HOLD_SHORT) {
            const pulse = Math.sin(Date.now() / 400) > 0;
            if (pulse) {
                ctx.beginPath();
                ctx.arc(ac.x, ac.y, 13, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(200, 144, 10, 0.5)';
                ctx.lineWidth   = 2;
                ctx.stroke();
            }
        }
    }
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