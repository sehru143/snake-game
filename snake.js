// All game settings live here so they are easy to find and change.
const CONFIG = {
  gridSize: 24,
  cellSize: 25,
  canvasSize: 600,
  startSpeed: 135,
  fastestSpeed: 58,
  speedUpEveryCoins: 5,
  speedStep: 12,
  startingLength: 5,
  minimumLength: 2,
  pointsPerCoin: 10,
  comboWindow: 3200,
  maximumCombo: 4,
  powerFruitChance: 0.012,
  powerFruitLifetime: 5000,
  powerDurations: { slow: 5000, portal: 5000, bomb: 1800 },
  slowFactor: 1.55,
  bombShrink: 3,
  sparkleCount: 12,
  storageKey: "neonSnakeBest",
  colors: {
    backgrounds: ["#10091d", "#11102a", "#101d2a", "#21102b", "#10241f"],
    grid: "rgba(195, 143, 205, 0.09)",
    snakeStart: "#ff4ca8",
    snakeEnd: "#ffe36e",
    snakeGlow: "rgba(255, 76, 168, 0.55)",
    coin: "#ffe36e",
    coinDark: "#d88732",
    coinLight: "#fff3a6",
    sparkle: "#fff3a6",
    star: "#65cfff",
    bomb: "#ff536b",
    portal: "#c36bff",
    eye: "#fff8e7",
    pupil: "#281438"
  }
};

const canvas = document.getElementById("gameCanvas");
const context = canvas.getContext("2d");
const elements = {
  score: document.getElementById("score"),
  best: document.getElementById("best"),
  combo: document.getElementById("combo"),
  level: document.getElementById("level"),
  powerRow: document.getElementById("powerRow"),
  powerIcon: document.getElementById("powerIcon"),
  powerName: document.getElementById("powerName"),
  powerFill: document.getElementById("powerFill"),
  powerTime: document.getElementById("powerTime"),
  startScreen: document.getElementById("startScreen"),
  gameOverScreen: document.getElementById("gameOverScreen"),
  pauseScreen: document.getElementById("pauseScreen"),
  finalScore: document.getElementById("finalScore"),
  startButton: document.getElementById("startButton"),
  playAgainButton: document.getElementById("playAgainButton"),
  pauseButton: document.getElementById("pauseButton"),
  pauseIcon: document.getElementById("pauseIcon"),
  resumeButton: document.getElementById("resumeButton"),
  dpad: document.getElementById("dpad"),
  muteButton: document.getElementById("muteButton"),
  muteIcon: document.getElementById("muteIcon")
};

const state = {
  status: "ready",
  snake: [],
  direction: { x: 1, y: 0 },
  nextDirection: { x: 1, y: 0 },
  food: null,
  powerFruit: null,
  activePower: null,
  particles: [],
  score: 0,
  best: readBestScore(),
  coins: 0,
  combo: 0,
  comboEndsAt: 0,
  pausedAt: 0,
  lastStepAt: 0,
  lastEffectAt: 0
};

let audioContext = null;
let isMuted = false;
let swipeStart = null;

// Loads the saved high score, or starts at zero if storage is unavailable.
function readBestScore() {
  try {
    return Number(localStorage.getItem(CONFIG.storageKey)) || 0;
  } catch {
    return 0;
  }
}

// Saves a new high score in the browser.
function saveBestScore() {
  try {
    localStorage.setItem(CONFIG.storageKey, String(state.best));
  } catch {
    return;
  }
}

// Starts a fresh round and hides the start and game-over screens.
function startGame() {
  const center = Math.floor(CONFIG.gridSize / 2);
  state.status = "playing";
  state.snake = [];
  for (let index = 0; index < CONFIG.startingLength; index += 1) {
    state.snake.push({ x: center - index, y: center });
  }
  state.direction = { x: 1, y: 0 };
  state.nextDirection = { x: 1, y: 0 };
  state.powerFruit = null;
  state.activePower = null;
  state.particles = [];
  state.score = 0;
  state.coins = 0;
  state.combo = 0;
  state.comboEndsAt = 0;
  state.pausedAt = 0;
  state.lastStepAt = 0;
  spawnFood();
  elements.startScreen.hidden = true;
  elements.gameOverScreen.hidden = true;
  elements.pauseScreen.hidden = true;
  elements.pauseButton.disabled = false;
  elements.pauseButton.setAttribute("aria-label", "Pause game");
  elements.pauseButton.title = "Pause game";
  elements.pauseIcon.textContent = "Ⅱ";
  updateHud();
  playSound("start");
}

