const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const currentPlayerDisplay = document.getElementById("currentPlayer");
const angleDisplay = document.getElementById("angleDisplay");
const powerDisplay = document.getElementById("powerDisplay");

const gravity = 0.2; // Slightly reduced gravity for more arching shots
let currentPlayer = 1;
let movementRemaining = 100;

let currentAngle = 45; // Will represent 0-180 degrees
let currentPower = 0;
let powerIncreasing = true;
let spacePressed = false;
let powerInterval = null;
let controlsLocked = false;

// Terrain Settings
const TERRAIN_POINTS = 100; // Number of points to define terrain shape
let terrainHeights = [];
const BASE_TERRAIN_LEVEL = canvas.height - 50; // Average ground level
const TERRAIN_ROUGHNESS = 50; // Max deviation from base level

// Tank Constants
const TANK_WIDTH = 50; // Slightly smaller for better screen fit
const TANK_BODY_HEIGHT = 20;
const TANK_TURRET_RADIUS = 12;
const TANK_BARREL_LENGTH = 30;
const TANK_BARREL_WIDTH = 6;

const players = [
  { 
    x: 100, 
    y: BASE_TERRAIN_LEVEL, 
    color: "red",
    player_name: "Player 1",
    health: 100,
    barrelAngle: 45, // 0-180 degrees, 0 is right, 90 is up, 180 is left
    facingDirection: 1 // 1 for right, -1 for left (chassis facing)
  },
  { 
    x: canvas.width - 100, 
    y: BASE_TERRAIN_LEVEL, 
    color: "blue",
    player_name: "Player 2",
    health: 100,
    barrelAngle: 135, // Initial angle pointing inwards
    facingDirection: -1 
  }
];

// Obstacle Settings
const obstacles = [];

// --- TERRAIN FUNCTIONS ---
function generateTerrain() {
  terrainHeights = [];
  let lastHeight = BASE_TERRAIN_LEVEL;
  for (let i = 0; i <= TERRAIN_POINTS; i++) {
    const x = (canvas.width / TERRAIN_POINTS) * i;
    if (i === 0 || i === TERRAIN_POINTS) {
      terrainHeights.push({ x: x, y: BASE_TERRAIN_LEVEL + Math.random() * 20 }); // Keep edges relatively stable
    } else {
      const newHeight = lastHeight + (Math.random() - 0.5) * TERRAIN_ROUGHNESS * 0.5;
      lastHeight = Math.max(TANK_BODY_HEIGHT + TANK_TURRET_RADIUS*2 + 20, Math.min(newHeight, canvas.height - 20)); // Clamp height
      terrainHeights.push({ x: x, y: lastHeight });
    }
  }
  // Smooth terrain (simple moving average)
  const smoothedHeights = [];
  smoothedHeights.push(terrainHeights[0]); // Keep first point
  for (let i = 1; i < terrainHeights.length -1; i++) {
    const avgY = (terrainHeights[i-1].y + terrainHeights[i].y + terrainHeights[i+1].y) / 3;
    smoothedHeights.push({x: terrainHeights[i].x, y: avgY});
  }
  smoothedHeights.push(terrainHeights[terrainHeights.length-1]); // Keep last point
  terrainHeights = smoothedHeights;
}

function drawTerrain() {
  ctx.beginPath();
  ctx.moveTo(terrainHeights[0].x, terrainHeights[0].y);
  for (let i = 1; i < terrainHeights.length; i++) {
    ctx.lineTo(terrainHeights[i].x, terrainHeights[i].y);
  }
  ctx.lineTo(canvas.width, canvas.height); // Bottom right corner
  ctx.lineTo(0, canvas.height); // Bottom left corner
  ctx.closePath();
  ctx.fillStyle = "#654321"; // Brownish dirt color
  ctx.fill();

  // Add some texture/detail (optional)
  ctx.strokeStyle = "#543210";
  ctx.lineWidth = 2;
  for (let i = 0; i < terrainHeights.length -1; i+=3) {
      ctx.beginPath();
      ctx.moveTo(terrainHeights[i].x + 5, terrainHeights[i].y - 2);
      ctx.lineTo(terrainHeights[i].x + 10, terrainHeights[i].y +1);
      ctx.stroke();
  }
}

