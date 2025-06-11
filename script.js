const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

let game = {
  mode: 1, players: [], current: 0, power: 0, angle: 45,
  projectiles: [], explosions: [], terrain: [], locked: false,
  turnCount: 0, windChangeCounter: 0
};

const gravity = 0.2;
let wind = (Math.random() - 0.5) * 0.08;

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

// Highlight time for current player
let highlightTime = 0;

function updateHighlightTime() {
  highlightTime += 0.06;
  requestAnimationFrame(updateHighlightTime);
}
updateHighlightTime();

// Player class
class Player {
  constructor(x, team, name, color) {
    this.x = x; this.team = team; this.name = name; this.color = color;
    this.health = 100; this.angle = team === 1 ? 45 : 135;
    this.y = getTerrainAt(x) - 15;
  }

  draw() {
    if (this.health <= 0) return;
    const x = this.x, y = this.y;

    // Tank tracks as oval/ellipse under the body
    ctx.fillStyle = 'rgba(32, 48, 66, 0.53)'; // gris oscuro
    ctx.beginPath();
    ctx.ellipse(x, y + 13, 24, 4, 0, 0, Math.PI * 2); // centro x, y, radioX, radioY
    ctx.fill();
    ctx.strokeStyle = '#2c3e50';
    ctx.lineWidth = 3.3;
    ctx.stroke();

    // Tank body
    ctx.fillStyle = this.color;
    ctx.fillRect(x - 20, y - 10, 40, 20);
    ctx.strokeStyle = '#2c3e50';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(x - 20, y - 10, 40, 20);

    // Turret
    ctx.beginPath();
    ctx.arc(x, y - 5, 12, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    // Barrel - Canon
    const rad = this.angle * Math.PI / 180;
    const bx = x + Math.cos(rad) * 25;
    const by = y - 5 - Math.sin(rad) * 25;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x, y - 5);
    ctx.lineTo(bx, by);
    ctx.stroke();

    // Health bar
    const hp = this.health / 100;
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(x - 20, y - 32, 42, 5);
    ctx.fillStyle = hp > 0.6 ? '#2ecc71' : hp > 0.3 ? '#f39c12' : '#e74c3c';
    ctx.fillRect(x - 20, y - 32, 42 * hp, 5);

    // Current player highlight (dynamic pulsing circle)
    if (game.players[game.current] === this) {
      const pulse = 3 * Math.sin(highlightTime) + 35;
      ctx.strokeStyle = '#f1c40f';
      ctx.lineWidth = 3.2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(x, y - 5, pulse, -11, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      // Turn timer display
      ctx.font = "bold 18px sans-serif";
      ctx.fillStyle = "#f1c40f";
      ctx.textAlign = "center";
      ctx.fillText(`⏱ ${turnTimer}s`, x, y - 48);
    }
  }
  
  move(dx) {
    this.x = Math.max(25, Math.min(W - 25, this.x + dx));
    this.y = getTerrainAt(this.x) - 15;
  }
}

// Projectile class
class Projectile {
  constructor(x, y, vx, vy) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.trail = [];
  }

  update() {
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 7) this.trail.shift();

    this.x += this.vx; this.y += this.vy;
    this.vy += gravity; this.vx += wind;

    if (this.x < 0 || this.x > W || this.y > H) return this.explode();
    if (this.y >= getTerrainAt(this.x) - 3) return this.explode();