// Advances the snake one square and handles food, power-ups, and collisions.
function update(now) {
  if (state.combo > 0 && now >= state.comboEndsAt) {
    state.combo = 0;
  }

  if (!state.powerFruit && Math.random() < CONFIG.powerFruitChance) {
    spawnPowerFruit(now);
  }

  state.direction = state.nextDirection;
  const nextHead = getNextHead();
  const eatsCoin = samePosition(nextHead, state.food);

  if (checkCollision(nextHead, eatsCoin)) {
    gameOver();
    return;
  }

  const eatsPowerFruit = state.powerFruit && samePosition(nextHead, state.powerFruit);
  moveSnake(nextHead, eatsCoin);

  if (eatsCoin) {
    collectCoin(now);
  }

  if (eatsPowerFruit) {
    collectPowerFruit(now);
  }

  updateHud();
}

// Moves the snake forward and keeps its length unless it eats a coin.
function moveSnake(nextHead, grows) {
  state.snake.unshift(nextHead);
  if (!grows) {
    state.snake.pop();
  }
}

// Checks whether the next square hits a wall or the snake's body.
function checkCollision(nextHead, grows) {
  const outside = nextHead.x < 0 || nextHead.x >= CONFIG.gridSize || nextHead.y < 0 || nextHead.y >= CONFIG.gridSize;
  if (outside && !isPortalActive()) {
    return true;
  }

  const bodyToCheck = grows ? state.snake : state.snake.slice(0, -1);
  return bodyToCheck.some((part) => samePosition(part, nextHead));
}

// Finishes the round and shows the final score.
function gameOver() {
  state.status = "over";
  elements.finalScore.textContent = String(state.score);
  elements.gameOverScreen.hidden = false;
  elements.pauseScreen.hidden = true;
  elements.pauseButton.disabled = true;
  playSound("gameOver");
}

// Draws the board and every game object on the canvas.
function draw(now) {
  const levelIndex = Math.floor(state.coins / CONFIG.speedUpEveryCoins);
  const background = CONFIG.colors.backgrounds[levelIndex % CONFIG.colors.backgrounds.length];
  context.fillStyle = background;
  context.fillRect(0, 0, CONFIG.canvasSize, CONFIG.canvasSize);
  drawGrid();

  if (state.food) {
    drawFood(now);
  }
  if (state.powerFruit) {
    drawPowerFruit(now);
  }
  if (state.snake.length > 0) {
    drawSnake();
  }
  drawSparkles();
}

// Draws a faint square grid behind the game.
function drawGrid() {
  context.strokeStyle = CONFIG.colors.grid;
  context.lineWidth = 1;
  for (let line = 1; line < CONFIG.gridSize; line += 1) {
    const position = line * CONFIG.cellSize;
    context.beginPath();
    context.moveTo(position, 0);
    context.lineTo(position, CONFIG.canvasSize);
    context.moveTo(0, position);
    context.lineTo(CONFIG.canvasSize, position);
    context.stroke();
  }
}

// Draws the snake's glowing trail, gradient body, and eyes.
function drawSnake() {
  const centers = state.snake.map((part) => ({
    x: part.x * CONFIG.cellSize + CONFIG.cellSize / 2,
    y: part.y * CONFIG.cellSize + CONFIG.cellSize / 2
  }));

  if (centers.length > 1) {
    context.save();
    context.beginPath();
    context.moveTo(centers[centers.length - 1].x, centers[centers.length - 1].y);
    for (let index = centers.length - 2; index >= 0; index -= 1) {
      context.lineTo(centers[index].x, centers[index].y);
    }
    context.strokeStyle = CONFIG.colors.snakeGlow;
    context.lineWidth = CONFIG.cellSize * 0.55;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.shadowColor = CONFIG.colors.snakeGlow;
    context.shadowBlur = 18;
    context.stroke();
    context.restore();
  }

  state.snake.forEach((part, index) => {
    const progress = state.snake.length <= 1 ? 1 : 1 - index / (state.snake.length - 1);
    context.fillStyle = mixColors(CONFIG.colors.snakeStart, CONFIG.colors.snakeEnd, progress);
    context.shadowColor = CONFIG.colors.snakeGlow;
    context.shadowBlur = index === 0 ? 15 : 7;
    context.fillRect(
      part.x * CONFIG.cellSize + 2,
      part.y * CONFIG.cellSize + 2,
      CONFIG.cellSize - 4,
      CONFIG.cellSize - 4
    );
  });
  context.shadowBlur = 0;
  drawEyes();
}

