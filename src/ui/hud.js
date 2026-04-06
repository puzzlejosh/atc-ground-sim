// src/ui/hud.js
// this file controls the action bar:
// the buttons that appear when you select an aircraft.

function updateActionBar() {
    const bar = document.getElementById('action-bar');
    const ac = GameState.selected;
    if (!ac) {
        bar.innerHTML = '';
        return;
    }
   
    bar.innerHTML = `
        <div class="ac-info">
            <span class="ac-callsign">${ac.callsign}</span>
            <span class="ac-detail">${ac.airline.spoken} · ${ac.actype.icao}</span>
            <span class="ac-detail">Gate ${ac.gate} · ${ac.status}</span>
        </div>
    `;

    if (ac.status === STATUS.REQUESTING) {
        const btn = document.createElement('button');
        btn.textContent = 'Pushback approved';
        btn.onclick = () => issuePushback(ac);
        bar.appendChild(btn);
    }

    function issuePushback(ac) {
        const route = GameState.airport.taxiRoutes[ac.gate];
        ac.approvePushback(route);
    }
    
}

function updateHUD() {
    const callsignDisplay = document.getElementById('selected-callsign');
    const ac = GameState.selected;

    if (ac) {
        callsignDisplay.textContent = ac.callsign;
        document.getElementById('cmd-input').focus();
    } else {
        callsignDisplay.textContent = '---';
    }
}

function handleCommand(input) {
    const ac = GameState.selected;

    if (!ac) return;

    const cmd = input.trim();
    const cmdLower = cmd.toLowerCase();

    if (cmdLower === 'pa') {
        const route = GameState.airport.taxiRoutes[ac.gate];
        ac.approvePushback(route);
        document.getElementById('cmd-input').value = '';
    }

    if (cmdLower.startsWith('t ')) {
        const parts = cmd.split(' ').map(p => p.toUpperCase());
        parts.shift();

        const validRoute = parts.every(node => GameState.airport.nodes[node]);
        if (!validRoute) {
            console.log('invaid node in route:', parts);
            return;
        }

        const route = [ac.posNode, ...parts];
        ac.route = route;
        ac.routeIdx = 0;
        ac.nextNode = null;
        ac.beginTaxi();
        document.getElementById('cmd-input').value = '';
    }
}

document.getElementById('cmd-send').onclick = () => {
    handleCommand(document.getElementById('cmd-input').value);
};

document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        handleCommand(document.getElementById('cmd-input').value);
    }
});