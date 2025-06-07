const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const currentPlayerDisplay = document.getElementById("currentPlayer");
const angleDisplay = document.getElementById("angleDisplay");
const powerDisplay = document.getElementById("powerDisplay");

// Game constants
const gravity = 0.15;
const windForce = (Math.random() - 0.5) * 0.1;
let currentPlayerIndex = 0;
let movementRemaining = 100;
let currentAngle = 45;
let currentPower = 0;
let powerIncreasing = true;
let spacePressed = false;
let powerInterval = null;
let controlsLocked = false;

// Terrain settings
const TERRAIN_POINTS = 100;
let terrainHeights = [];
const BASE_TERRAIN_LEVEL = canvas.height - 80;
const TERRAIN_ROUGHNESS = 40;

// Tank constants
const TANK_WIDTH = 40;
const TANK_BODY_HEIGHT = 20;
const TANK_TURRET_RADIUS = 15;
const TANK_BARREL_LENGTH = 35;

// Game mode variables
let playersPerTeam = 1;
let allPlayers = [];
const obstacles = [];
const projectiles = [];
const explosions = [];

// Team colors
const team1Colors = ["#e74c3c", "#c0392b", "#d35400"];
const team2Colors = ["#3498db", "#2980b9", "#1abc9c"];

// Menu setup
const modeButtons = document.querySelectorAll('.mode-button');
const startButton = document.getElementById('startButton');

modeButtons.forEach(button => {
  button.addEventListener('click', () => {
    modeButtons.forEach(btn => btn.classList.remove('selected'));
    button.classList.add('selected');
    playersPerTeam = parseInt(button.getAttribute('data-players'));
    startButton.disabled = false;
  });
});

startButton.addEventListener('click', startGame);

// Game classes
class Projectile {
  constructor(x, y, velocityX, velocityY, damage = 25) {
    this.x = x;
    this.y = y;
    this.velocityX = velocityX;
    this.velocityY = velocityY;
    this.damage = damage;
    this.trail = [];
    this.active = true;
  }

  update() {
    if (!this.active) return;

    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 8) this.trail.shift();

    this.x += this.velocityX;
    this.y += this.velocityY;
    this.velocityY += gravity;
    this.velocityX += windForce;

    // Check bounds
    if (this.x < 0 || this.x > canvas.width || this.y > canvas.height) {
      this.active = false;
      return;
    }

    // Check terrain collision
    if (this.y >= getTerrainHeightAt(this.x) - 5) {
      this.explode();
      return;
    }

    // Check obstacle collision
    for (let obstacle of obstacles) {
      if (this.x >= obstacle.x && this.x <= obstacle.x + obstacle.width &&
        this.y >= obstacle.y && this.y <= obstacle.y + obstacle.height) {
        this.explode();
        return;
      }
    }

    // Check tank collision
    for (let player of allPlayers) {
      if (player.health > 0) {
        const distance = Math.sqrt((this.x - player.x) ** 2 + (this.y - player.y) ** 2);
        if (distance < TANK_WIDTH / 2) {
          this.explode();
          return;
        }
      }
    }
  }

  explode() {
    if (!this.active) return;
    this.active = false;

    explosions.push(new Explosion(this.x, this.y));

    // Damage players
    for (let player of allPlayers) {
      if (player.health > 0) {
        const distance = Math.sqrt((this.x - player.x) ** 2 + (this.y - player.y) ** 2);
        if (distance < 60) {
          const damage = Math.max(0, this.damage * (1 - distance / 60));
          player.health = Math.max(0, player.health - Math.floor(damage));
        }
      }
    }

    // Damage terrain
    const explosionRadius = 40;
    for (let i = 0; i < terrainHeights.length; i++) {
      const distance = Math.abs(terrainHeights[i].x - this.x);
      if (distance < explosionRadius) {
        const heightIncrease = (explosionRadius - distance) * 0.8;
        terrainHeights[i].y += heightIncrease;
      }
    }

    // Damage obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const obstacle = obstacles[i];
      const centerX = obstacle.x + obstacle.width / 2;
      const centerY = obstacle.y + obstacle.height / 2;
      const distance = Math.sqrt((this.x - centerX) ** 2 + (this.y - centerY) ** 2);

      if (distance < 50 && obstacle.destructible) {
        obstacle.health -= 30;
        if (obstacle.health <= 0) {
          obstacles.splice(i, 1);
        }
      }
    }

    updatePlayerPositions();
    updatePlayerInfo();

    setTimeout(() => {
      if (checkGameOver()) return;
      nextTurn();
    }, 1000);
  }

  draw() {
    if (!this.active) return;

    // Draw trail
    ctx.strokeStyle = "#ff6b35";
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i < this.trail.length; i++) {
      const alpha = i / this.trail.length;
      ctx.globalAlpha = alpha;
      if (i === 0) {
        ctx.moveTo(this.trail[i].x, this.trail[i].y);
      } else {
        ctx.lineTo(this.trail[i].x, this.trail[i].y);
      }
    }
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Draw projectile
    ctx.fillStyle = "#ff4757";
    ctx.beginPath();
    ctx.arc(this.x, this.y, 4, 0, Math.PI * 2);
    ctx.fill();

    // Glow effect
    ctx.shadowColor = "#ff4757";
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