function getTerrainHeightAt(x) {
  if (terrainHeights.length === 0) return BASE_TERRAIN_LEVEL;
  // Find the two terrain points surrounding x
  for (let i = 0; i < terrainHeights.length - 1; i++) {
    if (x >= terrainHeights[i].x && x <= terrainHeights[i+1].x) {
      const p1 = terrainHeights[i];
      const p2 = terrainHeights[i+1];
      // Linear interpolation
      const t = (x - p1.x) / (p2.x - p1.x);
      return p1.y + t * (p2.y - p1.y);
    }
  }
  // If x is outside the defined terrain range (e.g., off-screen projectile)
  if (x < terrainHeights[0].x) return terrainHeights[0].y;
  return terrainHeights[terrainHeights.length - 1].y;
}

function createCrater(impactX, impactRadius, depth) {
    for (let i = 0; i < terrainHeights.length; i++) {
        const point = terrainHeights[i];
        const distX = point.x - impactX;
        if (Math.abs(distX) < impactRadius) {
            // Use a cosine function for a smooth crater shape
            const effect = (Math.cos((distX / impactRadius) * (Math.PI / 2))) * depth;
            point.y += effect;
            point.y = Math.min(point.y, canvas.height -1); // Don't dig below canvas
        }
    }
    // Re-smooth a bit locally if needed, or ensure no sharp edges
    // For simplicity, this basic modification is often enough for visual effect
}


// --- PLAYER AND GAME LOGIC ---
function updateAngle(change) {
  if (controlsLocked || spacePressed) return;
  currentAngle = Math.max(0, Math.min(180, currentAngle + change)); // Angle 0-180
  players[currentPlayer - 1].barrelAngle = currentAngle;
  angleDisplay.textContent = currentAngle;
  drawGame();
}

function updatePower() {
  if (powerIncreasing) {
    currentPower += 2;
    if (currentPower >= 100) { // Max power 100
      currentPower = 100;
      powerIncreasing = false;
    }
  } else {
    currentPower -= 2;
    if (currentPower <= 0) {
      currentPower = 0;
      powerIncreasing = true;
    }
  }
  powerDisplay.textContent = currentPower;
  drawGame();
}

function drawGame() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  ctx.fillStyle = "#87CEEB"; // Sky
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  drawTerrain();
  drawObstacles();
  drawPlayers();
  
  const currentPlayerObj = players[currentPlayer - 1];
  const rad = currentPlayerObj.barrelAngle * Math.PI / 180;
  const lineLength = 30;
  
  // Turret center for angle indicator
  const turretCenterX = currentPlayerObj.x;
  const turretCenterY = currentPlayerObj.y - TANK_BODY_HEIGHT - TANK_TURRET_RADIUS / 2;

  ctx.beginPath();
  ctx.moveTo(turretCenterX, turretCenterY);
  ctx.lineTo(
    turretCenterX + Math.cos(rad) * lineLength,
    turretCenterY - Math.sin(rad) * lineLength // Y is inverted in canvas
  );
  ctx.strokeStyle = "yellow";
  ctx.lineWidth = 2;
  ctx.stroke();
  
  if (spacePressed) {
    ctx.fillStyle = "rgba(255, 0, 0, 0.5)";
    const barWidth = (canvas.width - 20) * (currentPower / 100);
    ctx.fillRect(10, canvas.height - 30, barWidth, 20);
  }
}

document.addEventListener('keydown', (event) => {
  if (controlsLocked) return;

  if (event.key === ' ' && !spacePressed) {
    spacePressed = true;
    currentPower = 0;
    powerIncreasing = true;
    powerInterval = setInterval(updatePower, 20);
    return;
  }
  
  if (spacePressed) return;

  let moveDirection = 0;
  switch(event.key.toLowerCase()) {
    case 'arrowleft':
    case 'a':
      moveDirection = -1;
      break;
    case 'arrowright':
    case 'd':
      moveDirection = 1;
      break;
    case 'arrowup':
    case 'w':
      updateAngle(1); // Angle increases upwards/counter-clockwise
      break;
    case 'arrowdown':
    case 's':
      updateAngle(-1); // Angle decreases downwards/clockwise
      break;
  }
  if (moveDirection !== 0) {
      movePlayer(moveDirection);
  }
});

document.addEventListener('keyup', (event) => {
  if (event.key === ' ') {
    if (!spacePressed) return;
    spacePressed = false;
    clearInterval(powerInterval);
    if (!controlsLocked) {
        shoot(players[currentPlayer - 1].barrelAngle, currentPower);
    }
  }
});

function movePlayer(direction) {
  if (movementRemaining <= 0) return;
  
  const player = players[currentPlayer - 1];
  const movementSpeed = 2; // Slower movement on rough terrain
  const proposedX = player.x + direction * movementSpeed;
  
  // Boundary checks
  const minX = TANK_WIDTH / 2;
  const maxX = canvas.width - TANK_WIDTH / 2;

  if (proposedX >= minX && proposedX <= maxX) {
    player.x = proposedX;
    player.y = getTerrainHeightAt(player.x); // Update Y to follow terrain
    
    // Update facing direction based on movement (optional, could be fixed)
    // if (direction !== 0) player.facingDirection = direction;

    movementRemaining -= movementSpeed;
    if(movementRemaining < 0) movementRemaining = 0;
    drawGame();
  }
}

