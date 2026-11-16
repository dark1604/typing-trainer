(() => {
  const DANGER_Y = 56;
  const STONE_HEIGHT = 36;
  const COLUMNS = 5;

  function getWellHeight() {
    return el.well.clientHeight || 460;
  }

  const DATA = {
    ua: {
      letters: "абвгдеєжзиіїйклмнопрстуфхцчшщьюя".split(""),
      words: window.KEYRIS_WORDS_UA || ["код", "байт", "екран", "алгоритм", "програма"],
      keyboard: [
        ["й", "ц", "у", "к", "е", "н", "г", "ш", "щ", "з", "х", "ї"],
        ["ф", "і", "в", "а", "п", "р", "о", "л", "д", "ж", "є"],
        ["я", "ч", "с", "м", "и", "т", "ь", "б", "ю", "."]
      ]
    },
    en: {
      letters: "abcdefghijklmnopqrstuvwxyz".split(""),
      words: [
        "code", "byte", "pixel", "mouse", "cloud", "array", "logic", "robot",
        "cyber", "laser", "stack", "queue", "frame", "input", "click", "debug",
        "script", "server", "python", "screen", "window", "memory", "signal",
        "binary", "glitch", "stream", "socket", "planet", "sprint", "vector",
        "raster", "sprite", "canvas", "router", "domain", "backup", "button",
        "cursor", "border", "margin", "header", "footer", "browser", "network",
        "hardware", "software", "database", "password", "firewall", "phishing",
        "algorithm", "variable", "function", "template", "keyboard", "monitor",
        "scanner", "printer", "storage", "display", "folder", "format"
      ],
      keyboard: [
        ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
        ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
        ["z", "x", "c", "v", "b", "n", "m", "."]
      ]
    },
    code: [
      "print()", "for i in", "if x > 0:", "return", "def run():", "let x = 1",
      "const id", "import", "while", "else:", "true", "false", "<div>",
      "</div>", "class=", "href=", "flex", "grid", "async", "await",
      "array[]", "len(s)", "range(5)", "input()", "color:", "margin:"
    ]
  };

  // State
  const state = {
    mode: "letters", // letters | words | code | test
    lang: "ua",      // ua | en
    running: false,
    paused: false,
    showKeyboard: true,
    soundOn: true,
    score: 0,
    highScore: 0,
    level: 1,
    destroyed: 0,
    combo: 0,
    hits: 0,
    errors: 0,
    trapKeys: {},
    startTime: 0,
    pausedAccum: 0,
    pauseStarted: 0,
    frozenUntil: 0,
    testTimeLeft: 60,
    spawnTimer: 0,
    lastFrame: 0,
    falling: [],
    lockedId: null,
    columns: Array.from({ length: COLUMNS }, () => [])
  };

  function loadHighScore() {
    state.highScore = Number(localStorage.getItem(`keyris_highscore_${state.mode}`) || 0);
  }

  // DOM Elements
  const el = {
    well: document.getElementById("tetrisWell"),
    fallingLayer: document.getElementById("fallingLayer"),
    settledLayer: document.getElementById("settledLayer"),
    particlesLayer: document.getElementById("particlesLayer"),
    overlay: document.getElementById("wellOverlay"),
    startScreen: document.getElementById("startScreen"),
    pauseScreen: document.getElementById("pauseScreen"),
    gameOverScreen: document.getElementById("gameOverScreen"),
    freezeBanner: document.getElementById("freezeBanner"),
    layoutAlert: document.getElementById("layoutAlert"),
    layoutAlertText: document.getElementById("layoutAlertText"),
    capsAlert: document.getElementById("capsAlert"),
    testTimerBadge: document.getElementById("testTimerBadge"),
    levelValue: document.getElementById("levelValue"),
    levelHint: document.getElementById("levelHint"),
    speedMult: document.getElementById("speedMult"),
    levelProgress: document.getElementById("levelProgress"),
    comboValue: document.getElementById("comboValue"),
    multiplierValue: document.getElementById("multiplierValue"),
    comboProgress: document.getElementById("comboProgress"),
    speedValue: document.getElementById("speedValue"),
    wpmSub: document.getElementById("wpmSub"),
    accuracyValue: document.getElementById("accuracyValue"),
    hitsValue: document.getElementById("hitsValue"),
    errorsSub: document.getElementById("errorsSub"),
    scoreValue: document.getElementById("scoreValue"),
    highScoreValue: document.getElementById("highScoreValue"),
    finalRank: document.getElementById("finalRank"),
    finalTitle: document.getElementById("finalTitle"),
    speedLevelPill: document.getElementById("speedLevelPill"),
    speedLevelDesc: document.getElementById("speedLevelDesc"),
    finalScore: document.getElementById("finalScore"),
    finalSpeed: document.getElementById("finalSpeed"),
    finalAccuracy: document.getElementById("finalAccuracy"),
    trapKeysBox: document.getElementById("trapKeysBox"),
    trapKeysList: document.getElementById("trapKeysList"),
    keyboardSection: document.getElementById("keyboardSection"),
    virtualKeyboard: document.getElementById("virtualKeyboard"),
    startBtn: document.getElementById("startBtn"),
    resumeBtn: document.getElementById("resumeBtn"),
    restartBtn: document.getElementById("restartBtn"),
    pauseBtn: document.getElementById("pauseBtn"),
    toggleKeyboardBtn: document.getElementById("toggleKeyboardBtn"),
    toggleSoundBtn: document.getElementById("toggleSoundBtn"),
    soundIcon: document.getElementById("soundIcon"),
    toggleThemeBtn: document.getElementById("toggleThemeBtn"),
    themeIcon: document.getElementById("themeIcon"),
    deviceBlocker: document.getElementById("deviceBlocker")
  };

  // Web Audio Synthesizer
  let audioCtx = null;
  function playTone(freq, duration, type = "sine", gainVal = 0.06) {
    if (!state.soundOn) return;
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      audioCtx = new Ctx();
    }
    if (audioCtx.state === "suspended") audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(gainVal, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  }

  function sfxHit() { playTone(520 + Math.random() * 80, 0.05, "triangle", 0.05); }
  function sfxDestroy() {
    playTone(660, 0.07, "sine", 0.07);
    setTimeout(() => playTone(880, 0.09, "sine", 0.06), 45);
  }
  function sfxError() { playTone(160, 0.11, "sawtooth", 0.05); }
  function sfxLand() { playTone(110, 0.12, "square", 0.04); }
  function sfxFreeze() {
    playTone(980, 0.12, "sine", 0.06);
    setTimeout(() => playTone(1320, 0.18, "sine", 0.06), 70);
  }
  function sfxBurn() {
    playTone(440, 0.08, "triangle", 0.08);
    setTimeout(() => playTone(660, 0.1, "triangle", 0.08), 60);
    setTimeout(() => playTone(990, 0.16, "triangle", 0.08), 120);
  }

  // Helpers
  function effectiveLang() {
    return state.mode === "code" ? "en" : state.lang;
  }

  function getFingerZone(rowIdx, colIdx) {
    if (colIdx === 0 || colIdx >= 9) return "f-pinky";
    if (colIdx === 1 || colIdx === 8) return "f-ring";
    if (colIdx === 2 || colIdx === 7) return "f-middle";
    if (colIdx === 3 || colIdx === 4) return "f-index-l";
    return "f-index-r";
  }

  function renderKeyboard() {
    const lang = effectiveLang();
    const rows = DATA[lang].keyboard;
    el.virtualKeyboard.innerHTML = "";
    rows.forEach((row, rIdx) => {
      const rowEl = document.createElement("div");
      rowEl.className = "kb-row";
      row.forEach((ch, cIdx) => {
        const keyEl = document.createElement("div");
        keyEl.className = `kb-key ${getFingerZone(rIdx, cIdx)}`;
        keyEl.dataset.key = ch;
        keyEl.textContent = ch.toUpperCase();
        rowEl.appendChild(keyEl);
      });
      el.virtualKeyboard.appendChild(rowEl);
    });
    if (state.mode === "code") {
      const spaceRow = document.createElement("div");
      spaceRow.className = "kb-row";
      const sp = document.createElement("div");
      sp.className = "kb-key space f-thumb";
      sp.dataset.key = " ";
      sp.textContent = "ПРОБІЛ";
      spaceRow.appendChild(sp);
      el.virtualKeyboard.appendChild(spaceRow);
    }

    const legend = document.createElement("div");
    legend.className = "kb-legend";
    legend.innerHTML = `
      <span class="kb-legend-item"><span class="kb-swatch" style="background:#f43f5e"></span>Мізинець</span>
      <span class="kb-legend-item"><span class="kb-swatch" style="background:#f59e0b"></span>Безіменний</span>
      <span class="kb-legend-item"><span class="kb-swatch" style="background:#10b981"></span>Середній</span>
      <span class="kb-legend-item"><span class="kb-swatch" style="background:#0ea5e9"></span>Лівий вказівний</span>
      <span class="kb-legend-item"><span class="kb-swatch" style="background:#8b5cf6"></span>Правий вказівний</span>
    `;
    el.virtualKeyboard.appendChild(legend);
    updateTargetKeyHighlight();
  }

  function updateTargetKeyHighlight() {
    if (!state.showKeyboard) return;
    el.virtualKeyboard.querySelectorAll(".kb-key.target-key").forEach((k) => k.classList.remove("target-key"));
    let target = state.falling.find((b) => b.id === state.lockedId);
    if (!target && state.falling.length > 0) {
      target = [...state.falling].sort((a, b) => b.y - a.y)[0];
    }
    if (!target) return;
    const nextChar = target.text[target.matched].toLowerCase();
    const keyEl = el.virtualKeyboard.querySelector(`.kb-key[data-key="${CSS.escape(nextChar)}"]`);
    if (keyEl) keyEl.classList.add("target-key");
  }

  function flashVirtualKey(ch, ok) {
    if (!state.showKeyboard) return;
    const keyEl = el.virtualKeyboard.querySelector(`.kb-key[data-key="${CSS.escape(ch.toLowerCase())}"]`);
    if (!keyEl) return;
    const cls = ok ? "pressed-ok" : "pressed-err";
    keyEl.classList.add(cls);
    setTimeout(() => keyEl.classList.remove(cls), 140);
  }

  function spawnParticles(x, y, color) {
    for (let i = 0; i < 10; i++) {
      const p = document.createElement("div");
      p.className = "particle";
      p.style.left = `${x}px`;
      p.style.top = `${y}px`;
      p.style.background = color;
      const angle = Math.random() * Math.PI * 2;
      const dist = 24 + Math.random() * 44;
      p.style.setProperty("--tx", `${Math.cos(angle) * dist}px`);
      p.style.setProperty("--ty", `${Math.sin(angle) * dist}px`);
      el.particlesLayer.appendChild(p);
      setTimeout(() => p.remove(), 550);
    }
  }

  function pickText() {
    if (state.mode === "code") {
      return DATA.code[Math.floor(Math.random() * DATA.code.length)];
    }
    const poolKey = state.mode === "test" ? "words" : state.mode;
    const pool = DATA[state.lang][poolKey];
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function spawnBlock() {
    const text = pickText();
    const freeCols = [];
    for (let c = 0; c < COLUMNS; c++) {
      const hasTop = state.falling.some((b) => b.col === c && b.y < 64);
      if (!hasTop) freeCols.push(c);
    }
    const colPool = freeCols.length > 0 ? freeCols : [0, 1, 2, 3, 4];
    const col = colPool[Math.floor(Math.random() * colPool.length)];
    const wellWidth = el.well.clientWidth || 480;
    const colWidth = wellWidth / COLUMNS;

    let type = "normal";
    if (state.mode !== "test") {
      const roll = Math.random();
      if (roll < 0.1) type = "freeze";
      else if (roll < 0.22) type = "fast";
    }

    const id = `${Date.now()}-${Math.random()}`;
    const node = document.createElement("div");
    node.className = `falling-block type-${type}`;
    el.fallingLayer.appendChild(node);

    const block = {
      id,
      text,
      matched: 0,
      col,
      x: 0,
      y: -40,
      type,
      node
    };

    renderBlockText(block);
    const w = node.offsetWidth || 64;
    const centerX = col * colWidth + colWidth / 2 - w / 2;
    block.x = Math.max(8, Math.min(wellWidth - w - 8, centerX));
    node.style.left = `${block.x}px`;
    node.style.top = `${block.y}px`;

    state.falling.push(block);
    updateTargetKeyHighlight();
  }

  function renderBlockText(block) {
    const done = block.text.slice(0, block.matched);
    const next = block.text[block.matched] || "";
    const rest = block.text.slice(block.matched + 1);
    const prefixIcon = block.type === "freeze" ? "❄️ " : block.type === "fast" ? "⚡ " : "";
    block.node.innerHTML =
      `${prefixIcon}<span class="char-done">${escapeHtml(done)}</span>` +
      `<span class="char-next">${escapeHtml(next)}</span>` +
      `<span>${escapeHtml(rest)}</span>`;
    block.node.classList.toggle("locked", block.id === state.lockedId);
  }

  function escapeHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function getColumnTopY(col) {
    return getWellHeight() - state.columns[col].length * STONE_HEIGHT;
  }

  function reflowArena() {
    const wellWidth = el.well.clientWidth || 480;
    const wellHeight = getWellHeight();
    const colWidth = wellWidth / COLUMNS;

    state.columns.forEach((colArr, colIdx) => {
      colArr.forEach((item, idx) => {
        item.el.style.width = `${colWidth - 8}px`;
        item.el.style.left = `${colIdx * colWidth + 4}px`;
        item.el.style.top = `${wellHeight - (idx + 1) * STONE_HEIGHT}px`;
      });
    });

    state.falling.forEach((b) => {
      const w = b.node.offsetWidth || 64;
      const centerX = b.col * colWidth + colWidth / 2 - w / 2;
      b.x = Math.max(8, Math.min(wellWidth - w - 8, centerX));
      b.node.style.left = `${b.x}px`;
    });
  }

  function isUnsupportedDevice() {
    const ua = navigator.userAgent || "";
    const isMobileOrTabletUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Tablet/i.test(ua);
    const isIpadOS = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
    const isCoarsePointer = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
    const isNarrowScreen = window.innerWidth < 860;
    return isMobileOrTabletUA || isIpadOS || isCoarsePointer || isNarrowScreen;
  }

  function checkDeviceSupport() {
    const blocked = isUnsupportedDevice();
    el.deviceBlocker.classList.toggle("hidden", !blocked);
    if (blocked && state.running && !state.paused) {
      togglePause();
    }
  }

  function settleBlock(block) {
    sfxLand();
    block.node.remove();
    if (state.lockedId === block.id) state.lockedId = null;

    const wellWidth = el.well.clientWidth || 480;
    const colWidth = wellWidth / COLUMNS;
    const stone = document.createElement("div");
    stone.className = "stone-block";
    stone.textContent = block.text;
    stone.style.width = `${colWidth - 8}px`;
    stone.style.left = `${block.col * colWidth + 4}px`;

    state.columns[block.col].push({ el: stone, text: block.text });
    const y = getColumnTopY(block.col);
    stone.style.top = `${y}px`;
    el.settledLayer.appendChild(stone);

    state.combo = 0;
    updateHUD();

    if (y <= DANGER_Y) {
      endGame();
    }
  }

  function burnBottomRow() {
    let anyRemoved = false;
    state.columns.forEach((colArr, colIdx) => {
      if (colArr.length > 0) {
        anyRemoved = true;
        const bottom = colArr.shift();
        bottom.el.classList.add("burning");
        setTimeout(() => bottom.el.remove(), 300);
        // Shift remaining stones down
        const wellHeight = getWellHeight();
        colArr.forEach((item, idx) => {
          item.el.style.top = `${wellHeight - (idx + 1) * STONE_HEIGHT}px`;
        });
      }
    });
    if (anyRemoved) sfxBurn();
  }

  function destroyBlock(block) {
    const color =
      block.type === "freeze" ? "#f59e0b" : block.type === "fast" ? "#f43f5e" : "#38bdf8";
    spawnParticles(block.x + block.node.offsetWidth / 2, block.y + 18, color);
    block.node.remove();
    state.falling = state.falling.filter((b) => b.id !== block.id);
    if (state.lockedId === block.id) state.lockedId = null;

    state.destroyed += 1;
    state.combo += 1;
    const mult = 1 + Math.floor(state.combo / 5);
    const typeBonus = block.type === "fast" ? 2 : 1;
    state.score += block.text.length * 10 * mult * typeBonus;

    if (block.type === "freeze") {
      state.frozenUntil = performance.now() + 4000;
      sfxFreeze();
    } else {
      sfxDestroy();
    }

    if (state.combo > 0 && state.combo % 10 === 0) {
      burnBottomRow();
    }

    const levelStep = state.mode === "test" ? 5 : 10;
    state.level = 1 + Math.floor(state.destroyed / levelStep);
    if (state.score > state.highScore) {
      state.highScore = state.score;
      localStorage.setItem(`keyris_highscore_${state.mode}`, String(state.highScore));
    }

    updateHUD();
    updateTargetKeyHighlight();
  }

  function checkWrongLayout(ch) {
    const lang = effectiveLang();
    const isLatin = /^[a-z]$/i.test(ch);
    const isCyrillic = /^[а-яіїєґ]$/i.test(ch);
    if (lang === "ua" && isLatin) {
      el.layoutAlertText.textContent = "Увімкни українську розкладку (UA)";
      el.layoutAlert.classList.remove("hidden");
    } else if (lang === "en" && isCyrillic) {
      el.layoutAlertText.textContent = "Switch keyboard layout to English (EN)";
      el.layoutAlert.classList.remove("hidden");
    } else {
      el.layoutAlert.classList.add("hidden");
    }
  }

  function handleKeyInput(key) {
    if (!state.running || state.paused) return;
    if (key.length !== 1) return;

    checkWrongLayout(key);
    const ch = key.toLowerCase();

    // Find target block
    let target = state.falling.find((b) => b.id === state.lockedId);
    if (!target) {
      const candidates = state.falling
        .filter((b) => b.text[0].toLowerCase() === ch)
        .sort((a, b) => b.y - a.y);
      if (candidates.length > 0) {
        target = candidates[0];
        state.lockedId = target.id;
      }
    }

    if (target && target.text[target.matched].toLowerCase() === ch) {
      state.hits += 1;
      target.matched += 1;
      flashVirtualKey(ch, true);
      if (target.matched >= target.text.length) {
        destroyBlock(target);
      } else {
        sfxHit();
        renderBlockText(target);
        updateHUD();
        updateTargetKeyHighlight();
      }
    } else {
      state.errors += 1;
      state.combo = 0;
      if (target) {
        const expected = target.text[target.matched].toLowerCase();
        state.trapKeys[expected] = (state.trapKeys[expected] || 0) + 1;
      }
      sfxError();
      flashVirtualKey(ch, false);
      el.well.classList.remove("error-flash");
      void el.well.offsetWidth;
      el.well.classList.add("error-flash");
      updateHUD();
    }
  }

  function updateHUD() {
    const levelStep = state.mode === "test" ? 5 : 10;
    el.levelValue.textContent = state.level;
    const speedFactor = (1 + (state.level - 1) * 0.16).toFixed(1);
    el.speedMult.textContent = `${speedFactor}x`;
    el.levelProgress.style.width = `${((state.destroyed % levelStep) / levelStep) * 100}%`;
    el.levelHint.textContent = `Кожні ${levelStep} блоків прискорюють падіння`;

    const comboMod = state.combo % 10;
    const displayCombo = state.combo > 0 && comboMod === 0 ? 10 : comboMod;
    el.comboValue.innerHTML = `${displayCombo}<span class="muted">/10</span>`;
    el.comboProgress.style.width = `${displayCombo * 10}%`;
    el.multiplierValue.textContent = 1 + Math.floor(state.combo / 5);

    el.scoreValue.textContent = state.score.toLocaleString("uk-UA");
    el.highScoreValue.textContent = state.highScore.toLocaleString("uk-UA");

    const total = state.hits + state.errors;
    const acc = total === 0 ? 100 : Math.round((state.hits / total) * 100);
    el.accuracyValue.textContent = `${acc}%`;
    el.hitsValue.textContent = `${state.hits} ударів`;
    el.errorsSub.textContent = `Помилок: ${state.errors}`;

    const elapsedMin = Math.max(
      0.05,
      (performance.now() - state.startTime - state.pausedAccum) / 60000
    );
    const cpm = state.running ? Math.round(state.hits / elapsedMin) : 0;
    el.speedValue.textContent = cpm;
    el.wpmSub.textContent = `${Math.round(cpm / 5)} WPM`;

    if (state.mode === "test") {
      el.testTimerBadge.classList.remove("hidden");
      const sec = Math.max(0, Math.ceil(state.testTimeLeft));
      const mm = String(Math.floor(sec / 60)).padStart(2, "0");
      const ss = String(sec % 60).padStart(2, "0");
      el.testTimerBadge.textContent = `⏱ ${mm}:${ss}`;
    } else {
      el.testTimerBadge.classList.add("hidden");
    }
  }

  function gameLoop(now) {
    if (!state.running) return;
    if (state.paused) {
      state.lastFrame = now;
      requestAnimationFrame(gameLoop);
      return;
    }

    const dt = Math.min(0.05, (now - state.lastFrame) / 1000);
    state.lastFrame = now;

    if (state.mode === "test") {
      state.testTimeLeft -= dt;
      if (state.testTimeLeft <= 0) {
        state.testTimeLeft = 0;
        updateHUD();
        endGame(true);
        return;
      }
    }

    const isFrozen = now < state.frozenUntil;
    el.well.classList.toggle("frozen", isFrozen);
    el.freezeBanner.classList.toggle("hidden", !isFrozen);

    if (!isFrozen) {
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0) {
        spawnBlock();
        const baseInterval = state.mode === "letters" ? 1.45 : 2.3;
        state.spawnTimer = Math.max(0.75, baseInterval - (state.level - 1) * 0.14);
      }

      const baseSpeed = 42 + (state.level - 1) * 9;
      for (let i = state.falling.length - 1; i >= 0; i--) {
        const b = state.falling[i];
        const mult = b.type === "fast" ? 1.55 : 1;
        b.y += baseSpeed * mult * dt;
        b.node.style.top = `${b.y}px`;

        const limitY = getColumnTopY(b.col) - 38;
        if (b.y >= limitY) {
          state.falling.splice(i, 1);
          settleBlock(b);
          if (!state.running) return;
        }
      }
    }

    updateHUD();
    requestAnimationFrame(gameLoop);
  }

  function resetGame() {
    state.falling.forEach((b) => b.node.remove());
    state.falling = [];
    state.columns = Array.from({ length: COLUMNS }, () => []);
    el.settledLayer.innerHTML = "";
    el.particlesLayer.innerHTML = "";
    el.layoutAlert.classList.add("hidden");

    state.score = 0;
    state.level = 1;
    state.destroyed = 0;
    state.combo = 0;
    state.hits = 0;
    state.errors = 0;
    state.trapKeys = {};
    state.lockedId = null;
    state.frozenUntil = 0;
    state.testTimeLeft = 60;
    state.paused = false;
    state.pausedAccum = 0;
    state.startTime = performance.now();
    state.lastFrame = performance.now();
    state.spawnTimer = 0.25;
  }

  function startGame() {
    resetGame();
    state.running = true;
    el.overlay.classList.add("hidden");
    el.startScreen.classList.add("hidden");
    el.pauseScreen.classList.add("hidden");
    el.gameOverScreen.classList.add("hidden");
    updateHUD();
    requestAnimationFrame(gameLoop);
  }

  function togglePause() {
    if (!state.running) return;
    state.paused = !state.paused;
    if (state.paused) {
      state.pauseStarted = performance.now();
      el.overlay.classList.remove("hidden");
      el.pauseScreen.classList.remove("hidden");
    } else {
      state.pausedAccum += performance.now() - state.pauseStarted;
      el.overlay.classList.add("hidden");
      el.pauseScreen.classList.add("hidden");
    }
  }

  function getSpeedVerdict(cpm) {
    if (cpm >= 220) {
      return {
        label: "🏆 Кібер-майстер (220+ зн/хв)",
        desc: "Професійний рівень швидкості та впевненого сліпого друку!"
      };
    }
    if (cpm >= 150) {
      return {
        label: "🚀 Швидкий друкар (150–219 зн/хв)",
        desc: "Крутий результат! Друкуєш швидше за більшість однолітків."
      };
    }
    if (cpm >= 80) {
      return {
        label: "⚡ Упевнений користувач (80–149 зн/хв)",
        desc: "Хороший шкільний темп! Наступна мета — 150+ зн/хв."
      };
    }
    return {
      label: "🐢 Новачок (до 80 зн/хв)",
      desc: "Початковий рівень. Потренуйся з кольоровими зонами пальців у режимі «Літери»!"
    };
  }

  function endGame(isTestFinished = false) {
    state.running = false;
    el.overlay.classList.remove("hidden");
    el.gameOverScreen.classList.remove("hidden");

    const total = state.hits + state.errors;
    const acc = total === 0 ? 100 : Math.round((state.hits / total) * 100);
    const elapsedMin = Math.max(
      0.05,
      (performance.now() - state.startTime - state.pausedAccum) / 60000
    );
    const cpm = Math.round(state.hits / elapsedMin);

    let rank = "C";
    if (state.mode === "test" && isTestFinished) {
      if (cpm >= 220 && acc >= 92) rank = "S";
      else if (cpm >= 150 && acc >= 88) rank = "A";
      else if (cpm >= 80) rank = "B";
      el.finalTitle.textContent = "Тест швидкості завершено!";
      const verdict = getSpeedVerdict(cpm);
      el.speedLevelPill.textContent = verdict.label;
      el.speedLevelDesc.textContent = verdict.desc;
      el.speedLevelPill.classList.remove("hidden");
      el.speedLevelDesc.classList.remove("hidden");
    } else {
      if (state.score >= 2500 && acc >= 92) rank = "S";
      else if (state.score >= 1200 && acc >= 85) rank = "A";
      else if (state.score >= 500) rank = "B";
      el.finalTitle.textContent = "Гру завершено!";
      el.speedLevelPill.classList.add("hidden");
      el.speedLevelDesc.classList.add("hidden");
    }

    el.finalRank.textContent = rank;
    el.finalScore.textContent = state.score.toLocaleString("uk-UA");
    el.finalSpeed.textContent = `${cpm} зн/хв`;
    el.finalAccuracy.textContent = `${acc}%`;

    const sortedTraps = Object.entries(state.trapKeys)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    if (sortedTraps.length > 0) {
      el.trapKeysBox.classList.remove("hidden");
      el.trapKeysList.innerHTML = sortedTraps
        .map(([k]) => `<span class="trap-key">${escapeHtml(k.toUpperCase())}</span>`)
        .join("");
    } else {
      el.trapKeysBox.classList.add("hidden");
    }
  }

  // Event Listeners
  function updateCapsLockState(e) {
    if (typeof e.getModifierState === "function") {
      const caps = e.getModifierState("CapsLock");
      el.capsAlert.classList.toggle("hidden", !caps);
    }
  }

  document.addEventListener("keyup", updateCapsLockState);

  document.addEventListener("keydown", (e) => {
    updateCapsLockState(e);
    if (e.key === "Escape" && state.running) {
      e.preventDefault();
      togglePause();
      return;
    }
    if (e.key === "Enter" && !state.running) {
      e.preventDefault();
      startGame();
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (state.running && !state.paused && e.key.length === 1) {
      if (e.key === " ") e.preventDefault();
      handleKeyInput(e.key);
    }
  });

  document.querySelectorAll("[data-mode]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-mode]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.mode = btn.dataset.mode;
      loadHighScore();
      renderKeyboard();
      if (state.running) startGame();
      else updateHUD();
    });
  });

  document.querySelectorAll("[data-lang]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-lang]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.lang = btn.dataset.lang;
      renderKeyboard();
      if (state.running) startGame();
    });
  });

  el.toggleKeyboardBtn.addEventListener("click", () => {
    state.showKeyboard = !state.showKeyboard;
    el.toggleKeyboardBtn.classList.toggle("active", state.showKeyboard);
    el.keyboardSection.classList.toggle("hidden", !state.showKeyboard);
    document.body.classList.toggle("kb-hidden", !state.showKeyboard);
    updateTargetKeyHighlight();
    setTimeout(reflowArena, 220);
  });

  el.toggleSoundBtn.addEventListener("click", () => {
    state.soundOn = !state.soundOn;
    el.toggleSoundBtn.classList.toggle("active", state.soundOn);
    el.soundIcon.textContent = state.soundOn ? "🔊" : "🔇";
  });

  el.toggleThemeBtn.addEventListener("click", () => {
    const isDark = document.documentElement.classList.toggle("dark");
    el.themeIcon.textContent = isDark ? "☀️" : "🌙";
  });

  el.startBtn.addEventListener("click", startGame);
  el.restartBtn.addEventListener("click", startGame);
  el.resumeBtn.addEventListener("click", togglePause);
  el.pauseBtn.addEventListener("click", togglePause);

  window.addEventListener("resize", () => {
    checkDeviceSupport();
    reflowArena();
  });

  // Init
  loadHighScore();
  el.highScoreValue.textContent = state.highScore.toLocaleString("uk-UA");
  checkDeviceSupport();
  renderKeyboard();
  updateHUD();
})();