class Explosion {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 0;
    this.maxRadius = 50;
    this.particles = [];
    this.life = 30;
    this.maxLife = 30;

    // Create particles
    for (let i = 0; i < 15; i++) {
      this.particles.push({
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8,
        life: Math.random() * 20 + 10,
        color: `hsl(${Math.random() * 60 + 10}, 100%, ${Math.random() * 30 + 50}%)`
      });
    }
  }

  update() {
    this.life--;
    this.radius = Math.min(this.maxRadius, this.radius + 3);

    // Update particles
    for (let particle of this.particles) {
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.vy += 0.2;
      particle.life--;
    }

    this.particles = this.particles.filter(p => p.life > 0);
  }

  draw() {
    // Draw explosion circle
    const alpha = this.life / this.maxLife;
    ctx.globalAlpha = alpha * 0.6;

    const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius);
    gradient.addColorStop(0, '#ff6b35');
    gradient.addColorStop(0.5, '#ff4757');
    gradient.addColorStop(1, 'transparent');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();

    // Draw particles
    for (let particle of this.particles) {
      ctx.globalAlpha = (particle.life / 30) * alpha;
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
  }

  isDead() {
    return this.life <= 0;
  }
}

// Game functions
function generateTerrain() {
  terrainHeights = [];
  let lastHeight = BASE_TERRAIN_LEVEL;

  for (let i = 0; i <= TERRAIN_POINTS; i++) {
    const x = (canvas.width / TERRAIN_POINTS) * i;
    if (i === 0 || i === TERRAIN_POINTS) {
      terrainHeights.push({ x: x, y: BASE_TERRAIN_LEVEL });
    } else {
      const variation = (Math.random() - 0.5) * TERRAIN_ROUGHNESS * 0.5;
      lastHeight = Math.max(canvas.height - 150, Math.min(BASE_TERRAIN_LEVEL + 50, lastHeight + variation));
      terrainHeights.push({ x: x, y: lastHeight });
    }
  }

  // Smooth terrain
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 1; i < terrainHeights.length - 1; i++) {
      const avg = (terrainHeights[i - 1].y + terrainHeights[i].y + terrainHeights[i + 1].y) / 3;
      terrainHeights[i].y = avg;
    }
  }
}

function getTerrainHeightAt(x) {
  if (x < 0 || x > canvas.width) return BASE_TERRAIN_LEVEL;

  // Check platforms first
  for (const obstacle of obstacles) {
    if (obstacle.isPlatform && x >= obstacle.x && x <= obstacle.x + obstacle.width) {
      return obstacle.y;
    }
  }

  const segmentWidth = canvas.width / TERRAIN_POINTS;
  const index = Math.floor(x / segmentWidth);

  if (index >= terrainHeights.length - 1) {
    return terrainHeights[terrainHeights.length - 1].y;
  }

  const x1 = terrainHeights[index].x;
  const y1 = terrainHeights[index].y;
  const x2 = terrainHeights[index + 1].x;
  const y2 = terrainHeights[index + 1].y;

  return y1 + (x - x1) * (y2 - y1) / (x2 - x1);
}

