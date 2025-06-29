const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

// Game object
function interpolateTerrain(points, segments = 50) {
  const interpolated = [];
  const totalLength = points[points.length - 1].x;

  for (let i = 0; i <= segments; i++) {
    const x = i * totalLength / segments;

    // Buscar el par de puntos entre los que está este x
    let j = 0;
    while (j < points.length - 1 && points[j + 1].x < x) j++;

    const p1 = points[j];
    const p2 = points[j + 1] || points[j];

    const t = (x - p1.x) / (p2.x - p1.x || 1);
    const y = p1.y + (p2.y - p1.y) * t;

    interpolated.push({ x, y });
  }

  return interpolated;
}

function generateTerrain() {
  const selectedTerrain = document.getElementById("terrainSelect")?.value || "";

  if (predefinedTerrains[selectedTerrain]) {
    game.terrain = interpolateTerrain(predefinedTerrains[selectedTerrain]);
    game.terrainType = selectedTerrain;
  } else {
    game.terrain = [];
    let h = H - 60;
    for (let i = 0; i <= 50; i++) {
      const x = i * W / 50;
      h += (Math.random() - 0.5) * 20;
      h = Math.max(H - 120, Math.min(H - 40, h));
      game.terrain.push({ x, y: h });
    }

    // Suavizado
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 1; i < game.terrain.length - 1; i++) {
        const avg = (game.terrain[i - 1].y + game.terrain[i].y + game.terrain[i + 1].y) / 3;
        game.terrain[i].y = avg;
      }
    }

    game.terrainType = "random";
  }
    // Carga la nueva imagen de fondo cuando el terreno cambia
  currentBackground.src = `assets/images/${terrainBackgroundImages[game.terrainType]}`;
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
  if (absWind < 5) return; // No mostrar si el viento es bajo

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
  if (absWind < 10) return; // No dibujar partículas

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
  if (game.windChangeCounter === game.windChangePerTurn - 1) {
    ctx.fillStyle = 'rgba(250, 150, 0, 0.89)';
    ctx.font = 'bold 16px Arial';
    ctx.fillText('¡Cambiará próximo turno!', centerX, centerY + 60);
  }

  ctx.textAlign = 'left'; // Resetear alineación
}

const terrainBackgroundImages = {
  "flat": "flat-fondo.jpg",
  "hills": "hills-fondo.jpg",
  "mountain": "mountain-fondo.jpg",
  "valley": "valley-fondo.jpg",
  "random": "fondo-juego-2d.avif"
};

// Variable para la imagen de fondo actual
let currentBackground = new Image();

// Inicializa con una imagen por defecto o la que corresponda al terreno inicial
currentBackground.src = `assets/images/${terrainBackgroundImages[game.terrainType || 'random']}`;

function draw() {
  ctx.clearRect(0, 0, W, H);

  // 1. Dibuja la imagen de fondo con lógica "cover" similar a CSS
  if (currentBackground.complete && currentBackground.naturalWidth > 0) {
    const img = currentBackground;
    const imgAspect = img.naturalWidth / img.naturalHeight;
    const canvasAspect = W / H;

    let sx, sy, sWidth, sHeight; // Source (recorte de la imagen)
    let dx, dy, dWidth, dHeight; // Destination (dibujo en el canvas)

    if (imgAspect > canvasAspect) {
      // La imagen es más ancha que el canvas, se ajusta a la altura del canvas
      sHeight = img.naturalHeight;
      sWidth = sHeight * canvasAspect;
      sx = (img.naturalWidth - sWidth) / 2; // Centra horizontalmente
      sy = 0;

      dWidth = W;
      dHeight = H;
      dx = 0;
      dy = 0;
    } else {
      // La imagen es más alta que el canvas, se ajusta al ancho del canvas
      sWidth = img.naturalWidth;
      sHeight = sWidth / canvasAspect;
      sx = 0;
      sy = (img.naturalHeight - sHeight) / 2; // Centra verticalmente

      dWidth = W;
      dHeight = H;
      dx = 0;
      dy = 0;
    }
    
    // Dibujar la imagen recortada y escalada
    ctx.drawImage(img, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight);

  } else {
    // Fallback de color si la imagen no se ha cargado
    ctx.fillStyle = "#87CEEB"; // Un color de cielo predeterminado
    ctx.fillRect(0, 0, W, H);
  }

  // Llama a drawTerrain para dibujar la forma y colores específicos del terreno
  drawTerrain(ctx, game.terrain, game.terrainType);

  // Players
  drawPlayers();

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
