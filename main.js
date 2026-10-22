(() => {
  "use strict";

  const canvas = document.getElementById("battleCanvas");
  const ctx = canvas.getContext("2d");
  const $ = (id) => document.getElementById(id);

  const initialCharacters = [
    { id:"ally1", name:"アレン", role:"前衛 / バランス型", side:"ally", x:1, y:5, hp:30, maxHp:30, attack:10, defense:3, agility:12, move:3, sprite:"剣", color:"#4fc7e5" },
    { id:"ally2", name:"ミナ", role:"斥候 / 俊敏型", side:"ally", x:3, y:6, hp:24, maxHp:24, attack:8, defense:2, agility:15, move:3, sprite:"弓", color:"#8fe0c1" },
    { id:"ally3", name:"ガルド", role:"守護役 / 防御型", side:"ally", x:5, y:5, hp:36, maxHp:36, attack:7, defense:5, agility:8, move:3, sprite:"盾", color:"#e8bd68" },
    { id:"enemy1", name:"ゴブリンA", role:"敵 / 近接型", side:"enemy", x:2, y:1, hp:20, maxHp:20, attack:8, defense:2, agility:10, move:2, sprite:"G", color:"#f17878" },
    { id:"enemy2", name:"ゴブリンB", role:"敵 / 俊敏型", side:"enemy", x:4, y:0, hp:18, maxHp:18, attack:7, defense:1, agility:13, move:3, sprite:"G", color:"#e98e78" },
    { id:"enemy3", name:"オーク", role:"敵 / 重装型", side:"enemy", x:6, y:2, hp:28, maxHp:28, attack:9, defense:3, agility:7, move:2, sprite:"O", color:"#c77e68" }
  ];

  let characters = structuredClone(initialCharacters);
  let selectedId = "ally1";
  const obstacles = [{x:3,y:3},{x:4,y:3},{x:1,y:2},{x:6,y:4}];
  const terrainColors = ["#527e52", "#588655", "#4b784e", "#608c58"];

  function selectedCharacter() {
    return characters.find(c => c.id === selectedId) || characters[0];
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.floor(rect.width * dpr));
    const height = Math.max(1, Math.floor(rect.width * 1.08 * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    drawMap();
  }

  function isoPoint(x, y) {
    const w = canvas.width;
    const h = canvas.height;
    const tileW = w / 9.3;
    const tileH = tileW * 0.52;
    const originX = w * 0.5;
    const originY = h * 0.10;
    return {
      x: originX + (x - y) * tileW * 0.5,
      y: originY + (x + y) * tileH * 0.5,
      tileW, tileH
    };
  }

  function polygon(points, fill, stroke, lineWidth = 1) {
    ctx.beginPath();
    points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke(); }
  }

  function drawTile(x, y, color) {
    const p = isoPoint(x, y);
    const hw = p.tileW / 2;
    const hh = p.tileH / 2;
    polygon([
      {x:p.x,y:p.y-hh},{x:p.x+hw,y:p.y},
      {x:p.x,y:p.y+hh},{x:p.x-hw,y:p.y}
    ], color, "#294c3c", Math.max(1, canvas.width / 500));
    // small pixel flecks
    ctx.fillStyle = "rgba(220,235,153,.18)";
    ctx.fillRect(p.x - p.tileW * .12, p.y - 1, Math.max(1,p.tileW*.035), Math.max(1,p.tileH*.07));
  }

  function drawObstacle(x, y) {
    const p = isoPoint(x, y);
    const s = p.tileW * .25;
    polygon([
      {x:p.x-s,y:p.y-p.tileH*.05},
      {x:p.x-s,y:p.y-p.tileH*.55},
      {x:p.x,y:p.y-p.tileH*.78},
      {x:p.x+s,y:p.y-p.tileH*.55},
      {x:p.x+s,y:p.y-p.tileH*.05},
      {x:p.x,y:p.y+p.tileH*.18}
    ], "#6b7764", "#283c35", 2);
    polygon([
      {x:p.x-s,y:p.y-p.tileH*.55},
      {x:p.x,y:p.y-p.tileH*.78},
      {x:p.x+s,y:p.y-p.tileH*.55},
      {x:p.x,y:p.y-p.tileH*.31}
    ], "#a5ad7b", "#344b3b", 1);
  }

  function drawCharacter(c) {
    const p = isoPoint(c.x, c.y);
    const size = p.tileW * .26;
    const isSelected = c.id === selectedId;
    // shadow
    ctx.fillStyle = "rgba(12,20,15,.35)";
    ctx.fillRect(p.x-size*.75, p.y-size*.02, size*1.5, size*.45);
    if (isSelected) {
      ctx.strokeStyle = "#ffe18a";
      ctx.lineWidth = Math.max(2, canvas.width / 180);
      ctx.beginPath();
      ctx.ellipse(p.x, p.y - size*.04, size*1.15, size*.52, 0, 0, Math.PI*2);
      ctx.stroke();
    }
    // pixel body and head
    ctx.fillStyle = "#18242a";
    ctx.fillRect(p.x-size*.52, p.y-size*.86, size*1.04, size*1.4);
    ctx.fillStyle = c.color;
    ctx.fillRect(p.x-size*.42, p.y-size*.8, size*.84, size*.82);
    ctx.fillStyle = c.side === "ally" ? "#f5d9a3" : "#d9b79a";
    ctx.fillRect(p.x-size*.3, p.y-size*1.13, size*.6, size*.48);
    ctx.fillStyle = "#26313a";
    ctx.fillRect(p.x-size*.2, p.y-size*.98, size*.12, size*.1);
    ctx.fillRect(p.x+size*.08, p.y-size*.98, size*.12, size*.1);
    // belt and boots
    ctx.fillStyle = "#493c35";
    ctx.fillRect(p.x-size*.42, p.y-size*.05, size*.84, size*.16);
    ctx.fillStyle = "#1b2930";
    ctx.fillRect(p.x-size*.38, p.y+size*.34, size*.3, size*.18);
    ctx.fillRect(p.x+size*.08, p.y+size*.34, size*.3, size*.18);
    // team marker
    ctx.fillStyle = c.side === "ally" ? "#7ee8ff" : "#ff8b8b";
    ctx.fillRect(p.x-size*.18, p.y-size*1.32, size*.36, size*.12);
    // HP pips
    const barW = size*1.45;
    ctx.fillStyle = "#17211d";
    ctx.fillRect(p.x-barW/2, p.y+size*.62, barW, Math.max(3,size*.13));
    ctx.fillStyle = c.side === "ally" ? "#68df8b" : "#ff7979";
    ctx.fillRect(p.x-barW/2, p.y+size*.62, barW*(c.hp/c.maxHp), Math.max(3,size*.13));
    // name plaque
    ctx.font = `${Math.max(8, canvas.width*.021)}px monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const label = c.name;
    const labelW = ctx.measureText(label).width + 8;
    ctx.fillStyle = "rgba(12,24,27,.88)";
    ctx.fillRect(p.x-labelW/2, p.y+size*.82, labelW, Math.max(12,size*.38));
    ctx.fillStyle = "#f7f5df";
    ctx.fillText(label, p.x, p.y+size*.82 + Math.max(6,size*.19));
  }

  function drawMap() {
    if (!ctx || !canvas.width || !canvas.height) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#213b32";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Background pixel pattern
    for (let i=0; i<80; i++) {
      const x = (i*73) % canvas.width;
      const y = (i*47) % canvas.height;
      ctx.fillStyle = i%2 ? "rgba(174,206,112,.07)" : "rgba(8,25,20,.10)";
      ctx.fillRect(x, y, Math.max(2,canvas.width*.009), Math.max(2,canvas.width*.009));
    }

    for (let sum=0; sum<=14; sum++) {
      for (let x=0; x<8; x++) {
        const y = sum-x;
        if (y < 0 || y >= 8) continue;
        const variation = (x*3+y*5)%terrainColors.length;
        drawTile(x, y, terrainColors[variation]);
      }
    }
    obstacles.forEach(o => drawObstacle(o.x,o.y));
    [...characters].sort((a,b)=>(a.x+a.y)-(b.x+b.y)).forEach(drawCharacter);

    // compass decoration
    ctx.fillStyle = "#d9e6c4";
    ctx.font = `${Math.max(9,canvas.width*.025)}px monospace`;
    ctx.textAlign = "right";
    ctx.fillText("N ▲", canvas.width-10, 18);
  }

  function renderTurnOrder() {
    const order = [...characters].sort((a,b)=>b.agility-a.agility || a.id.localeCompare(b.id));
    $("turnOrder").innerHTML = "";
    order.forEach(c => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `turn-token ${c.side} ${c.id===selectedId ? "selected" : ""}`;
      button.innerHTML = `<span class="token-sprite">${escapeHtml(c.sprite)}</span><span class="token-name">${escapeHtml(c.name.replace("ゴブリン","G"))}</span>`;
      button.addEventListener("click", () => selectCharacter(c.id));
      $("turnOrder").appendChild(button);
    });
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, ch => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    })[ch]);
  }

  function updateStatus() {
    const c = selectedCharacter();
    $("characterName").textContent = c.name;
    $("characterRole").textContent = c.role;
    $("portrait").textContent = c.sprite;
    $("sideLabel").textContent = c.side === "ally" ? "味方" : "敵";
    $("sideLabel").className = `side-label ${c.side}`;
    $("hpText").textContent = `HP ${c.hp} / ${c.maxHp}`;
    $("hpBar").style.width = `${Math.max(0, c.hp/c.maxHp*100)}%`;
    $("hpBar").style.background = c.hp/c.maxHp < .3 ? "#ff7777" : "#69d28a";
    $("attackStat").textContent = c.attack;
    $("defenseStat").textContent = c.defense;
    $("agilityStat").textContent = c.agility;
    $("moveStat").textContent = c.move;
  }

  function selectCharacter(id) {
    selectedId = id;
    const c = selectedCharacter();
    $("battleLog").textContent = `${c.name}を選択中。移動・攻撃は次の実装段階で追加します。`;
    renderTurnOrder();
    updateStatus();
    drawMap();
  }

  function canvasPointFromEvent(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * canvas.width / rect.width,
      y: (event.clientY - rect.top) * canvas.height / rect.height
    };
  }

  function handleMapTap(event) {
    const point = canvasPointFromEvent(event);
    let nearest = null;
    let nearestDistance = Infinity;
    characters.forEach(c => {
      const p = isoPoint(c.x,c.y);
      const distance = Math.hypot(point.x-p.x, point.y-(p.y-p.tileH*.25));
      if (distance < p.tileW*.42 && distance < nearestDistance) {
        nearest = c;
        nearestDistance = distance;
      }
    });
    if (nearest) selectCharacter(nearest.id);
  }

  function resetPrototype() {
    characters = structuredClone(initialCharacters);
    selectedId = "ally1";
    $("battleLog").textContent = "訓練場に味方と敵が現れた。";
    renderTurnOrder();
    updateStatus();
    drawMap();
  }

  canvas.addEventListener("pointerup", handleMapTap);
  $("resetButton").addEventListener("click", resetPrototype);
  window.addEventListener("resize", resizeCanvas);

  renderTurnOrder();
  updateStatus();
  resizeCanvas();
})();