function initializePlayers() {
  allPlayers = [];

  // Team 1 (Red)
  for (let i = 0; i < playersPerTeam; i++) {
    allPlayers.push({
      x: 80 + (i * 60),
      y: BASE_TERRAIN_LEVEL,
      color: team1Colors[i % team1Colors.length],
      player_name: `Rojo ${i + 1}`,
      health: 100,
      maxHealth: 100,
      barrelAngle: 45,
      facingDirection: 1,
      team: 1
    });
  }

  // Team 2 (Blue)  
  for (let i = 0; i < playersPerTeam; i++) {
    allPlayers.push({
      x: canvas.width - 80 - (i * 60),
      y: BASE_TERRAIN_LEVEL,
      color: team2Colors[i % team2Colors.length],
      player_name: `Azul ${i + 1}`,
      health: 100,
      maxHealth: 100,
      barrelAngle: 135,
      facingDirection: -1,
      team: 2
    });
  }
}

function updatePlayerInfo() {
  const team1Container = document.getElementById('team1-players');
  const team2Container = document.getElementById('team2-players');

  team1Container.innerHTML = '';
  team2Container.innerHTML = '';

  // Team 1 players
  allPlayers.filter(player => player.team === 1).forEach(player => {
    const playerElement = document.createElement('div');
    playerElement.className = 'player-item';
    const healthPercent = (player.health / player.maxHealth) * 100;
    const healthColor = healthPercent > 60 ? '#2ecc71' : healthPercent > 30 ? '#f39c12' : '#e74c3c';

    playerElement.innerHTML = `
          <p><strong>${player.player_name}</strong></p>
          <p>💚 Vida: <span class="health-value" style="color: ${healthColor}">${player.health}</span></p>
        `;
    team1Container.appendChild(playerElement);
  });

  // Team 2 players
  allPlayers.filter(player => player.team === 2).forEach(player => {
    const playerElement = document.createElement('div');
    playerElement.className = 'player-item';
    const healthPercent = (player.health / player.maxHealth) * 100;
    const healthColor = healthPercent > 60 ? '#2ecc71' : healthPercent > 30 ? '#f39c12' : '#e74c3c';

    playerElement.innerHTML = `
          <p><strong>${player.player_name}</strong></p>
          <p>💚 Vida: <span class="health-value" style="color: ${healthColor}">${player.health}</span></p>
        `;
    team2Container.appendChild(playerElement);
  });
}

function updatePlayerPositions() {
  for (let player of allPlayers) {
    if (player.health > 0) {
      const terrainHeight = getTerrainHeightAt(player.x);
      player.y = terrainHeight - TANK_BODY_HEIGHT / 2;
    }
  }
}

function resetGame() {
  generateTerrain();
  obstacles.length = 0;
  projectiles.length = 0;
  explosions.length = 0;

  initializePlayers();

  // Add platforms
  const numPlatforms = Math.floor(Math.random() * 3) + 2;
  for (let i = 0; i < numPlatforms; i++) {
    const platformWidth = Math.random() * 80 + 60;
    const platformHeight = 15;
    const platformX = canvas.width * 0.2 + Math.random() * (canvas.width * 0.6);
    const platformY = canvas.height * 0.2 + Math.random() * (canvas.height * 0.4);

    obstacles.push({
      x: platformX,
      y: platformY,
      width: platformWidth,
      height: platformHeight,
      destructible: true,
      health: 100,
      color: "#8B4513",
      isPlatform: true
    });
  }

  // Add obstacles
  const numObstacles = Math.floor(Math.random() * 2) + 1;
  for (let i = 0; i < numObstacles; i++) {
    const obsWidth = Math.random() * 30 + 40;
    const obsHeight = Math.random() * 40 + 30;
    const obsX = canvas.width * 0.3 + Math.random() * (canvas.width * 0.4);

    obstacles.push({
      x: obsX,
      y: getTerrainHeightAt(obsX) - obsHeight,
      width: obsWidth,
      height: obsHeight,
      destructible: Math.random() > 0.3,
      health: 100,
      color: Math.random() > 0.5 ? "#8B4513" : "#708090",
      isPlatform: false
    });
  }

  updatePlayerPositions();

  currentPlayerIndex = 0;
  movementRemaining = 100;
  currentAngle = allPlayers[currentPlayerIndex].barrelAngle;
  currentPower = 0;
  powerIncreasing = true;
  spacePressed = false;
  controlsLocked = false;

  if (powerInterval) clearInterval(powerInterval);

  updatePlayerInfo();
  currentPlayerDisplay.textContent = allPlayers[currentPlayerIndex].player_name;
  angleDisplay.textContent = currentAngle;
  powerDisplay.textContent = currentPower;

  drawGame();
}

