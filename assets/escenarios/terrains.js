// Opciones de terrenos disponibles
const terrainOptions = [
  { value: "", label: "Aleatorio" },
  { value: "flat", label: "Plano" },
  { value: "hills", label: "Colinas" },
  { value: "mountain", label: "Montaña" },
  { value: "valley", label: "Valle" }
];
// Obtener el elemento select y agregar las opciones
const selectElement = document.getElementById("terrainSelect");

terrainOptions.forEach(op => {
  const option = document.createElement("option");
  option.value = op.value;
  option.textContent = op.label;
  selectElement.appendChild(option);
});

// Terrenos predefinidos
const predefinedTerrains = {
  // Plano
  flat: [
    { x: 0, y: 550 },          // Inicio del plano a la altura 300
    { x: 1100, y: 550 }        // Fin del plano a la misma altura 300 (asumiendo W=1100)
  ],
  // Colinas
  hills: [
    { x: 0, y: 540 }, { x: 100, y: 500 }, { x: 200, y: 520 },
    { x: 300, y: 480 }, { x: 400, y: 490 }, { x: 500, y: 460 },
    { x: 600, y: 500 }, { x: 700, y: 470 }, { x: 800, y: 540 },
    { x: 900, y: 500 }, { x: 1000, y: 530 }, { x: 1100, y: 510 }
  ],
  // Montaña
  mountain: [
    { x: 0, y: 560 },
    { x: 200, y: 500 },
    { x: 400, y: 360 },
    { x: 550, y: 260 }, // centro
    { x: 700, y: 360 },
    { x: 900, y: 500 },
    { x: 1100, y: 560 }
  ],
  valley: [
    // Puntos altos en los extremos
    { x: 0, y: 380 },    // Inicio más alto
    { x: 100, y: 380 },  // Borde de la primera meseta (izquierda)

    // Descenso gradual hacia el centro
    { x: 120, y: 420 },  // Primer "escalón" descendente
    { x: 200, y: 420 },
    { x: 220, y: 480 },  // Segundo escalón
    { x: 300, y: 480 },
    { x: 320, y: 550 },  // Tercer escalón (cercano al punto más bajo)
    { x: 400, y: 550 },

    // Fondo de la depresión (más bajo y plano)
    { x: 450, y: 580 },  // Punto más bajo del valle/depresión
    { x: 650, y: 580 },

    // Ascenso gradual hacia el otro extremo
    { x: 700, y: 550 },  // Subida del tercer escalón
    { x: 780, y: 550 },
    { x: 800, y: 480 },  // Subida del segundo escalón
    { x: 880, y: 480 },
    { x: 900, y: 420 },  // Subida del primer escalón
    { x: 980, y: 420 },

    // Puntos altos en los extremos
    { x: 1000, y: 380 }, // Borde de la última meseta (derecha)
    { x: 1100, y: 380 }   // Fin más alto
  ]
};

function drawTerrain(ctx, terrain, type) {

  let fillStyle = "#228B22"; // color por defecto
  if (type === "flat") {
    fillStyle = "#070d46"; // azul oscuro
  }
  if (type === "mountain") {
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0.4, "#ffffff"); // nieve
    gradient.addColorStop(0.9, "#485055"); // roca
    gradient.addColorStop(1, "#283f41");   // tierra
    fillStyle = gradient;
  }

  if (type === "valley") {
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0.4, "#932919"); // tierra
    gradient.addColorStop(0.3, "#742115"); // tierra
    gradient.addColorStop(1, "#50341f");   // más oscuro
    fillStyle = gradient;

  }
  if (type === "hills") fillStyle = "#0a8f00";

  // Dibujar cada segmento con el mismo color o gradiente
  ctx.fillStyle = fillStyle;
  for (let i = 0; i < terrain.length - 1; i++) {
    const p1 = terrain[i];
    const p2 = terrain[i + 1];

    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p2.x, 600);
    ctx.lineTo(p1.x, 600);
    ctx.closePath();
    ctx.fill();
  }
}