// --- TANK DRAWING ---
function drawTank(player) {
  const { x, y, color, health, barrelAngle, facingDirection, player_name } = player;
  
  const tankBaseY = y; // y is the bottom of the tracks on the terrain

  ctx.save();
  ctx.translate(x, tankBaseY); // Origin at the center-bottom of the tank

  // Tracks (simple rectangles)
  ctx.fillStyle = "#333"; // Dark grey for tracks
  const trackHeight = 8;
  const trackWidth = TANK_WIDTH + 10;
  ctx.fillRect(-trackWidth / 2, -trackHeight, trackWidth, trackHeight);
  // Some track detail
  for(let i = -trackWidth/2 + 5; i < trackWidth/2 -5; i+=10){
      ctx.fillStyle = "#555";
      ctx.fillRect(i, -trackHeight-2, 5, 2);
  }


  // Tank Body
  ctx.fillStyle = color;
  const bodyOffsetY = -trackHeight - TANK_BODY_HEIGHT;
  ctx.beginPath();
  ctx.roundRect(-TANK_WIDTH / 2, bodyOffsetY, TANK_WIDTH, TANK_BODY_HEIGHT, 3);
  ctx.fill();

  // Turret
  const turretX = 0; // Centered on the body
  const turretY = bodyOffsetY - TANK_TURRET_RADIUS / 1.5; // Position turret on top of body
  ctx.beginPath();
  ctx.arc(turretX, turretY, TANK_TURRET_RADIUS, Math.PI, 0); // Semicircle turret
  ctx.fillStyle = color;
  ctx.fill();
  ctx.beginPath(); // Turret base
  ctx.rect(turretX - TANK_TURRET_RADIUS, turretY, TANK_TURRET_RADIUS*2, TANK_TURRET_RADIUS/2);
  ctx.fill();


  // Barrel
  ctx.save();
  ctx.translate(turretX, turretY); // Rotate around turret center
  const rad = barrelAngle * Math.PI / 180;
  ctx.rotate(-rad); // Negative because canvas Y is inverted; angle 0 is right
  ctx.fillStyle = "#555"; // Barrel color
  ctx.fillRect(0, -TANK_BARREL_WIDTH / 2, TANK_BARREL_LENGTH, TANK_BARREL_WIDTH);
  ctx.restore(); // Restore from barrel rotation

  ctx.restore(); // Restore from tank translation

  // Health Bar (absolute coordinates, above tank)
  const healthBarWidth = TANK_WIDTH * 0.8;
  const healthBarHeight = 8;
  const healthBarX = x - healthBarWidth / 2;
  const healthBarY = tankBaseY - TANK_BODY_HEIGHT - TANK_TURRET_RADIUS - trackHeight - 20;

  ctx.fillStyle = "#ff0000";
  ctx.fillRect(healthBarX, healthBarY, healthBarWidth, healthBarHeight);
  ctx.fillStyle = "#00ff00";
  ctx.fillRect(healthBarX, healthBarY, (health / 100) * healthBarWidth, healthBarHeight);

  // Player Name
  ctx.fillStyle = "black";
  ctx.font = "12px Arial";
  ctx.textAlign = "center";
  ctx.fillText(player_name, x, healthBarY - 5);
}

function drawPlayers() {
  players.forEach(player => {
    player.y = getTerrainHeightAt(player.x); // Ensure Y is always on terrain
    drawTank(player);
  });
}


// --- SHOOTING AND COLLISION ---
function calculateDamage(distanceToCenter) {
    const maxEffectiveDistance = TANK_WIDTH / 2;
    if (distanceToCenter < maxEffectiveDistance / 3) return 30; // Direct
    if (distanceToCenter < maxEffectiveDistance * (2/3)) return 20; // Close
    if (distanceToCenter < maxEffectiveDistance) return 10; // Edge
    return 5; // Graze
}

function damagePlayer(playerIndex, damageAmount) {
  players[playerIndex].health -= damageAmount;
  if (players[playerIndex].health < 0) players[playerIndex].health = 0;
  updatePlayerInfo();
  return players[playerIndex].health === 0;
}