function nextTurn() {
  controlsLocked = false;

  // Find next alive player
  do {
    currentPlayerIndex = (currentPlayerIndex + 1) % allPlayers.length;
  } while (allPlayers[currentPlayerIndex].health <= 0);

  const currentPlayer = allPlayers[currentPlayerIndex];
  currentPlayerDisplay.textContent = currentPlayer.player_name;

  movementRemaining = 100;
  currentAngle = currentPlayer.barrelAngle;
  angleDisplay.textContent = currentAngle;

  currentPower = 0;
  powerDisplay.textContent = currentPower;
  powerIncreasing = true;

  drawGame();
}

function checkGameOver() {
  const team1Alive = allPlayers.filter(p => p.team === 1 && p.health > 0).length;
  const team2Alive = allPlayers.filter(p => p.team === 2 && p.health > 0).length;

  if (team1Alive === 0 || team2Alive === 0) {
    const winner = team1Alive > 0 ? "🔴 Equipo Rojo" : "🔵 Equipo Azul";
    showGameOver(winner);
    return true;
  }
  return false;
}

function showGameOver(winner) {
  const gameOverDiv = document.createElement('div');
  gameOverDiv.className = 'game-over';
  gameOverDiv.innerHTML = `
        <h2>🎉 ¡Juego Terminado! 🎉</h2>
        <h3>Ganador: ${winner}</h3>
        <button class="restart-button" onclick="restartGame()">Jugar de Nuevo</button>
        <button class="restart-button" onclick="showStartMenu()" style="margin-left: 10px;">Menú Principal</button>
      `;
  document.body.appendChild(gameOverDiv);
}

function restartGame() {
  const gameOverDiv = document.querySelector('.game-over');
  if (gameOverDiv) gameOverDiv.remove();
  resetGame();
}

function showStartMenu() {
  const gameOverDiv = document.querySelector('.game-over');
  if (gameOverDiv) gameOverDiv.remove();

  document.getElementById('start-menu').style.display = 'block';
  document.getElementById('game-content').style.display = 'none';
}

function startGame() {
  document.getElementById('start-menu').style.display = 'none';
  document.getElementById('game-content').style.display = 'block';
  resetGame();
}

// Drawing functions
function drawTerrain() {
  ctx.fillStyle = "#228B22";
  ctx.beginPath();
  ctx.moveTo(0, canvas.height);

  for (let point of terrainHeights) {
    ctx.lineTo(point.x, point.y);
  }

  ctx.lineTo(canvas.width, canvas.height);
  ctx.closePath();
  ctx.fill();

  // Add grass texture
  ctx.strokeStyle = "#32CD32";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let point of terrainHeights) {
    ctx.moveTo(point.x, point.y);
    ctx.lineTo(point.x, point.y - 5);
  }
  ctx.stroke();
}

function drawObstacles() {
  for (let obstacle of obstacles) {
    // Main obstacle body
    ctx.fillStyle = obstacle.color;
    ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);

    // Border
    ctx.strokeStyle = "#2c3e50";
    ctx.lineWidth = 2;
    ctx.strokeRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);

    // Health indicator for destructible obstacles
    if (obstacle.destructible) {
      const healthPercent = obstacle.health / 100;
      const barWidth = obstacle.width * 0.8;
      const barHeight = 4;
      const barX = obstacle.x + (obstacle.width - barWidth) / 2;
      const barY = obstacle.y - 10;

      // Background
      ctx.fillStyle = "#2c3e50";
      ctx.fillRect(barX, barY, barWidth, barHeight);

      // Health bar
      ctx.fillStyle = healthPercent > 0.6 ? "#2ecc71" : healthPercent > 0.3 ? "#f39c12" : "#e74c3c";
      ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);
    }
  }
}

