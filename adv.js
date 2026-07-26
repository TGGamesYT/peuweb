(function () {
  const CFG = {
    bg:        "img/adv/back.png",
    fontUrl:   "font/pixel.ttf",
    fontName:  "MCPixel",
    sounds: {
      in:                "sound/in.ogg",
      out:               "sound/out.ogg",
      challenge_complete:"sound/challenge_complete.ogg",
    },
  };

  const MC_W            = 160;
  const MC_H            = 32;
  const DISPLAY_MS      = 5000;
  const SLIDE_MS        = 600;

  const ICON_X          = 8;
  const ICON_Y          = 8;
  const ICON_SIZE       = 16;
  const TEXT_X          = 30;
  const LABEL_Y         = 7;
  const TITLE_Y         = 18;
  const LINE_H          = 9; 

  const COLOR_NORMAL    = "#FFFF00";   // -256
  const COLOR_CHALLENGE = "#FF8800";   // -30465
  const COLOR_WHITE     = "#FFFFFF";   // -1

  const SCALE           = 3;
  const CSS_W           = MC_W * SCALE;  // 480px
  const CSS_H           = MC_H * SCALE;  //  96px

  let _fontReady = false, _fontLoading = false, _fontCbs = [];
  let _bgReady   = false;
  let _styleInj  = false;
  let _queue = [], _busy = false;

  const _bgImg = new Image();
  _bgImg.onload  = function() { _bgReady = true; };
  _bgImg.onerror = function() { _bgReady = true; };
  _bgImg.src = CFG.bg;

  function loadFont(cb) {
    if (_fontReady) { cb(); return; }
    _fontCbs.push(cb);
    if (_fontLoading) return;
    _fontLoading = true;
    new FontFace(CFG.fontName, 'url("' + CFG.fontUrl + '")')
      .load()
      .then(function(f) { document.fonts.add(f); })
      .catch(function() {})
      .finally(function() {
        _fontReady = true;
        _fontCbs.forEach(function(fn) { fn(); });
        _fontCbs = [];
      });
  }

  function injectStyles() {
    if (_styleInj) return;
    _styleInj = true;
    const css = [
      "#mc-adv-wrap{",
        "position:fixed;top:16px;right:0;",
        "z-index:2147483647;pointer-events:none;",
        "display:flex;flex-direction:column;align-items:flex-end;gap:4px;",
      "}",
      ".mc-adv-toast{",
        "width:" + CSS_W + "px;",
        "height:" + CSS_H + "px;",
        "transform:translateX(100%);",
        "image-rendering:pixelated;",
        "filter:drop-shadow(0 2px 8px rgba(0,0,0,.85));",
      "}",
      ".mc-adv-toast canvas{display:block;width:100%;height:100%;image-rendering:pixelated;}",
    ].join("");
    const s = document.createElement("style");
    s.textContent = css;
    document.head.appendChild(s);
  }

  function getContainer() {
    let c = document.getElementById("mc-adv-wrap");
    if (!c) { c = document.createElement("div"); c.id = "mc-adv-wrap"; document.body.appendChild(c); }
    return c;
  }

  function playSound(key) {
    try { var a = new Audio(CFG.sounds[key]); a.volume = 1.0; a.play().catch(function(){}); } catch(e){}
  }

  function drawToast(canvas, label, title, iconImg, isChallenge) {
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;

    if (_bgReady && _bgImg.naturalWidth > 0) {
      ctx.drawImage(_bgImg, 0, 0, MC_W * SCALE, MC_H * SCALE);
    } else {
      ctx.fillStyle = "#1a1a1a";
      ctx.fillRect(0, 0, MC_W * SCALE, MC_H * SCALE);
    }

    const font = SCALE + 'px "' + CFG.fontName + '", "Courier New", monospace';
    const titleColor = isChallenge ? COLOR_CHALLENGE : COLOR_NORMAL;

    ctx.font = font;
    ctx.fillStyle = titleColor;
    ctx.shadowColor = "#000";
    ctx.shadowOffsetX = SCALE * 0.5;
    ctx.shadowOffsetY = SCALE * 0.5;
    ctx.shadowBlur = 0;
    ctx.textBaseline = "top";
    ctx.fillText(label, TEXT_X * SCALE, LABEL_Y * SCALE);

    ctx.fillStyle = COLOR_WHITE;
    ctx.fillText(truncate(ctx, title, (MC_W - TEXT_X - 4) * SCALE), TEXT_X * SCALE, TITLE_Y * SCALE);

    ctx.shadowColor = "transparent";

    if (iconImg) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(iconImg, ICON_X * SCALE, ICON_Y * SCALE, ICON_SIZE * SCALE, ICON_SIZE * SCALE);
    }
  }

  function truncate(ctx, text, maxW) {
    if (ctx.measureText(text).width <= maxW) return text;
    while (text.length > 0 && ctx.measureText(text + "\u2026").width > maxW) text = text.slice(0, -1);
    return text + "\u2026";
  }

  function animate(wrapper, canvas, label, title, iconSrc, isChallenge) {
    let animStart   = -1;
    let becameFull  = -1;
    let visibility  = "SHOW";
    let fullyFor    = 0;
    let finished    = false;
    let soundPlayed = false;
    let outSoundPlayed = false;

    function visiblePortion(now) {
      var t = Math.min(Math.max((now - animStart) / SLIDE_MS, 0), 1);

      return visibility === "HIDE" ? 1 - t : t;
    }

    function tick(now) {
      if (finished) return;

      if (animStart === -1) {
        animStart = now;
        visibility = "SHOW";

        if (!soundPlayed) {
          soundPlayed = true;
          playSound(isChallenge ? "challenge_complete" : "in");
        }
      }

      if (visibility === "SHOW" && (now - animStart) <= SLIDE_MS) {
        becameFull = now;
      }
      fullyFor = becameFull >= 0 ? now - becameFull : 0;

      const wantedHide = fullyFor >= DISPLAY_MS;
      if (wantedHide && visibility !== "HIDE") {

        const vp = visiblePortion(now);
        animStart = now - (1 - vp) * SLIDE_MS;
        visibility = "HIDE";
      }

      const vp = visiblePortion(now);

      wrapper.style.transform = "translateX(" + ((1 - vp) * 100) + "%)";

      // Play out sound when starting to hide
      if (visibility === "HIDE" && !outSoundPlayed) {
        outSoundPlayed = true;
        playSound("out");
      }

      // Done when HIDE and past 600ms
      if (visibility === "HIDE" && (now - animStart) > SLIDE_MS) {
        finished = true;
        wrapper.remove();
        _busy = false;
        processQueue();
        return;
      }

      requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  }

  function showToast(title, description, iconSrc, isChallenge) {
    const container = getContainer();
    const wrapper   = document.createElement("div");
    wrapper.className = "mc-adv-toast";
    const canvas = document.createElement("canvas");
    canvas.width  = MC_W * SCALE;
    canvas.height = MC_H * SCALE;
    wrapper.appendChild(canvas);
    container.appendChild(wrapper);

    const label = isChallenge ? "Challenge Complete!" : "Advancement Made!";

    function start(iconImg) {
      drawToast(canvas, label, title, iconImg, isChallenge);
      animate(wrapper, canvas, label, title, iconSrc, isChallenge);
    }

    loadFont(function() {
      if (!iconSrc) { start(null); return; }
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload  = function() { start(img); };
      img.onerror = function() { start(null); };
      img.src = iconSrc;
    });
  }

  function processQueue() {
    if (_busy || !_queue.length) return;
    _busy = true;
    const next = _queue.shift();
    showToast(next.title, next.desc, next.icon, next.challenge);
  }

  window.grantAdvancement = function(title, description, iconPath, isChallenge) {
    injectStyles();
    _queue.push({ title: title||"", desc: description||"", icon: iconPath||null, challenge: !!isChallenge });
    processQueue();
  };

})();