    // Hit player
    for (let p of game.players) {
      if (p.health > 0 && Math.hypot(this.x - p.x, this.y - p.y) < 25) {
        return this.explode();
      }
    }
  }

  explode() {
    game.explosions.push({ x: this.x, y: this.y, r: 0, life: 20 });

    // Damage players
    for (let p of game.players) {
      if (p.health > 0) {
        const dist = Math.hypot(this.x - p.x, this.y - p.y);
        if (dist < 50) p.health = Math.max(0, p.health - (50 - dist));
      }
    }

    // Modify terrain
    for (let i = 0; i < game.terrain.length; i++) {
      const dist = Math.abs(game.terrain[i].x - this.x);
      if (dist < 30) game.terrain[i].y += (30 - dist) * 0.3;
    }

    updateGame();
    setTimeout(() => {
      if (!checkGameOver()) nextTurn();
    }, 800);

    return false;
  }

  draw() {
    // Trail
    ctx.strokeStyle = 'rgba(255, 66, 37, 0.94)';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    this.trail.forEach((p, i) => {
      ctx.globalAlpha = i / this.trail.length;
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Projectile
    ctx.fillStyle = 'rgb(255, 69, 84)';
    ctx.beginPath();
    ctx.arc(this.x, this.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function generateTerrain() {
  game.terrain = [];
  let h = H - 60;
  for (let i = 0; i <= 50; i++) {
    const x = i * W / 50;
    h += (Math.random() - 0.5) * 20;
    h = Math.max(H - 120, Math.min(H - 40, h));
    game.terrain.push({ x, y: h });
  }

  // Smooth
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 1; i < game.terrain.length - 1; i++) {
      const avg = (game.terrain[i - 1].y + game.terrain[i].y + game.terrain[i + 1].y) / 3;
      game.terrain[i].y = avg;
    }
  }
}


// Wind Particles - Animación Viento
let windLines = [];
let windParticles = [];

function createWindLines() {
  windLines = [];
  for (let i = 0; i < 15; i++) {
    windLines.push({
      x: Math.random() * W,
      y: Math.random() * (H * 0.85),
      length: 20 + Math.random() * 30,
      angle: 0,
      speed: 0.5 + Math.random() * 1,
      curve: 0.6 + Math.random() * 0.4,
      opacity: 0.2 + Math.random() * 0.3
    });
  }
}


function createWindParticles() {
  windParticles = [];
  for (let i = 0; i < 30; i++) {
    windParticles.push({
      x: Math.random() * W,
      y: H * 0.35 + Math.random() * (H * 0.5),
      baseY: 0, // base para oscilación
      size: 2 + Math.random() * 2,
      opacity: Math.random() * 0.6 + 0.3,
      drift: Math.random() * 2 * Math.PI, // desfase de oscilación
      speedY: 0.3 + Math.random() * 0.2,   // velocidad vertical suave
    });
  }
}

function drawWindLines() {
  const absWind = Math.abs(wind) * 1000;
  if (absWind < 7) return; // No mostrar si el viento es bajo

  windLines.forEach(l => {
    // Movimiento
    const direction = wind > 0 ? 1 : -1;
    l.x += direction * (absWind / 40 + l.speed);
    l.angle += 0.1;

    // Reset si salen de pantalla
    if (l.x < -50) l.x = W + 50;
    if (l.x > W + 50) l.x = -50;

    // Dibujar línea curva estilo viento
    ctx.beginPath();
    ctx.globalAlpha = l.opacity;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.lineWidth = 1.2;

    for (let i = 0; i < l.length; i++) {
      const t = i / l.length;
      const cx = l.x + direction * i;
      const cy = l.y + Math.sin(l.angle + t * 1 * Math.PI) * l.curve * 6;

      if (i === 0) ctx.moveTo(cx, cy);
      else ctx.lineTo(cx, cy);
    }

    ctx.stroke();
    ctx.globalAlpha = 1;
  });
}

function drawWindParticles() {
  const absWind = Math.abs(wind) * 1000;
  if (absWind < 7) return; // No dibujar partículas

  windParticles.forEach(p => {
    // Movimiento horizontal por viento
    let baseSpeed = absWind / 30;
    p.x += wind > 0 ? baseSpeed : -baseSpeed;

    // Movimiento oscilante vertical (flotación)
    p.drift += 0.05; // fase de oscilación
    const floatOffset = Math.sin(p.drift) * 3;

    // Desvanecimiento al borde
    const fadeMargin = 20;
    if (p.x < fadeMargin || p.x > W - fadeMargin) {
      p.opacity = Math.max(0, p.opacity - 0.02);
    }

    // Reiniciar si desaparece o sale del canvas
    if (p.x > W + 20 || p.x < -20 || p.opacity <= 0) {
      p.x = Math.random() * W;
      p.y = H * 0.7 + Math.random() * (H * 0.3);
      p.opacity = Math.random() * 0.6 + 0.3;
      p.drift = Math.random() * Math.PI * 2;
    }

    // Dibujar partícula
    ctx.beginPath();
    ctx.globalAlpha = p.opacity;
    ctx.fillStyle = `rgba(0, 161, 13, 0.73)`;
    ctx.arc(p.x, p.y + floatOffset, p.size, 3, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  });
}


// Generació Terrreno
function getTerrainAt(x) {
  const step = W / 50;
  const i = Math.floor(x / step);
  if (i >= game.terrain.length - 1) return game.terrain[game.terrain.length - 1].y;

  const t1 = game.terrain[i], t2 = game.terrain[i + 1];
  const ratio = (x - t1.x) / (t2.x - t1.x);
  return t1.y + (t2.y - t1.y) * ratio;
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

function nextTurn() {
  game.locked = false;
  game.turnCount++;
  game.windChangeCounter++;

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
    
    game.projectiles.push(new Projectile(x, y, vx, vy));
    game.power = 0;
  }
  
  function drawWindIndicator() {
    const centerX = W - 550;
    const centerY = 40;
    const windStrength = Math.abs(wind);
    const windDirection = wind > 0 ? 1 : -1;
    
    // Marco y Fondo del indicador de viento
    ctx.fillStyle = 'rgba(34, 130, 175, 0.42)';
    ctx.fillRect(centerX - 62, centerY - 30, 125, 65);
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.strokeRect(centerX - 62, centerY - 30, 125, 65);
    
    // Texto del viento
    ctx.fillStyle = 'white';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('🌬️💨🌪️ VIENTO', centerX, centerY - 6);
    
    // Intensidad del viento
    const intensity = (windStrength * 1000).toFixed(1);
    ctx.fillText(`${intensity}%`, centerX, centerY + 22);
    
    // Flecha direccional
    const arrowLength = 35;
    const arrowX = centerX + (windDirection * arrowLength);
    const arrowY = centerY + 4;
    
    // Color de la flecha según intensidad
    const alpha = Math.min(windStrength * 15, 1);
    ctx.strokeStyle = `rgba(255, 255, 0, ${alpha + 0.3})`;
    ctx.fillStyle = `rgba(255, 255, 0, ${alpha + 0.3})`;
    ctx.lineWidth = 3;
    
    // Línea principal de la flecha
    ctx.beginPath(); 
    ctx.moveTo(centerX, centerY + 4);
    ctx.lineTo(arrowX, arrowY);
    ctx.stroke();
    
    // Punta de la flecha
    ctx.beginPath();
    ctx.moveTo(arrowX, arrowY);
    ctx.lineTo(arrowX - (windDirection * 8), arrowY - 7);
    ctx.lineTo(arrowX - (windDirection * 8), arrowY + 7);
    ctx.closePath();
    ctx.fill();
    
    // Indicador de cambio de viento
    if (game.windChangeCounter === 1) {
      ctx.fillStyle = 'rgba(250, 150, 0, 0.89)';
      ctx.font = 'bold 16px Arial';
      ctx.fillText('¡Cambiará próximo turno!', centerX, centerY + 60);
    }
    
    ctx.textAlign = 'left'; // Resetear alineación
  }
  
  function draw() {
    ctx.clearRect(0, 0, W, H);
    
    // Terrain
    ctx.fillStyle = '#228B22';
    ctx.beginPath();
    ctx.moveTo(0, H);
    game.terrain.forEach(t => ctx.lineTo(t.x, t.y));
    ctx.lineTo(W, H);
    ctx.fill();
    
    // Players
    game.players.forEach(p => p.draw());
    
    // Projectiles
    game.projectiles.forEach(proj => proj.draw());
    
    // Explosions
    game.explosions.forEach(exp => {
      ctx.globalAlpha = exp.life / 20;
      ctx.fillStyle = '#ff6b35';
      ctx.beginPath();
      ctx.arc(exp.x, exp.y, exp.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    });
    
    // Wind indicator mejorado
    drawWindLines();
    drawWindParticles();
    drawWindIndicator();
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

gameLoop();