// Draws two eyes on the side of the snake's head that faces forward.
function drawEyes() {
  const head = state.snake[0];
  const centerX = head.x * CONFIG.cellSize + CONFIG.cellSize / 2;
  const centerY = head.y * CONFIG.cellSize + CONFIG.cellSize / 2;
  const forwardX = state.direction.x * 5;
  const forwardY = state.direction.y * 5;
  const sideX = -state.direction.y * 6;
  const sideY = state.direction.x * 6;

  for (const side of [-1, 1]) {
    const eyeX = centerX + forwardX + sideX * side;
    const eyeY = centerY + forwardY + sideY * side;
    context.fillStyle = CONFIG.colors.eye;
    context.fillRect(eyeX - 2, eyeY - 2, 5, 5);
    context.fillStyle = CONFIG.colors.pupil;
    context.fillRect(eyeX + state.direction.x, eyeY + state.direction.y, 2, 2);
  }
}

// Draws the coin with a simple spinning animation.
function drawFood(now) {
  const centerX = state.food.x * CONFIG.cellSize + CONFIG.cellSize / 2;
  const centerY = state.food.y * CONFIG.cellSize + CONFIG.cellSize / 2;
  const spin = Math.abs(Math.cos(now / 150));
  context.save();
  context.translate(centerX, centerY);
  context.scale(Math.max(0.12, spin), 1);
  context.shadowColor = CONFIG.colors.coin;
  context.shadowBlur = 16;
  context.fillStyle = CONFIG.colors.coinDark;
  context.beginPath();
  context.arc(0, 0, 9, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = CONFIG.colors.coin;
  context.beginPath();
  context.arc(0, 0, 6.5, 0, Math.PI * 2);
  context.fill();
  context.shadowBlur = 0;
  context.fillStyle = CONFIG.colors.coinLight;
  context.fillRect(-1, -4, 2, 8);
  context.restore();
}

// Draws whichever special fruit is waiting on the board.
function drawPowerFruit(now) {
  const centerX = state.powerFruit.x * CONFIG.cellSize + CONFIG.cellSize / 2;
  const centerY = state.powerFruit.y * CONFIG.cellSize + CONFIG.cellSize / 2;
  const remaining = Math.max(0, state.powerFruit.expiresAt - Date.now());
  const pulse = 1 + Math.sin(now / 110) * 0.08;
  context.save();
  context.translate(centerX, centerY);
  context.scale(pulse, pulse);
  context.shadowBlur = 14;

  if (state.powerFruit.type === "slow") {
    context.shadowColor = CONFIG.colors.star;
    context.fillStyle = CONFIG.colors.star;
    drawStar(0, 0, 9, 5, 5);
    context.fill();
  } else if (state.powerFruit.type === "bomb") {
    context.shadowColor = CONFIG.colors.bomb;
    context.fillStyle = CONFIG.colors.bomb;
    context.beginPath();
    context.arc(0, 2, 8, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = CONFIG.colors.coinLight;
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(3, -5);
    context.lineTo(7, -10);
    context.stroke();
  } else {
    context.shadowColor = CONFIG.colors.portal;
    context.strokeStyle = CONFIG.colors.portal;
    context.lineWidth = 3;
    context.beginPath();
    context.ellipse(0, 0, 7, 10, 0, 0, Math.PI * 2);
    context.stroke();
    context.strokeStyle = "#f3d1ff";
    context.lineWidth = 1;
    context.beginPath();
    context.ellipse(0, 0, 3, 7, 0, 0, Math.PI * 2);
    context.stroke();
  }

  context.shadowBlur = 0;
  context.strokeStyle = `rgba(255, 246, 223, ${remaining / CONFIG.powerFruitLifetime})`;
  context.lineWidth = 2;
  context.beginPath();
  context.arc(0, 0, 11, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (remaining / CONFIG.powerFruitLifetime));
  context.stroke();
  context.restore();
}

// Draws a five-point star for the blue power-up.
function drawStar(centerX, centerY, outerRadius, points, innerRadius) {
  context.beginPath();
  for (let point = 0; point < points * 2; point += 1) {
    const radius = point % 2 === 0 ? outerRadius : innerRadius;
    const angle = -Math.PI / 2 + (point * Math.PI) / points;
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;
    if (point === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  }
  context.closePath();
}

// Draws the sparkles left behind when a coin is collected.
function drawSparkles() {
  state.particles.forEach((particle) => {
    context.globalAlpha = Math.max(0, particle.life / particle.maxLife);
    context.fillStyle = CONFIG.colors.sparkle;
    context.shadowColor = CONFIG.colors.coin;
    context.shadowBlur = 8;
    context.fillRect(particle.x, particle.y, 4, 4);
  });
  context.globalAlpha = 1;
  context.shadowBlur = 0;
}

// Finds a free square and places a new coin there.
function spawnFood() {
  state.food = findOpenCell(state.powerFruit ? [state.powerFruit] : []);
}

// Places a random special fruit that vanishes after a few seconds.
function spawnPowerFruit(now) {
  const types = ["slow", "bomb", "portal"];
  const type = types[Math.floor(Math.random() * types.length)];
  const cell = findOpenCell(state.food ? [state.food] : []);
  state.powerFruit = { ...cell, type, expiresAt: now + CONFIG.powerFruitLifetime };
}

// Picks an empty grid square that is not covered by the snake or another item.
function findOpenCell(otherItems) {
  let cell;
  do {
    cell = {
      x: Math.floor(Math.random() * CONFIG.gridSize),
      y: Math.floor(Math.random() * CONFIG.gridSize)
    };
  } while (
    state.snake.some((part) => samePosition(part, cell)) ||
    otherItems.some((item) => samePosition(item, cell))
  );
  return cell;
}

// Returns the square the head will enter, including portal wraparound.
function getNextHead() {
  const next = {
    x: state.snake[0].x + state.direction.x,
    y: state.snake[0].y + state.direction.y
  };
  if (isPortalActive()) {
    next.x = (next.x + CONFIG.gridSize) % CONFIG.gridSize;
    next.y = (next.y + CONFIG.gridSize) % CONFIG.gridSize;
  }
  return next;
}

// Gives points, updates the combo, and drops sparkles for a coin.
function collectCoin(now) {
  if (now <= state.comboEndsAt && state.combo > 0) {
    state.combo = Math.min(state.combo + 1, CONFIG.maximumCombo);
  } else {
    state.combo = 1;
  }
  state.comboEndsAt = now + CONFIG.comboWindow;
  state.coins += 1;
  state.score += CONFIG.pointsPerCoin * state.combo;

  if (state.score > state.best) {
    state.best = state.score;
    saveBestScore();
  }

  makeSparkles(state.snake[0]);
  spawnFood();
  playSound("coin");
}

// Applies the picked-up fruit's special effect.
function collectPowerFruit(now) {
  const type = state.powerFruit.type;
  state.powerFruit = null;
  state.activePower = { type, endsAt: now + CONFIG.powerDurations[type] };

  if (type === "bomb") {
    state.snake.length = Math.max(CONFIG.minimumLength, state.snake.length - CONFIG.bombShrink);
  }
  playSound("power");
}

// Creates a small burst of gold squares at the snake's head.
function makeSparkles(cell) {
  const centerX = cell.x * CONFIG.cellSize + CONFIG.cellSize / 2;
  const centerY = cell.y * CONFIG.cellSize + CONFIG.cellSize / 2;
  for (let index = 0; index < CONFIG.sparkleCount; index += 1) {
    const angle = (Math.PI * 2 * index) / CONFIG.sparkleCount;
    const speed = 1 + Math.random() * 2;
    state.particles.push({
      x: centerX,
      y: centerY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 460,
      maxLife: 460
    });
  }
}

// Updates sparkle motion and expires timed items and power-ups.
function updateEffects(now) {
  const elapsed = Math.min(now - state.lastEffectAt, 50) / 16.7;
  state.lastEffectAt = now;
  state.particles.forEach((particle) => {
    particle.x += particle.vx * elapsed;
    particle.y += particle.vy * elapsed;
    particle.life -= elapsed * 16.7;
  });
  state.particles = state.particles.filter((particle) => particle.life > 0);

  if (state.powerFruit && now >= state.powerFruit.expiresAt) {
    state.powerFruit = null;
  }
  if (state.activePower && now >= state.activePower.endsAt) {
    state.activePower = null;
  }
  if (state.status === "playing" && state.combo > 0 && now >= state.comboEndsAt) {
    state.combo = 0;
  }
  updatePowerDisplay(now);
}

// Shows the active power-up and its remaining time.
function updatePowerDisplay(now) {
  if (!state.activePower) {
    elements.powerRow.hidden = true;
    return;
  }

  const names = { slow: ["★", "SLOW TIME"], bomb: ["●", "BOMB"], portal: ["◉", "PORTAL"] };
  const total = CONFIG.powerDurations[state.activePower.type];
  const remaining = Math.max(0, state.activePower.endsAt - now);
  const details = names[state.activePower.type];
  elements.powerRow.hidden = false;
  elements.powerIcon.textContent = details[0];
  elements.powerName.textContent = details[1];
  elements.powerFill.style.transform = `scaleX(${remaining / total})`;
  elements.powerTime.textContent = `${(remaining / 1000).toFixed(1)}s`;
  elements.powerFill.style.backgroundColor = state.activePower.type === "portal" ? CONFIG.colors.portal : state.activePower.type === "bomb" ? CONFIG.colors.bomb : CONFIG.colors.star;
}

// Refreshes the score, combo, and level labels above the board.
function updateHud() {
  elements.score.textContent = String(state.score).padStart(5, "0");
  elements.best.textContent = String(state.best).padStart(5, "0");
  elements.combo.textContent = `x${state.combo}`;
  elements.level.textContent = String(Math.floor(state.coins / CONFIG.speedUpEveryCoins) + 1).padStart(2, "0");
}

// Returns the movement delay for the current level and power-up.
function getSpeed() {
  const level = Math.floor(state.coins / CONFIG.speedUpEveryCoins);
  const levelSpeed = Math.max(CONFIG.fastestSpeed, CONFIG.startSpeed - level * CONFIG.speedStep);
  return isSlowActive() ? levelSpeed * CONFIG.slowFactor : levelSpeed;
}

// Returns true while the slow-time power-up is active.
function isSlowActive() {
  return state.activePower && state.activePower.type === "slow";
}

// Returns true while the wall-portal power-up is active.
function isPortalActive() {
  return state.activePower && state.activePower.type === "portal";
}

// Changes the next move if it does not reverse into the snake.
function setDirection(direction) {
  const current = state.direction;
  const isReverse = direction.x === -current.x && direction.y === -current.y;
  if (!isReverse) {
    state.nextDirection = direction;
  }
}

// Handles keyboard movement and starts the game from the start screen.
function handleKeydown(event) {
  const key = event.key.toLowerCase();
  const directions = {
    arrowup: { x: 0, y: -1 }, w: { x: 0, y: -1 },
    arrowdown: { x: 0, y: 1 }, s: { x: 0, y: 1 },
    arrowleft: { x: -1, y: 0 }, a: { x: -1, y: 0 },
    arrowright: { x: 1, y: 0 }, d: { x: 1, y: 0 }
  };

  if (directions[key]) {
    event.preventDefault();
    if (state.status === "playing") {
      setDirection(directions[key]);
    }
  } else if ((key === "enter" || key === " ") && (state.status === "ready" || state.status === "over")) {
    event.preventDefault();
    startGame();
  } else if ((key === "enter" || key === " ") && state.status === "paused") {
    event.preventDefault();
    togglePause();
  }
}

// Saves the starting point of a finger swipe.
function handleTouchStart(event) {
  const touch = event.changedTouches[0];
  swipeStart = { x: touch.clientX, y: touch.clientY };
}

// Turns a long enough finger swipe into a movement direction.
function handleTouchEnd(event) {
  if (!swipeStart) {
    return;
  }
  const touch = event.changedTouches[0];
  const differenceX = touch.clientX - swipeStart.x;
  const differenceY = touch.clientY - swipeStart.y;
  swipeStart = null;
  if (Math.max(Math.abs(differenceX), Math.abs(differenceY)) < 30 || state.status !== "playing") {
    return;
  }
  if (Math.abs(differenceX) > Math.abs(differenceY)) {
    setDirection({ x: Math.sign(differenceX), y: 0 });
  } else {
    setDirection({ x: 0, y: Math.sign(differenceY) });
  }
}

// Moves in the direction of a tapped D-pad arrow.
function handleDpad(event) {
  const directions = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 }
  };
  const direction = directions[event.currentTarget.dataset.direction];
  if (state.status === "playing" && direction) {
    setDirection(direction);
  }
}

// Pauses the game or continues from the paused screen.
function togglePause() {
  if (state.status === "playing") {
    state.status = "paused";
    state.pausedAt = Date.now();
    elements.pauseScreen.hidden = false;
    elements.pauseIcon.textContent = "▶";
    elements.pauseButton.setAttribute("aria-label", "Resume game");
    elements.pauseButton.title = "Resume game";
  } else if (state.status === "paused") {
    const pauseDuration = Date.now() - state.pausedAt;
    state.status = "playing";
    state.lastStepAt = performance.now();
    state.comboEndsAt += pauseDuration;
    if (state.powerFruit) {
      state.powerFruit.expiresAt += pauseDuration;
    }
    if (state.activePower) {
      state.activePower.endsAt += pauseDuration;
    }
    elements.pauseScreen.hidden = true;
    elements.pauseIcon.textContent = "Ⅱ";
    elements.pauseButton.setAttribute("aria-label", "Pause game");
    elements.pauseButton.title = "Pause game";
  }
}

// Redraws the board after a screen resize or device rotation.
function handleResize() {
  draw(performance.now());
}

// Toggles sound on and off from the mute button.
function toggleMute() {
  isMuted = !isMuted;
  elements.muteIcon.textContent = isMuted ? "×" : "♫";
  elements.muteButton.setAttribute("aria-label", isMuted ? "Unmute sound" : "Mute sound");
  elements.muteButton.title = isMuted ? "Unmute sound" : "Mute sound";
  if (!isMuted) {
    playSound("start");
  }
}

// Plays a short beep using the browser's built-in audio tools.
function playSound(kind) {
  if (isMuted || !window.AudioContext) {
    return;
  }
  try {
    audioContext = audioContext || new AudioContext();
    if (audioContext.state === "suspended") {
      audioContext.resume();
    }
    const settings = {
      start: { frequency: 440, duration: 0.08, wave: "square" },
      coin: { frequency: 740, duration: 0.09, wave: "sine" },
      power: { frequency: 520, duration: 0.18, wave: "triangle" },
      gameOver: { frequency: 180, duration: 0.28, wave: "sawtooth" }
    }[kind];
    const oscillator = audioContext.createOscillator();
    const volume = audioContext.createGain();
    oscillator.type = settings.wave;
    oscillator.frequency.value = settings.frequency;
    volume.gain.setValueAtTime(0.07, audioContext.currentTime);
    volume.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + settings.duration);
    oscillator.connect(volume);
    volume.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + settings.duration);
  } catch {
    return;
  }
}