function drawTank(player) {
  if (player.health <= 0) return;

  const x = player.x;
  const y = player.y;

  // Tank shadow
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.fillRect(x - TANK_WIDTH / 2 + 3, y + TANK_BODY_HEIGHT / 2 + 3, TANK_WIDTH, 8);

  // Tank tracks
  ctx.fillStyle = "#2c3e50";
  ctx.fillRect(x - TANK_WIDTH / 2, y + TANK_BODY_HEIGHT / 2 - 2, TANK_WIDTH, 8);

  // Track details
  ctx.fillStyle = "#34495e";
  for (let i = 0; i < 6; i++) {
    const trackX = x - TANK_WIDTH / 2 + (i * TANK_WIDTH / 6) + 3;
    ctx.fillRect(trackX, y + TANK_BODY_HEIGHT / 2 - 1, 4, 6);
  }

  // Tank body
  const gradient = ctx.createLinearGradient(x, y - TANK_BODY_HEIGHT / 2, x, y + TANK_BODY_HEIGHT / 2);
  gradient.addColorStop(0, player.color);
  gradient.addColorStop(1, darkenColor(player.color, 0.3));

  ctx.fillStyle = gradient;
  ctx.fillRect(x - TANK_WIDTH / 2, y - TANK_BODY_HEIGHT / 2, TANK_WIDTH, TANK_BODY_HEIGHT);

  // Tank body outline
  ctx.strokeStyle = "#2c3e50";
  ctx.lineWidth = 2;
  ctx.strokeRect(x - TANK_WIDTH / 2, y - TANK_BODY_HEIGHT / 2, TANK_WIDTH, TANK_BODY_HEIGHT);

  // Tank turret
  ctx.fillStyle = player.color;
  ctx.beginPath();
  ctx.arc(x, y - 5, TANK_TURRET_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Tank barrel
  const barrelAngleRad = (player.barrelAngle * Math.PI) / 180;
  const barrelEndX = x + Math.cos(barrelAngleRad) * TANK_BARREL_LENGTH;
  const barrelEndY = y - 5 - Math.sin(barrelAngleRad) * TANK_BARREL_LENGTH;

  ctx.strokeStyle = "#2c3e50";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(x, y - 5);
  ctx.lineTo(barrelEndX, barrelEndY);
  ctx.stroke();

  // Barrel tip
  ctx.fillStyle = "#34495e";
  ctx.beginPath();
  ctx.arc(barrelEndX, barrelEndY, 3, 0, Math.PI * 2);
  ctx.fill();

  // Health bar
  const healthPercent = player.health / player.maxHealth;
  const barWidth = TANK_WIDTH;
  const barHeight = 6;
  const barX = x - barWidth / 2;
  const barY = y - TANK_BODY_HEIGHT / 2 - 15;

  // Health bar background
  ctx.fillStyle = "#2c3e50";
  ctx.fillRect(barX, barY, barWidth, barHeight);

  // Health bar fill
  ctx.fillStyle = healthPercent > 0.6 ? "#2ecc71" : healthPercent > 0.3 ? "#f39c12" : "#e74c3c";
  ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);

  // Health bar border
  ctx.strokeStyle = "#ecf0f1";
  ctx.lineWidth = 1;
  ctx.strokeRect(barX, barY, barWidth, barHeight);

  // Player name
  ctx.fillStyle = "#ecf0f1";
  ctx.font = "12px Arial";
  ctx.textAlign = "center";
  ctx.fillText(player.player_name, x, barY - 5);

  // Current player indicator
  if (currentPlayerIndex < allPlayers.length && allPlayers[currentPlayerIndex] === player) {
    ctx.strokeStyle = "#f1c40f";
    ctx.lineWidth = 3;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.arc(x, y - 5, TANK_TURRET_RADIUS + 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Arrow indicator
    ctx.fillStyle = "#f1c40f";
    ctx.beginPath();
    ctx.moveTo(x, y - 35);
    ctx.lineTo(x - 8, y - 25);
    ctx.lineTo(x + 8, y - 25);
    ctx.closePath();
    ctx.fill();
  }
}

function darkenColor(color, factor) {
  const hex = color.replace('#', '');
  const r = Math.max(0, parseInt(hex.substr(0, 2), 16) * (1 - factor));
  const g = Math.max(0, parseInt(hex.substr(2, 2), 16) * (1 - factor));
  const b = Math.max(0, parseInt(hex.substr(4, 2), 16) * (1 - factor));

  return `rgb(${Math.floor(r)}, ${Math.floor(g)}, ${Math.floor(b)})`;
}

function drawGame() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawTerrain();
  drawObstacles();

  for (let player of allPlayers) {
    if (player.health > 0) {
      drawTank(player);
    }
  }

  for (let projectile of projectiles) {
    projectile.draw();
  }

  for (let explosion of explosions) {
    explosion.draw();
  }

  // Wind indicator
  ctx.fillStyle = "#ecf0f1";
  ctx.font = "16px Arial";
  ctx.textAlign = "left";
  const windText = windForce > 0 ? `💨 Viento: →${Math.abs(windForce * 100).toFixed(1)}` :
    windForce < 0 ? `💨 Viento: ←${Math.abs(windForce * 100).toFixed(1)}` : "💨 Sin viento";
  ctx.fillText(windText, 10, 30);
}