function shoot(angle, power) {
  if (power === 0) return;
  controlsLocked = true;

  const shooter = players[currentPlayer - 1];
  const targetPlayer = players[1 - (currentPlayer - 1)]; // The other player

  // Start projectile from barrel tip
  const shooterRad = shooter.barrelAngle * Math.PI / 180;
  const barrelTipOffsetX = Math.cos(shooterRad) * TANK_BARREL_LENGTH;
  const barrelTipOffsetY = -Math.sin(shooterRad) * TANK_BARREL_LENGTH; // Negative due to canvas Y

  const turretCenterX = shooter.x;
  const turretCenterY = shooter.y - TANK_BODY_HEIGHT - TANK_TURRET_RADIUS / 1.5; // Approx turret center Y

  let projX = turretCenterX + barrelTipOffsetX;
  let projY = turretCenterY + barrelTipOffsetY;

  const physicsAngleRad = angle * Math.PI / 180; // Angle is 0-180 (0 right, 90 up, 180 left)
  // Power scaling: power (0-100) * factor. 0.15 makes it reasonable.
  let vx = Math.cos(physicsAngleRad) * power * 0.15; 
  let vy = -Math.sin(physicsAngleRad) * power * 0.15; // Negative for upward Y

  function animateProjectile() {
    projX += vx;
    projY += vy;
    vy += gravity;

    drawGame(); // Redraw everything
    ctx.beginPath(); // Draw projectile
    ctx.arc(projX, projY, 5, 0, Math.PI * 2);
    ctx.fillStyle = "black";
    ctx.fill();

    // Collision with Terrain
    const terrainHitY = getTerrainHeightAt(projX);
    if (projY >= terrainHitY) {
      createCrater(projX, 30, 15); // Impact X, crater radius, crater depth
      nextTurn();
      return;
    }

    // Collision with Obstacles
    for (let i = 0; i < obstacles.length; i++) {
        const obs = obstacles[i];
        if (projX > obs.x && projX < obs.x + obs.width && projY > obs.y && projY < obs.y + obs.height) {
            if (obs.destructible) {
                obs.health -= 34; // Obstacles take more damage
                if (obs.health <= 0) {
                    obstacles.splice(i, 1); // Remove destroyed obstacle
                    i--; // Adjust index after removal
                }
            }
            createCrater(projX, 20, 10); // Small crater even on obstacle hit
            nextTurn();
            return;
        }
    }
    
    // Collision with Target Player
    const targetBodyTop = targetPlayer.y - TANK_BODY_HEIGHT - TANK_TURRET_RADIUS*2; // Approximate top of target
    const targetBodyBottom = targetPlayer.y; // Bottom of tracks
    if (projX > targetPlayer.x - TANK_WIDTH/2 && projX < targetPlayer.x + TANK_WIDTH/2 &&
        projY > targetBodyTop && projY < targetBodyBottom) {
      
      const distToCenter = Math.abs(projX - targetPlayer.x); // Simple horizontal distance for now
      const damage = calculateDamage(distToCenter);
      const targetIndex = players.indexOf(targetPlayer);
      const isGameOver = damagePlayer(targetIndex, damage);
      
      createCrater(projX, 25, 12); // Explosion effect

      if (isGameOver) {
        setTimeout(() => {
          alert(`¡${shooter.player_name} ha ganado!`);
          showStartMenu();
        }, 100);
        return;
      }
      nextTurn();
      return;
    }

    // Out of bounds
    if (projX < -10 || projX > canvas.width + 10 || projY > canvas.height + 10) {
        nextTurn();
        return;
    }

    requestAnimationFrame(animateProjectile);
  }
  animateProjectile();
}

// --- GAME STATE AND UI ---
const startButton = document.getElementById("startButton");
const startMenu = document.getElementById("start-menu");
const gameContent = document.getElementById("game-content");

function getRandomSafePosition(minDistFromEdge = 50, minDistFromOtherPlayer = 200, otherPlayerX = -1000) {
    let x;
    let attempts = 0;
    do {
        x = Math.random() * (canvas.width - 2 * minDistFromEdge) + minDistFromEdge;
        attempts++;
    } while (otherPlayerX !== -1000 && Math.abs(x - otherPlayerX) < minDistFromOtherPlayer && attempts < 50);
    if (attempts >= 50 && otherPlayerX !== -1000) { // Failsafe if cant find good spot
        x = (otherPlayerX > canvas.width / 2) ? minDistFromEdge : canvas.width - minDistFromEdge;
    }
    return x;
}