// Compares two grid positions.
function samePosition(first, second) {
  return first && second && first.x === second.x && first.y === second.y;
}

// Blends two hex colors for the snake's pink-to-yellow body.
function mixColors(start, end, amount) {
  const startNumber = Number.parseInt(start.slice(1), 16);
  const endNumber = Number.parseInt(end.slice(1), 16);
  const red = Math.round(((startNumber >> 16) & 255) * (1 - amount) + ((endNumber >> 16) & 255) * amount);
  const green = Math.round(((startNumber >> 8) & 255) * (1 - amount) + ((endNumber >> 8) & 255) * amount);
  const blue = Math.round((startNumber & 255) * (1 - amount) + (endNumber & 255) * amount);
  return `rgb(${red}, ${green}, ${blue})`;
}

// Runs the game clock and redraws the canvas smoothly.
function gameLoop(now) {
  requestAnimationFrame(gameLoop);
  if (state.status !== "paused") {
    updateEffects(Date.now());
  }
  if (state.status === "playing" && now - state.lastStepAt >= getSpeed()) {
    state.lastStepAt = now;
    update(Date.now());
  }
  draw(now);
}

// Connects the buttons and input controls, then starts drawing frames.
function initializeGame() {
  document.documentElement.style.setProperty("--sky", CONFIG.colors.backgrounds[0]);
  elements.startButton.addEventListener("click", startGame);
  elements.playAgainButton.addEventListener("click", startGame);
  elements.pauseButton.addEventListener("click", togglePause);
  elements.resumeButton.addEventListener("click", togglePause);
  elements.muteButton.addEventListener("click", toggleMute);
  window.addEventListener("keydown", handleKeydown);
  window.addEventListener("resize", handleResize);
  canvas.addEventListener("touchstart", handleTouchStart, { passive: true });
  canvas.addEventListener("touchend", handleTouchEnd, { passive: true });
  elements.dpad.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", handleDpad);
  });
  updateHud();
  requestAnimationFrame(gameLoop);
}

initializeGame();
