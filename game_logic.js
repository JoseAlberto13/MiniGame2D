
let game = {
  mode: 1, players: [], current: 0, power: 0, angle: 45,
  projectiles: [], explosions: [], terrain: [], locked: false,
  turnCount: 0, windChangeCounter: 0
};

const gravity = 0.2;
let wind = (Math.random() - 0.5) * 0.08;

// Highlight time for current player
let highlightTime = 0;

function updateHighlightTime() {
  highlightTime += 0.06;
  requestAnimationFrame(updateHighlightTime);
}


// Setup menu
document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    game.mode = +btn.dataset.players;
    document.getElementById('startBtn').disabled = false;
  };
});

document.getElementById('startBtn').onclick = startGame;

// Timer for turns
let turnTimer = 20;
let timerInterval = null;

function startTurnTimer() {
  turnTimer = 20; // Reset timer

  if (timerInterval) clearInterval(timerInterval);

  timerInterval = setInterval(() => {
    turnTimer--;

    if (turnTimer <= 0) {
      clearInterval(timerInterval);
      nextTurn(); // debes tener esta función ya definida
    }
  }, 1000);
}

function startGame() {
  document.getElementById('menu').style.display = 'none';
  document.getElementById('game').style.display = 'flex';

  generateTerrain();
  game.players = [];
  game.projectiles = [];
  game.explosions = [];
  game.current = 0;
  game.locked = false;
  game.turnCount = 0;
  game.windChangeCounter = 0;
  wind = (Math.random() - 0.5) * 0.08;

  const colors1 = '#e74c3c';
  const colors2 = '#3498db';

  // Create teams
  for (let i = 0; i < game.mode; i++) {
    game.players.push(new Player(80 + i * 60, 1, `Rojo ${i + 1}`, colors1));
    game.players.push(new Player(W - 80 - i * 60, 2, `Azul ${i + 1}`, colors2));
  }
  createWindLines();
  createWindParticles();
  startTurnTimer();
  updateGame();
  updateUI();
}

function updateGame() {
  for (let p of game.players) p.y = getTerrainAt(p.x) - 15;
}

function updateUI() {
  const teams = [[], []];
  game.players.forEach(p => teams[p.team - 1].push(p));

  // Actualizar vida en marcador
  ['team1', 'team2'].forEach((id, i) => {
    document.getElementById(id).innerHTML =
      `<h3>${i ? '🔵 Azul' : '🔴 Rojo'}</h3>` +
      teams[i].map(p => `<div>${p.name}: ${Math.round(p.health)}💚</div>`).join('');
  });

  const current = game.players[game.current];
  document.getElementById('player').textContent = current.name;
  document.getElementById('angle').textContent = game.angle;
  document.getElementById('power').textContent = game.power;

  // Actualizar información del viento
  const windStrength = (Math.abs(wind) * 1000).toFixed(1);
  const windDirection = wind > 0 ? '→' : '←';
  const windColor = Math.abs(wind) > 0.05 ? 'orange' : 'lightgreen';
  const windElement = document.getElementById('windInfo');
  windElement.innerHTML = `<span style="color: ${windColor}">${windDirection} ${windStrength}%</span>`;
}

function shoot() {
  if (game.locked || game.power === 0) return;

  game.locked = true;
  const p = game.players[game.current];
  const rad = game.angle * Math.PI / 180;
  const power = game.power / 100 * 12;

  const x = p.x + Math.cos(rad) * 25;
  const y = p.y - 5 - Math.sin(rad) * 25;
  const vx = Math.cos(rad) * power;
  const vy = -Math.sin(rad) * power;

  shotSound.play();
  game.projectiles.push(new Projectile(x, y, vx, vy));
  game.power = 0;
}

function nextTurn() {
  game.locked = false;
  game.turnCount++;
  game.windChangeCounter++;
  game.players[game.current].moved = 0;

  // Cambiar viento cada X turnos
  if (game.windChangeCounter >= 4) {
    wind = (Math.random() - 0.5) * 0.1;
    game.windChangeCounter = 0;
  }

  do {
    game.current = (game.current + 1) % game.players.length;
  } while (game.players[game.current].health <= 0);

  game.angle = game.players[game.current].angle;
  game.power = 0;

  updateUI();
  startTurnTimer();
}

function checkGameOver() {
  const alive = [0, 0];
  game.players.forEach(p => { if (p.health > 0) alive[p.team - 1]++; });

  if (alive[0] === 0 || alive[1] === 0) {
    const winner = alive[0] > 0 ? '🔴 Equipo Rojo' : '🔵 Equipo Azul';
    document.body.insertAdjacentHTML('beforeend',
      `<div class="game-over">
      <h2>🎉 ¡${winner} Gana! 🎉</h2>
      <button class="btn" onclick="location.reload()">Reiniciar</button>
      </div>`);
    return true;
  }
  return false;
}

function gameLoop() {
  // Update projectiles
  game.projectiles = game.projectiles.filter(p => p.update() !== false);

  // Update explosions
  game.explosions.forEach(e => { e.r = Math.min(e.r + 2, 30); e.life--; });
  game.explosions = game.explosions.filter(e => e.life > 0);

  draw();
  requestAnimationFrame(gameLoop);
}

updateHighlightTime();
gameLoop();