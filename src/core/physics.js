// src/core/physics.js

const TAXI_SPEED = 0.04;

function updatePhysics(dt) {
    for (const ac of GameState.aircraft) {
        if (!ac.isMoving()) continue;
        if (ac.nextNode === null) {
            ac.routeIdx++;
            if (ac.routeIdx < ac.route.length) {
                ac.nextNode = ac.route[ac.routeIdx];
            } else {
                continue;
            }
        }
        ac.moveProgress += dt * TAXI_SPEED;

        const from = getNodePosition(ac.posNode);
        const to   = getNodePosition(ac.nextNode);

        ac.x = from.x + (to.x - from.x) * ac.moveProgress;
        ac.y = from.y + (to.y - from.y) * ac.moveProgress;

        const dx = to.x - from.x;
        const dy = to.y - from.y;
        ac.heading = Math.atan2(dy,dx) + Math.PI/2;

        if(ac.moveProgress >= 1.0) {
            ac.posNode      = ac.nextNode;
            ac.nextNode     = null;
            ac.moveProgress = 0;

            const isHoldShort = GameState.airport.holdShorts.includes(ac.posNode);
            if (isHoldShort) {
                ac.arriveHoldShort();
            }
        }
    }
}

window.updatePhysics = updatePhysics;       // makes it available to game.js