function resetGame() {
  generateTerrain();
  obstacles.length = 0; // Clear old obstacles
  // Add new obstacles, positioned on terrain
  const numObstacles = Math.floor(Math.random() * 3) + 2; // 2-4 obstacles
  for (let i = 0; i < numObstacles; i++) {
      const obsWidth = Math.random() * 40 + 30; // 30-70
      const obsHeight = Math.random() * 50 + 40; // 40-90
      const obsX = canvas.width * 0.2 + Math.random() * (canvas.width * 0.6); // Central 60% of map
      obstacles.push({
          x: obsX,
          y: getTerrainHeightAt(obsX) - obsHeight, // Place on terrain
          width: obsWidth,
          height: obsHeight,
          destructible: Math.random() > 0.3, // 70% chance destructible
          health: 100,
          color: Math.random() > 0.3 ? "#8B4513" : "#708090" // Brown or SlateGray
      });
  }
  
  players[0].x = getRandomSafePosition(TANK_WIDTH);
  players[0].y = getTerrainHeightAt(players[0].x);
  players[0].health = 100;
  players[0].barrelAngle = 45;
  players[0].facingDirection = 1;


  players[1].x = getRandomSafePosition(TANK_WIDTH, TANK_WIDTH * 4, players[0].x);
  players[1].y = getTerrainHeightAt(players[1].x);
  players[1].health = 100;
  players[1].barrelAngle = 135;
  players[1].facingDirection = -1;


  // Ensure players face each other somewhat
    if (players[0].x < players[1].x) {
        players[0].barrelAngle = 45; players[0].facingDirection = 1;
        players[1].barrelAngle = 135; players[1].facingDirection = -1;
    } else {
        players[0].barrelAngle = 135; players[0].facingDirection = -1;
        players[1].barrelAngle = 45; players[1].facingDirection = 1;
    }

  currentPlayer = 1;
  movementRemaining = 100; // px of movement
  currentAngle = players[0].barrelAngle;
  currentPower = 0;
  powerIncreasing = true;
  spacePressed = false;
  controlsLocked = false;
  if (powerInterval) clearInterval(powerInterval);
  
  updatePlayerInfo();
  currentPlayerDisplay.textContent = currentPlayer;
  angleDisplay.textContent = currentAngle;
  powerDisplay.textContent = currentPower;
  drawGame();
}

function showStartMenu() {
    startMenu.style.display = 'block'; // Or 'flex' if it's a flex container
    gameContent.style.display = 'none';
    // Hide canvas and controls if they are not part of gameContent or need separate hiding
    document.querySelector('.canvas-container').style.display = 'none';
    document.querySelector('.game-controls').style.display = 'none';
    document.querySelector('.controls-help').style.display = 'none';
}

function startGame() {
    startMenu.style.display = 'none';
    gameContent.style.display = 'block'; // Main container for player info
    document.querySelector('.canvas-container').style.display = 'block';
    document.querySelector('.game-controls').style.display = 'flex'; // These were flex
    document.querySelector('.controls-help').style.display = 'block';
    resetGame();
}

startButton.addEventListener('click', startGame);


function drawObstacles() {
  obstacles.forEach(obstacle => {
    // Update Y position if terrain changed underneath (e.g. crater nearby)
    obstacle.y = getTerrainHeightAt(obstacle.x + obstacle.width/2) - obstacle.height;

    ctx.fillStyle = obstacle.color;
    ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
    
    if (obstacle.destructible) {
      const healthBarWidth = obstacle.width * 0.8;
      const healthBarHeight = 5;
      const barX = obstacle.x + (obstacle.width - healthBarWidth)/2;
      const barY = obstacle.y - 10;
      
      ctx.fillStyle = "red";
      ctx.fillRect(barX, barY, healthBarWidth, healthBarHeight);
      ctx.fillStyle = "green";
      ctx.fillRect(barX, barY, (obstacle.health/100) * healthBarWidth, healthBarHeight);
    }
  });
}

function updatePlayerInfo() {
  document.getElementById("player1-name").textContent = players[0].player_name;
  document.getElementById("player2-name").textContent = players[1].player_name;
  document.getElementById("player1-health").textContent = players[0].health;
  document.getElementById("player2-health").textContent = players[1].health;
}

function nextTurn() {
  controlsLocked = false;
  currentPlayer = currentPlayer === 1 ? 2 : 1;
  currentPlayerDisplay.textContent = currentPlayer;
  
  movementRemaining = 100; 
  
  currentAngle = players[currentPlayer - 1].barrelAngle;
  angleDisplay.textContent = currentAngle;
  
  currentPower = 0;
  powerDisplay.textContent = currentPower;
  powerIncreasing = true;

  drawGame();
}

// Initial call to show menu and hide game
showStartMenu();
updatePlayerInfo(); // Update names even on menu