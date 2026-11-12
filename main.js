(() => {
  const canvas = document.getElementById('battle');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const W = 600, H = 600;
  const MAP_DATA = {
    name: '草原の訓練場',
    width: 16,
    height: 16,
    terrain: Array.from({ length: 16 }, () => Array(16).fill('grass')),
    obstacles: []
  };

  const ui = {
    turnLabel: document.getElementById('turnLabel'),
    phaseLabel: document.getElementById('phaseLabel'),
    attackBtn: document.getElementById('attackBtn'),
    itemBtn: document.getElementById('itemBtn'),
    waitBtn: document.getElementById('waitBtn'),
    messageBox: document.getElementById('messageBox'),
    introBanner: document.getElementById('introBanner'),
    levelUpBanner: document.getElementById('levelUpBanner'),
    levelUpTitle: document.getElementById('levelUpTitle'),
    levelUpMessage: document.getElementById('levelUpMessage'),
    levelUpPrompt: document.getElementById('levelUpPrompt'),
    resultScreen: document.getElementById('resultScreen'),
    resultTitle: document.getElementById('resultTitle'),
    resultRows: document.getElementById('resultRows'),
    resultGold: document.getElementById('resultGold'),
    replayBtn: document.getElementById('replayBtn')
  };

  const state = {
    round: 1,
    activeUnitId: null,
    actionMode: null,
    battleOver: false,
    focusId: null,
    animationLock: true,
    movementConfirmed: false,
    movementOrigin: null,
    movementTiles: new Set(),
    camera: { scale: 1, offsetX: 0, offsetY: 0 },
    pendingBounty: 0,
    gold: 0,
    resultShown: false,
    levelUpPending: false,
    levelUpStage: 0,
    levelUpStats: null,
    levelUpCallback: null
  };

  const inventory = {
    healingPotion: { name: '回復薬', count: 3, healAmount: 10 }
  };

  let selected = 'alex';
  const TEST_ENEMY_COUNT = 2;
  const TEST_ENEMY_EXP_REWARD = 50;
  const allyUnits = [
    { id: 'alex', name: 'アレク', team: 'ally', side: 'ally', x: 4, y: 11, hp: 30, maxHp: 30, attack: 10, defense: 3, speed: 12, moveRange: 3, level: 1, exp: 0, battleExp: 0, battleLevels: 0, color: '#9b4c19', hasActed: false },
    { id: 'ally2', name: '仲間', team: 'ally', side: 'ally', x: 11, y: 11, hp: 24, maxHp: 24, attack: 8, defense: 2, speed: 15, moveRange: 3, level: 1, exp: 0, battleExp: 0, battleLevels: 0, color: '#c4a24b', hasActed: false },
    { id: 'ally3', name: 'サラ', team: 'ally', side: 'ally', x: 6, y: 13, hp: 36, maxHp: 36, attack: 7, defense: 5, speed: 8, moveRange: 3, level: 1, exp: 0, battleExp: 0, battleLevels: 0, color: '#4d86b8', hasActed: false }
  ];
  const enemyUnits = [
    { id: 'slime', name: 'スライム', team: 'enemy', side: 'enemy', x: 8, y: 4, hp: 20, maxHp: 20, attack: 8, defense: 2, speed: 10, moveRange: 2, expReward: TEST_ENEMY_EXP_REWARD, bounty: 20, color: '#8b713f', hasActed: false },
    { id: 'bat', name: 'コウモリ', team: 'enemy', side: 'enemy', x: 10, y: 6, hp: 18, maxHp: 18, attack: 7, defense: 1, speed: 13, moveRange: 3, expReward: TEST_ENEMY_EXP_REWARD, bounty: 25, color: '#7d5d94', hasActed: false },
    { id: 'goblin', name: 'ゴブリン', team: 'enemy', side: 'enemy', x: 12, y: 3, hp: 28, maxHp: 28, attack: 9, defense: 3, speed: 7, moveRange: 2, expReward: TEST_ENEMY_EXP_REWARD, bounty: 35, color: '#6e8b53', hasActed: false }
  ].slice(0, TEST_ENEMY_COUNT);
  const units = [...allyUnits, ...enemyUnits];
  const initialUnits = units.map((unit) => ({ ...unit }));

  function rect(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
  function line(x1, y1, x2, y2, c, w = 1) { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
  function text(t, x, y, size = 16, c = '#eee', font = 'monospace') { ctx.fillStyle = c; ctx.font = `bold ${size}px ${font}`; ctx.fillText(t, x, y); }
  function polygon(points, c) { ctx.fillStyle = c; ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); ctx.fill(); }

  function mapPoint(x, y) {
    const depth = y / MAP_DATA.height;
    const tileWidth = 34 + 6 * depth;
    return {
      x: W / 2 + (x - MAP_DATA.width / 2) * tileWidth,
      y: 125 + 290 * Math.pow(depth, 1.08)
    };
  }

  function unitPoint(x, y) {
    return mapPoint(x + 0.5, y + 0.5);
  }

  function getUnitById(id) {
    return units.find((u) => u.id === id && u.hp > 0) || null;
  }

  function getSelectedUnit() {
    return getUnitById(selected) || getActiveUnit();
  }

  function getActiveUnit() {
    return getUnitById(state.activeUnitId);
  }

  function isInBounds(x, y) {
    return x >= 0 && y >= 0 && x < MAP_DATA.width && y < MAP_DATA.height;
  }

  function getUnitAt(x, y) {
    return units.find((u) => u.hp > 0 && u.x === x && u.y === y) || null;
  }

  function manhattan(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  function drawTile(x, y, terrain) {
    const points = [
      mapPoint(x, y),
      mapPoint(x + 1, y),
      mapPoint(x + 1, y + 1),
      mapPoint(x, y + 1)
    ];
    const colors = { grass: ['#687b43', '#71834a', '#637840', '#6c8046'] };
    const palette = colors[terrain] || colors.grass;
    const color = palette[(x * 7 + y * 11) % palette.length];
    polygon(points.map((point) => [point.x, point.y]), color);
    ctx.strokeStyle = '#4b6137';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    points.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
    ctx.closePath();
    ctx.stroke();
  }

  function drawBattleMap() {
    rect(0, 0, W, H, '#28382f');
    const horizon = ctx.createLinearGradient(0, 80, 0, 180);
    horizon.addColorStop(0, '#263831');
    horizon.addColorStop(1, '#40513a');
    rect(0, 80, W, 100, horizon);
    for (let diagonal = 0; diagonal < MAP_DATA.width + MAP_DATA.height - 1; diagonal += 1) {
      for (let x = 0; x < MAP_DATA.width; x += 1) {
        const y = diagonal - x;
        if (y >= 0 && y < MAP_DATA.height) drawTile(x, y, MAP_DATA.terrain[y][x]);
      }
    }
  }

  function drawShadow(x, y, s) {
    ctx.fillStyle = '#0009';
    ctx.beginPath();
    ctx.ellipse(x, y, 14 * s, 5 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawBeast(x, y) {
    rect(x - 13, y - 8, 26, 22, '#9a7742');
    rect(x - 9, y - 14, 18, 12, '#b28b4e');
    polygon([[x - 8, y - 13], [x - 17, y - 28], [x - 14, y - 8]], '#b99a60');
    polygon([[x + 8, y - 13], [x + 17, y - 28], [x + 14, y - 8]], '#b99a60');
    rect(x - 9, y + 12, 6, 7, '#59472f');
    rect(x + 4, y + 12, 6, 7, '#59472f');
    rect(x - 5, y - 7, 3, 3, '#1b1711');
    rect(x + 3, y - 7, 3, 3, '#1b1711');
  }

  function drawHuman(u) {
    if (u.hp <= 0) return;
    ensureVisualPosition(u);
    const p = unitPoint(u.renderX, u.renderY);
    const x = p.x, y = p.y - 19;
    const isFocused = state.focusId === u.id;

    drawShadow(x, y + 20, 1);
    if (isFocused) {
      ctx.strokeStyle = '#ffe36a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(x, y + 20, 20, 7, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (selected === u.id) {
      ctx.strokeStyle = '#e8d84a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(x, y + 19, 20, 7, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    rect(x - 8, y + 8, 6, 12, '#29251f');
    rect(x + 3, y + 8, 6, 12, '#29251f');
    rect(x - 10, y + 17, 9, 4, '#171717');
    rect(x + 2, y + 17, 10, 4, '#171717');
    rect(x - 10, y - 8, 20, 19, u.color);
    rect(x - 13, y - 5, 5, 13, '#74401f');
    rect(x + 8, y - 5, 5, 13, '#74401f');
    rect(x - 8, y - 12, 16, 9, '#d4a16b');
    rect(x - 9, y - 17, 18, 7, u.id === 'ally2' ? '#68452b' : '#34251d');
    rect(x - 7, y - 20, 14, 5, '#d7a274');
    rect(x - 4, y - 12, 2, 2, '#171717');
    rect(x + 3, y - 12, 2, 2, '#171717');
    rect(x - 8, y - 5, 5, 3, '#e1b36b');

    if (u.team === 'enemy') drawBeast(x, y + 2);
    if (u.team === 'ally' && u.id === 'alex') {
      line(x + 10, y + 3, x + 32, y + 17, '#c7d0c0', 3);
      line(x + 30, y + 15, x + 38, y + 19, '#e4e1c6', 2);
    }

  }

  function drawTarget() {
    const u = getSelectedUnit();
    if (!u) return;
    ensureVisualPosition(u);
    const p = unitPoint(u.renderX, u.renderY);
    const x = p.x, y = p.y - 19;
    polygon([[x - 18, y - 39], [x + 18, y - 39], [x + 14, y - 27], [x - 14, y - 27]], '#d5a52b');
    text('▼', x - 5, y - 29, 13, '#7b210d');
  }

  function drawHud() {
    rect(0, 430, 600, 60, '#050505');
    rect(0, 430, 600, 2, '#777');
    const u = getSelectedUnit() || units[0];
    rect(42, 435, 35, 50, '#211d16');
    rect(49, 440, 21, 23, u.color);
    rect(51, 435, 17, 9, '#34251d');
    rect(53, 447, 3, 3, '#161616');
    rect(63, 447, 3, 3, '#161616');
    text(u.name, 88, 453, 21, '#eee');
    text(u.team === 'ally' ? `Lv ${u.level}` : 'Lv --', 160, 453, 12, '#bdbdbd');
    text(`HP ${u.hp}/${u.maxHp}`, 90, 481, 17, '#ddd');
    text(`ATK ${u.attack}`, 220, 471, 15, '#eee');
    text(`DEF ${u.defense}`, 220, 488, 15, '#eee');
    text(`SPD ${u.speed}`, 300, 488, 15, '#eee');
    rect(420, 438, 146, 8, '#222');
    rect(422, 440, 142 * (u.hp / u.maxHp), 4, '#d4c526');
    rect(422 + 142 * (u.hp / u.maxHp), 440, 142 * (1 - u.hp / u.maxHp), 4, '#a32626');
    const levelExp = u.team === 'ally' ? u.exp - (u.level - 1) * 50 : 0;
    text(u.team === 'ally' ? `EXP ${levelExp}/50` : 'EXP --', 420, 461, 10, '#ddd');
    rect(422, 468, 142, 6, '#222');
    if (u.team === 'ally') rect(422, 469, 142 * Math.min(levelExp / 50, 1), 4, '#61b5e5');
    line(410, 434, 410, 486, '#555', 1);
  }

  function drawActionHints() {
    const active = getActiveUnit();
    if (!active || state.battleOver) return;

    if (active.team === 'ally' && !state.movementConfirmed) {
      for (const cell of state.movementTiles) {
        const [x, y] = cell.split(',').map(Number);
        const points = [
          mapPoint(x, y),
          mapPoint(x + 1, y),
          mapPoint(x + 1, y + 1),
          mapPoint(x, y + 1)
        ];
        polygon(points.map((point) => [point.x, point.y]), 'rgba(255, 234, 120, 0.38)');
      }
    }

    if (state.actionMode === 'attack') {
      for (const enemy of getAttackTargets(active)) {
        const p = unitPoint(enemy.x, enemy.y);
        ctx.fillStyle = 'rgba(255, 80, 80, 0.22)';
        ctx.fillRect(p.x - 20, p.y - 28, 40, 34);
      }
    }

    if (state.actionMode === 'item') {
      for (const ally of units) {
        if (ally.hp <= 0 || ally.team !== 'ally' || ally.hp === ally.maxHp) continue;
        const p = unitPoint(ally.x, ally.y);
        ctx.fillStyle = 'rgba(100, 220, 130, 0.22)';
        ctx.fillRect(p.x - 20, p.y - 28, 40, 34);
      }
    }
  }

  function draw() {
    const camera = getCameraTransform();
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, 430);
    ctx.clip();
    ctx.translate(camera.offsetX, camera.offsetY);
    ctx.scale(camera.scale, camera.scale);
    drawBattleMap();
    drawActionHints();
    [...units].sort((a, b) => (a.x + a.y) - (b.x + b.y)).forEach(drawHuman);
    drawTarget();
    ctx.restore();
    drawHud();
  }

  function getCameraTransform() {
    if (state.camera) return state.camera;
    const scale = state.focusId ? 1.25 : 1;
    const focused = getUnitById(state.focusId);
    if (!focused) return { scale: 1, offsetX: 0, offsetY: 0 };

    ensureVisualPosition(focused);
    const point = unitPoint(focused.renderX, focused.renderY);
    return {
      scale,
      offsetX: W / 2 - point.x * scale,
      offsetY: 215 - point.y * scale
    };
  }

  function getCameraAt(x, y, scale) {
    const point = mapPoint(x, y);
    return {
      scale,
      offsetX: W / 2 - point.x * scale,
      offsetY: 215 - point.y * scale
    };
  }

  function animateCamera(target, duration) {
    const start = { ...state.camera };
    const startTime = performance.now();
    return new Promise((resolve) => {
      const step = (now) => {
        const progress = Math.min((now - startTime) / duration, 1);
        const eased = progress * progress * (3 - 2 * progress);
        state.camera = {
          scale: start.scale + (target.scale - start.scale) * eased,
          offsetX: start.offsetX + (target.offsetX - start.offsetX) * eased,
          offsetY: start.offsetY + (target.offsetY - start.offsetY) * eased
        };
        draw();
        if (progress < 1) {
          requestAnimationFrame(step);
        } else {
          resolve();
        }
      };
      requestAnimationFrame(step);
    });
  }

  function startBattle() {
    const openingView = [
      [3, 3],
      [13, 3],
      [13, 12],
      [3, 12]
    ];
    ui.introBanner.hidden = false;
    ui.introBanner.textContent = '戦闘突入';
    draw();

    setTimeout(async () => {
      ui.introBanner.textContent = 'フィールドを確認中';
      for (const [x, y] of openingView) {
        await animateCamera(getCameraAt(x, y, 1.45), 1400);
      }
      await animateCamera({ scale: 1, offsetX: 0, offsetY: 0 }, 850);
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const first = pickNextUnit();
      if (!first) {
        finishBattle('defeat');
        return;
      }
      state.activeUnitId = first.id;
      state.focusId = first.id;
      selected = first.id;
      beginUnitTurn(first);
      updateTurnInfo();
      ui.introBanner.hidden = true;
      await animateCamera(getCameraAt(first.x + 0.5, first.y + 0.5, 1.25), 800);
      state.camera = null;
      state.animationLock = first.team === 'enemy';
      updateTurnInfo();
      setMessage(`${first.name} のターンです。移動可能範囲から行動を開始してください`);
      draw();
      if (first.team === 'enemy') setTimeout(() => enemyTakeAction(first), 500);
    }, 1000);
  }

  function updateTurnInfo() {
    const active = getActiveUnit();
    if (active) {
      ui.phaseLabel.textContent = active.team === 'ally' ? '味方のターン' : '敵のターン';
      ui.turnLabel.textContent = `Round ${state.round}`;
    }
    const isPlayerTurn = active && active.team === 'ally' && !state.battleOver;
    ui.attackBtn.disabled = !isPlayerTurn || state.animationLock;
    ui.itemBtn.disabled = !isPlayerTurn || state.animationLock || inventory.healingPotion.count <= 0;
    ui.waitBtn.disabled = !isPlayerTurn || state.animationLock;
    ui.itemBtn.textContent = `アイテム(${inventory.healingPotion.count})`;
    ui.attackBtn.classList.toggle('active', state.actionMode === 'attack');
    ui.itemBtn.classList.toggle('active', state.actionMode === 'item');
    ui.waitBtn.classList.toggle('active', false);
  }

  function setMessage(msg) {
    ui.messageBox.textContent = msg;
  }

  function ensureVisualPosition(unit) {
    if (unit.renderX === undefined) unit.renderX = unit.x;
    if (unit.renderY === undefined) unit.renderY = unit.y;
  }

  function animateUnitMove(unit, targetX, targetY, onComplete) {
    if (!unit) return;
    ensureVisualPosition(unit);
    const startX = unit.renderX;
    const startY = unit.renderY;
    if (startX === targetX && startY === targetY) {
      unit.renderX = targetX;
      unit.renderY = targetY;
      if (onComplete) onComplete();
      return;
    }

    const startTime = performance.now();
    const duration = 420;
    const step = (now) => {
      const t = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      unit.renderX = startX + (targetX - startX) * eased;
      unit.renderY = startY + (targetY - startY) * eased;
      draw();
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        unit.x = targetX;
        unit.y = targetY;
        unit.renderX = targetX;
        unit.renderY = targetY;
        draw();
        if (onComplete) onComplete();
      }
    };

    requestAnimationFrame(step);
  }

  function pickNextUnit() {
    const alive = units.filter((u) => u.hp > 0);
    if (!alive.length) return null;
    const ordered = [...alive].sort((a, b) => b.speed - a.speed || a.name.localeCompare(b.name));
    const ready = ordered.find((u) => !u.hasActed);
    return ready || ordered[0];
  }

  function advanceTurn() {
    if (state.battleOver) return;
    const current = getActiveUnit();
    if (current) current.hasActed = true;

    const alive = units.filter((u) => u.hp > 0);
    let next = [...alive].filter((u) => !u.hasActed).sort((a, b) => b.speed - a.speed || a.name.localeCompare(b.name))[0];

    if (!next) {
      alive.forEach((u) => { u.hasActed = false; });
      state.round += 1;
      next = [...alive].sort((a, b) => b.speed - a.speed || a.name.localeCompare(b.name))[0];
    }

    if (!next) {
      checkBattleOver();
      return;
    }

    state.activeUnitId = next.id;
    state.focusId = next.id;
    state.actionMode = null;
    beginUnitTurn(next);
    selected = next.id;
    updateTurnInfo();
    draw();

    if (next.team === 'ally') {
      setMessage(`${next.name} のターンです。移動可能範囲から行動を開始してください`);
    } else {
      setMessage(`${next.name} が行動を開始した`);
      setTimeout(() => enemyTakeAction(next), 500);
    }

  }

  function beginUnitTurn(unit) {
    state.movementConfirmed = unit.team !== 'ally';
    state.movementOrigin = unit.team === 'ally' ? `${unit.x},${unit.y}` : null;
    state.movementTiles = unit.team === 'ally' ? getReachableTiles(unit) : new Set();
  }

  function checkBattleOver() {
    if (state.battleOver) return true;
    const allies = units.filter((u) => u.hp > 0 && u.team === 'ally');
    const enemies = units.filter((u) => u.hp > 0 && u.team === 'enemy');
    if (!allies.length) {
      finishBattle('defeat');
      return true;
    }
    if (!enemies.length) {
      finishBattle('victory');
      return true;
    }
    return false;
  }

  function finishBattle(outcome) {
    if (state.resultShown) return;
    state.resultShown = true;
    state.battleOver = true;
    state.animationLock = true;
    state.movementConfirmed = true;
    state.actionMode = null;
    state.gold += state.pendingBounty;

    ui.resultTitle.textContent = outcome === 'victory' ? '戦闘勝利' : '戦闘敗北';
    ui.resultRows.replaceChildren();
    for (const unit of units.filter((entry) => entry.team === 'ally')) {
      const row = document.createElement('tr');
      for (const value of [
        unit.name,
        `${unit.battleExp} EXP`,
        `${unit.battleLevels} レベル`,
        `Lv ${unit.level}`
      ]) {
        const cell = document.createElement('td');
        cell.textContent = value;
        row.appendChild(cell);
      }
      ui.resultRows.appendChild(row);
    }
    ui.resultGold.textContent = `今回の獲得賞金：${state.pendingBounty} G　／　所持金：${state.gold} G`;
    ui.resultScreen.hidden = false;
    updateTurnInfo();
    ui.phaseLabel.textContent = outcome === 'victory' ? '勝利' : '敗北';
    draw();
  }

  function resetBattle() {
    for (const unit of units) {
      const initial = initialUnits.find((entry) => entry.id === unit.id);
      unit.x = initial.x;
      unit.y = initial.y;
      unit.hp = unit.team === 'ally' ? unit.maxHp : initial.maxHp;
      if (unit.team === 'enemy') {
        unit.maxHp = initial.maxHp;
        unit.attack = initial.attack;
        unit.defense = initial.defense;
      }
      unit.hasActed = false;
      unit.renderX = initial.x;
      unit.renderY = initial.y;
      if (unit.team === 'ally') {
        unit.battleExp = 0;
        unit.battleLevels = 0;
      }
    }

    inventory.healingPotion.count = 3;
    state.round = 1;
    state.activeUnitId = null;
    state.actionMode = null;
    state.battleOver = false;
    state.focusId = null;
    state.animationLock = true;
    state.movementConfirmed = false;
    state.movementOrigin = null;
    state.movementTiles = new Set();
    state.camera = { scale: 1, offsetX: 0, offsetY: 0 };
    state.pendingBounty = 0;
    state.resultShown = false;
    selected = null;
    ui.resultScreen.hidden = true;
    ui.levelUpBanner.hidden = true;
    updateTurnInfo();
    setMessage('戦闘に突入します');
    draw();
    startBattle();
  }

  function getReachableTiles(unit) {
    const visited = new Set([`${unit.x},${unit.y}`]);
    const queue = [{ x: unit.x, y: unit.y, dist: 0 }];
    const reachable = new Set();

    while (queue.length) {
      const current = queue.shift();
      if (current.dist > 0) reachable.add(`${current.x},${current.y}`);
      if (current.dist >= unit.moveRange) continue;

      const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (const [dx, dy] of directions) {
        const nx = current.x + dx;
        const ny = current.y + dy;
        if (!isInBounds(nx, ny)) continue;
        const key = `${nx},${ny}`;
        if (visited.has(key)) continue;
        const occupant = getUnitAt(nx, ny);
        if (occupant && occupant.id !== unit.id) continue;
        visited.add(key);
        queue.push({ x: nx, y: ny, dist: current.dist + 1 });
      }
    }

    return reachable;
  }

  function getAttackTargets(unit) {
    return units.filter((u) => u.hp > 0 && u.team !== unit.team && manhattan(unit, u) === 1);
  }

  function performAttack(attacker, target, onComplete) {
    if (!attacker || !target || attacker.hp <= 0 || target.hp <= 0 || attacker.team === target.team) {
      if (onComplete) onComplete();
      return;
    }
    const damage = Math.max(1, attacker.attack - target.defense + Math.floor(Math.random() * 3));
    target.hp = Math.max(0, target.hp - damage);
    setMessage(`${attacker.name} の攻撃！ ${target.name} に ${damage} ダメージ`);
    if (target.hp <= 0) {
      setMessage(`${target.name} は倒れた`);
      if (target.team === 'enemy') {
        state.pendingBounty += target.bounty;
        const levelUp = grantExperience(attacker, target.expReward);
        setMessage(`${target.name} を倒した！ ${attacker.name} は ${target.expReward} EXPを獲得`);
        draw();
        if (levelUp.levelsGained > 0) {
          showLevelUp(attacker, levelUp, onComplete);
          return;
        }
      }
    }
    draw();
    if (onComplete) onComplete();
  }

  function grantExperience(unit, amount) {
    unit.exp += amount;
    unit.battleExp += amount;
    let levelsGained = 0;
    const before = getLevelUpStats(unit);
    while (unit.exp >= unit.level * 50) {
      unit.level += 1;
      unit.battleLevels += 1;
      unit.maxHp += 5;
      unit.hp = Math.min(unit.maxHp, unit.hp + 5);
      unit.attack += 1;
      unit.defense += 1;
      levelsGained += 1;
    }
    return {
      levelsGained,
      before,
      after: getLevelUpStats(unit)
    };
  }

  function getLevelUpStats(unit) {
    return {
      level: unit.level,
      hp: unit.hp,
      maxHp: unit.maxHp,
      attack: unit.attack,
      defense: unit.defense,
      speed: unit.speed
    };
  }

  function renderLevelUpStats(stats, comparisonStats = null) {
    const rows = [
      ['レベル', 'level'],
      ['HP', 'hp'],
      ['最大HP', 'maxHp'],
      ['攻撃', 'attack'],
      ['防御', 'defense'],
      ['素早さ', 'speed']
    ];
    const list = document.createElement('div');
    list.className = comparisonStats ? 'level-up-stats comparison' : 'level-up-stats';
    if (comparisonStats) {
      const header = document.createElement('div');
      header.className = 'level-up-row level-up-header';
      for (const value of ['項目', '現在', '上昇', '上昇後']) {
        const cell = document.createElement('span');
        cell.textContent = value;
        header.appendChild(cell);
      }
      list.appendChild(header);
    }

    for (const [label, key] of rows) {
      const row = document.createElement('div');
      row.className = 'level-up-row';
      const title = document.createElement('span');
      title.textContent = label;
      row.appendChild(title);
      const current = document.createElement('span');
      current.textContent = String(stats[key]);
      row.appendChild(current);
      if (comparisonStats) {
        const difference = comparisonStats[key] - stats[key];
        const delta = document.createElement('span');
        delta.textContent = `${difference >= 0 ? '+' : ''}${difference}`;
        row.appendChild(delta);
        const updated = document.createElement('span');
        updated.textContent = String(comparisonStats[key]);
        row.appendChild(updated);
      }
      list.appendChild(row);
    }
    ui.levelUpMessage.replaceChildren(list);
  }

  function showLevelUp(unit, levelUp, onComplete) {
    state.levelUpStats = levelUp;
    state.levelUpStage = 1;
    ui.levelUpMessage.textContent = '';
    renderLevelUpStats(levelUp.before);
    ui.levelUpPrompt.textContent = 'タップしてステータス上昇を確認';
    ui.levelUpTitle.textContent = `${unit.name}　レベルアップ！`;
    state.levelUpPending = true;
    state.levelUpCallback = onComplete;
    ui.levelUpBanner.hidden = false;
    ui.levelUpBanner.classList.remove('show');
    requestAnimationFrame(() => ui.levelUpBanner.classList.add('show'));
  }

  function continueAfterLevelUp(event) {
    if (!state.levelUpPending) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    if (state.levelUpStage === 1) {
      renderLevelUpStats(state.levelUpStats.before, state.levelUpStats.after);
      ui.levelUpPrompt.textContent = 'タップして閉じる';
      state.levelUpStage = 2;
      return;
    }

    state.levelUpPending = false;
    state.levelUpStage = 0;
    state.levelUpStats = null;
    ui.levelUpBanner.classList.remove('show');
    ui.levelUpBanner.hidden = true;
    draw();
    const onComplete = state.levelUpCallback;
    state.levelUpCallback = null;
    if (onComplete) onComplete();
  }

  function useHealingPotion(user, target) {
    if (!user || !target || user.hp <= 0 || target.hp <= 0 || target.team !== 'ally') return false;
    if (inventory.healingPotion.count <= 0) {
      setMessage('回復薬を持っていません');
      return false;
    }
    if (target.hp >= target.maxHp) {
      setMessage(`${target.name} のHPは満タンです`);
      return false;
    }

    const restored = Math.min(inventory.healingPotion.healAmount, target.maxHp - target.hp);
    inventory.healingPotion.count -= 1;
    target.hp += restored;
    setMessage(`${user.name} は ${target.name} に回復薬を使った（HP ${restored} 回復）`);
    updateTurnInfo();
    draw();
    return true;
  }

  function chooseBestMoveTile(unit, allies) {
    const reachable = getReachableTiles(unit);
    if (!reachable.size) return null;
    const target = allies[0];
    let best = null;
    for (const cell of reachable) {
      const [x, y] = cell.split(',').map(Number);
      const value = Math.abs(x - target.x) + Math.abs(y - target.y);
      if (!best || value < best.value) {
        best = { x, y, value };
      }
    }
    return best;
  }

  function enemyTakeAction(unit) {
    if (!unit || state.battleOver) return;
    const allies = units.filter((u) => u.hp > 0 && u.team === 'ally');
    if (!allies.length) {
      checkBattleOver();
      return;
    }

    state.animationLock = true;
    updateTurnInfo();
    setMessage(`${unit.name} の一手を待機中...`);
    draw();

    setTimeout(() => {
      const moveTarget = chooseBestMoveTile(unit, allies);
      if (moveTarget) {
        const occupied = getUnitAt(moveTarget.x, moveTarget.y);
        if (!occupied) {
          setMessage(`${unit.name} は ${moveTarget.x},${moveTarget.y} へ移動した`);
          animateUnitMove(unit, moveTarget.x, moveTarget.y, () => {
            const attackTargets = getAttackTargets(unit);
            if (attackTargets.length) {
              const target = attackTargets.sort((a, b) => a.hp - b.hp)[0];
              setTimeout(() => {
                setTimeout(() => {
                  performAttack(unit, target, () => {
                    state.animationLock = false;
                    if (!checkBattleOver()) advanceTurn();
                  });
                }, 180);
              }, 160);
              return;
            }

            setMessage(`${unit.name} は位置を取り直した`);
            state.animationLock = false;
            if (!checkBattleOver()) advanceTurn();
          });
          return;
        }
      }

      const attackTargets = getAttackTargets(unit);
      if (attackTargets.length) {
        const target = attackTargets.sort((a, b) => a.hp - b.hp)[0];
        setTimeout(() => {
          performAttack(unit, target, () => {
            state.animationLock = false;
            if (!checkBattleOver()) advanceTurn();
          });
        }, 180);
        return;
      }

      setMessage(`${unit.name} は待機した`);
      state.animationLock = false;
      updateTurnInfo();
      if (!checkBattleOver()) advanceTurn();
    }, 480);
  }

  function tryMoveActiveUnit(x, y) {
    const active = getActiveUnit();
    if (!active || active.team !== 'ally' || state.movementConfirmed || state.actionMode) return;
    const key = `${x},${y}`;
    if (!state.movementTiles.has(key) && key !== state.movementOrigin) {
      setMessage('その位置には移動できません');
      return;
    }
    const occupied = getUnitAt(x, y);
    if (occupied && occupied.id !== active.id) {
      setMessage('すでにユニットがいます');
      return;
    }
    if (occupied && key !== state.movementOrigin) return;

    state.animationLock = true;
    updateTurnInfo();
    setMessage(`${active.name} の移動位置を変更中...`);
    draw();
    animateUnitMove(active, x, y, () => {
      selected = active.id;
      state.animationLock = false;
      setMessage(`${active.name} の移動位置を設定しました。対象を選ぶか待機するまで変更できます`);
      updateTurnInfo();
      draw();
    });
  }

  function getGridFromPointer(px, py) {
    const camera = getCameraTransform();
    const worldX = (px - camera.offsetX) / camera.scale;
    const worldY = (py - camera.offsetY) / camera.scale;
    let best = null;
    let bestDistance = Infinity;
    for (let x = 0; x < MAP_DATA.width; x += 1) {
      for (let y = 0; y < MAP_DATA.height; y += 1) {
        const points = [
          mapPoint(x, y),
          mapPoint(x + 1, y),
          mapPoint(x + 1, y + 1),
          mapPoint(x, y + 1)
        ];
        if (!isPointInPolygon(worldX, worldY, points)) continue;
        const center = unitPoint(x, y);
        const distance = Math.hypot(worldX - center.x, worldY - center.y);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = { x, y };
        }
      }
    }
    return best;
  }

  function isPointInPolygon(x, y, points) {
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
      const a = points[i];
      const b = points[j];
      const crosses = (a.y > y) !== (b.y > y)
        && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x;
      if (crosses) inside = !inside;
    }
    return inside;
  }

  function handleUnitSelection(unit) {
    if (state.animationLock || state.battleOver) return;
    if (!unit || unit.hp <= 0) return;
    selected = unit.id;

    if (state.actionMode === 'attack') {
      const active = getActiveUnit();
      if (!active || active.team !== 'ally' || unit.team !== 'enemy') {
        setMessage('攻撃する敵のマスを選択してください');
        draw();
        return;
      }
      if (manhattan(active, unit) !== 1) {
        setMessage('攻撃範囲外です');
        draw();
        return;
      }

      state.movementConfirmed = true;
      state.animationLock = true;
      state.actionMode = null;
      updateTurnInfo();
      setTimeout(() => {
        performAttack(active, unit, () => {
          state.animationLock = false;
          updateTurnInfo();
          if (!checkBattleOver()) advanceTurn();
        });
      }, 180);
      draw();
      return;
    }

    if (state.actionMode === 'item') {
      const active = getActiveUnit();
      if (!active || active.team !== 'ally' || unit.team !== 'ally') {
        setMessage('回復する味方のマスを選択してください');
        draw();
        return;
      }
      if (unit.hp >= unit.maxHp) {
        setMessage(`${unit.name} のHPは満タンです`);
        draw();
        return;
      }

      state.movementConfirmed = true;
      state.animationLock = true;
      state.actionMode = null;
      updateTurnInfo();
      if (useHealingPotion(active, unit)) {
        setTimeout(() => {
          state.animationLock = false;
          updateTurnInfo();
          if (!checkBattleOver()) advanceTurn();
        }, 350);
      } else {
        state.animationLock = false;
        updateTurnInfo();
      }
      draw();
      return;
    }

    if (unit.team === 'ally' && unit.id === state.activeUnitId && !state.movementConfirmed && !state.actionMode) {
      setMessage(`${unit.name} のマスです。移動可能マスを選択するか、待機してください`);
      draw();
      return;
    }

    setMessage(`${unit.name} を確認中`);
    draw();
  }

  function pointer(e) {
    if (state.battleOver || state.animationLock) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * W / rect.width;
    const y = (e.clientY - rect.top) * H / rect.height;
    if (y >= 430) return;

    const cell = getGridFromPointer(x, y);
    const active = getActiveUnit();
    if (!cell) return;

    const occupant = getUnitAt(cell.x, cell.y);
    if (occupant) {
      handleUnitSelection(occupant);
      return;
    }

    if (active && active.team === 'ally' && !state.movementConfirmed && !state.actionMode) {
      tryMoveActiveUnit(cell.x, cell.y);
      return;
    }

    if (state.actionMode === 'attack') setMessage('攻撃する敵のマスを選択してください');
    else if (state.actionMode === 'item') setMessage('回復する味方のマスを選択してください');
  }

  function handleButtonClick(mode) {
    const active = getActiveUnit();
    if (!active || active.team !== 'ally' || state.battleOver || state.animationLock) return;
    state.actionMode = state.actionMode === mode ? null : mode;
    if (state.actionMode === 'attack') {
      setMessage(`${active.name} の攻撃対象を選択してください`);
    } else if (state.actionMode === 'item') {
      setMessage('回復する味方を選択してください');
    } else {
      setMessage(`${active.name} の行動を選択してください`);
    }
    updateTurnInfo();
    draw();
  }

  ui.attackBtn.addEventListener('click', () => handleButtonClick('attack'));
  ui.itemBtn.addEventListener('click', () => handleButtonClick('item'));
  ui.waitBtn.addEventListener('click', () => {
    const active = getActiveUnit();
    if (!active || active.team !== 'ally' || state.battleOver || state.animationLock) return;
    state.movementConfirmed = true;
    state.actionMode = null;
    setMessage(`${active.name} は待機した`);
    advanceTurn();
  });
  ui.replayBtn.addEventListener('click', resetBattle);
  document.addEventListener('pointerdown', continueAfterLevelUp, true);
  canvas.addEventListener('pointerdown', pointer);

  for (const unit of units) {
    unit.side = unit.team;
    unit.hasActed = false;
  }

  state.activeUnitId = null;
  state.focusId = null;
  selected = null;
  updateTurnInfo();
  setMessage('戦闘に突入します');
  draw();
  startBattle();
})();