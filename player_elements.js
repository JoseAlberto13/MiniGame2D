// Player class
class Player {
  constructor(x, team, name, color) {
    this.x = x; this.team = team; this.name = name; this.color = color;
    this.health = 100; this.angle = team === 1 ? 45 : 135;
    this.moved = 0; // cantidad de movimiento en el turno
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

    // Movement bar
    const maxMove = 150;
    const moveRatio = Math.max(0, 1 - this.moved / maxMove);
    ctx.fillStyle = '#2c3e50'; // fondo
    ctx.fillRect(x - 20, y - 24, 42, 4);
    ctx.fillStyle = moveRatio > 0.6 ? '#3498db' : moveRatio > 0.3 ? '#f1c40f' : '#e67e22';
    ctx.fillRect(x - 20, y - 24, 42 * moveRatio, 4);

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
      
      // Power bar (vertical)
      const maxHeight = 40;
      const powerRatio = game.power / 100;
      const barX = x + 40; // al lado derecho del tanque
      const barY = y + 12; // alineado con el tanque
      // Fondo
      ctx.fillStyle = '#2c3e50';
      ctx.fillRect(barX, barY - maxHeight, 10, maxHeight);
      // Color dinámico
      const barColor = powerRatio > 0.66 ? '#e74c3c' : powerRatio > 0.33 ? '#f39c12' : '#2ecc71';
      ctx.fillStyle = barColor;
      // Barra
      ctx.fillRect(barX, barY - maxHeight + (1 - powerRatio) * maxHeight, 10, maxHeight * powerRatio);
    }
  }

  move(dx) {
  const nextMoved = this.moved + Math.abs(dx);
  const MAX_MOVE = 150;

  if (nextMoved > MAX_MOVE) return; // No se permite mover más

  this.x = Math.max(25, Math.min(W - 25, this.x + dx));
  this.y = getTerrainAt(this.x) - 15;
  this.moved = nextMoved;
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
        if (dist < 50) { // Play impact sound
          impactSound.play();
        }
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

// Sonidos
const shotSound = new Audio('assets/audio/shot.mp3');
const impactSound = new Audio('assets/audio/impact.mp3');
const youTurnSound = new Audio('assets/audio/next-turn-pop.mp3');

shotSound.volume = 0.8;
impactSound.volume = 0.9;
youTurnSound.volume = 0.2;