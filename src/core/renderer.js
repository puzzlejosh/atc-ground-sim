// RENDERING
// All drawing commands go here.
// The renderer reads state - it never changes it.

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

window.drawFrame = drawFrame;