// Input handling
const keys = {};

document.addEventListener('keydown', (e) => {
  keys[e.key.toLowerCase()] = true;

  if (controlsLocked) return;

  const currentPlayer = allPlayers[currentPlayerIndex];
  if (!currentPlayer || currentPlayer.health <= 0) return;

  // Movement
  if ((e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') && movementRemaining > 0) {
    const newX = Math.max(TANK_WIDTH / 2, currentPlayer.x - 3);
    if (newX !== currentPlayer.x) {
      currentPlayer.x = newX;
      currentPlayer.y = getTerrainHeightAt(currentPlayer.x) - TANK_BODY_HEIGHT / 2;
      currentPlayer.facingDirection = -1;
      movementRemaining -= 3;
      drawGame();
    }
  }

  if ((e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') && movementRemaining > 0) {
    const newX = Math.min(canvas.width - TANK_WIDTH / 2, currentPlayer.x + 3);
    if (newX !== currentPlayer.x) {
      currentPlayer.x = newX;
      currentPlayer.y = getTerrainHeightAt(currentPlayer.x) - TANK_BODY_HEIGHT / 2;
      currentPlayer.facingDirection = 1;
      movementRemaining -= 3;
      drawGame();
    }
  }

  // Angle adjustment
  if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') {
    currentAngle = Math.min(180, currentAngle + 2);
    currentPlayer.barrelAngle = currentAngle;
    angleDisplay.textContent = currentAngle;
    drawGame();
  }

  if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') {
    currentAngle = Math.max(0, currentAngle - 2);
    currentPlayer.barrelAngle = currentAngle;
    angleDisplay.textContent = currentAngle;
    drawGame();
  }

  // Power charging
  if (e.key === ' ' && !spacePressed) {
    spacePressed = true;
    powerInterval = setInterval(() => {
      if (powerIncreasing) {
        currentPower += 2;
        if (currentPower >= 100) {
          powerIncreasing = false;
        }
      } else {
        currentPower -= 2;
        if (currentPower <= 0) {
          powerIncreasing = true;
        }
      }
      powerDisplay.textContent = currentPower;
    }, 50);
  }

  // Skip turn
  if (e.key === 'Enter') {
    nextTurn();
  }
});

document.addEventListener('keyup', (e) => {
  keys[e.key.toLowerCase()] = false;

  if (e.key === ' ' && spacePressed) {
    spacePressed = false;
    if (powerInterval) {
      clearInterval(powerInterval);
      powerInterval = null;
    }

    if (currentPower > 0) {
      shoot();
    }
  }
});

function shoot() {
  const currentPlayer = allPlayers[currentPlayerIndex];
  if (!currentPlayer || currentPlayer.health <= 0 || controlsLocked) return;

  controlsLocked = true;

  const angleRad = (currentAngle * Math.PI) / 180;
  const power = currentPower / 100;
  const velocityX = Math.cos(angleRad) * power * 15;
  const velocityY = -Math.sin(angleRad) * power * 15;

  const barrelEndX = currentPlayer.x + Math.cos(angleRad) * TANK_BARREL_LENGTH;
  const barrelEndY = currentPlayer.y - 5 - Math.sin(angleRad) * TANK_BARREL_LENGTH;

  projectiles.push(new Projectile(barrelEndX, barrelEndY, velocityX, velocityY));

  currentPower = 0;
  powerDisplay.textContent = currentPower;
}

// Game loop
function gameLoop() {
  // Update projectiles
  for (let i = projectiles.length - 1; i >= 0; i--) {
    projectiles[i].update();
    if (!projectiles[i].active) {
      projectiles.splice(i, 1);
    }
  }

  // Update explosions
  for (let i = explosions.length - 1; i >= 0; i--) {
    explosions[i].update();
    if (explosions[i].isDead()) {
      explosions.splice(i, 1);
    }
  }

  drawGame();
  requestAnimationFrame(gameLoop);
}

// Start the game loop
gameLoop();

// Make functions global for button onclick
window.restartGame = restartGame;
window.showStartMenu = showStartMenu;