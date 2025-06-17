// Controls
let powerInterval;
document.addEventListener('keydown', e => {
    if (game.locked || game.players.length === 0) return;

    const p = game.players[game.current];

    switch (e.key.toLowerCase()) {
        case 'a': case 'arrowleft': p.move(-3); break;
        case 'd': case 'arrowright': p.move(3); break;
        case 'w': case 'arrowup':
            game.angle = Math.min(180, game.angle + 3);
            p.angle = game.angle;
            break;
        case 's': case 'arrowdown':
            game.angle = Math.max(0, game.angle - 3);
            p.angle = game.angle;
            break;
        case ' ':
            if (!powerInterval) {
                let up = true;
                powerInterval = setInterval(() => {
                    game.power += up ? 2 : -2;
                    if (game.power >= 100) up = false;
                    if (game.power <= 0) up = true;
                    updateUI();
                }, 30);
            }
            break;
    }
    updateUI();
});

document.addEventListener('keyup', e => {
    if (e.key === ' ' && powerInterval) {
        clearInterval(powerInterval);
        powerInterval = null;
        shoot();
    }
});