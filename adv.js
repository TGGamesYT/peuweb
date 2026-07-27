(function () {

  const CFG = {
    bg:      "img/adv/back.png",
    fontUrl: "font/pixel.ttf",
    fontName:"MCPixel",
    sounds: {
      in:                 "sound/in.ogg",
      out:                "sound/out.ogg",
      challenge_complete: "sound/challenge_complete.ogg",
    },
  };

  const DISPLAY_MS = 5000;
  const SLIDE_MS   = 600;

  const COLOR_NORMAL    = "#FFFF00";
  const COLOR_CHALLENGE = "#FF88FF";

  let _fontReady = false, _fontLoading = false, _fontCbs = [];
  let _styleInj  = false;
  let _queue = [], _busy = false;

  function loadFont(cb) {
    if (_fontReady) { cb(); return; }
    _fontCbs.push(cb);
    if (_fontLoading) return;
    _fontLoading = true;
    new FontFace(CFG.fontName, 'url("' + CFG.fontUrl + '")')
      .load()
      .then(function (f) { document.fonts.add(f); })
      .catch(function () {})
      .finally(function () {
        _fontReady = true;
        _fontCbs.forEach(function (fn) { fn(); });
        _fontCbs = [];
      });
  }

  function injectStyles() {
    if (_styleInj) return;
    _styleInj = true;
    const css = `
      #mc-adv-anchor {
        position: fixed;
        top: 0; right: 0;
        width: 0; height: 0;
        overflow: visible;
        pointer-events: none;
        z-index: 2147483647;
      }
      #mc-adv-stack {
        position: absolute;
        top: 16px; right: 0;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 4px;
      }
      .mc-adv-toast {
        position: relative;
        width: clamp(280px, 28vw, 520px);
        aspect-ratio: 160 / 32;
        transform: translateX(100%);
        image-rendering: pixelated;
        filter: drop-shadow(0 2px 10px rgba(0,0,0,0.9));
        overflow: hidden;
      }
      .mc-adv-bg {
        position: absolute;
        inset: 0;
        width: 100%; height: 100%;
        object-fit: fill;
        image-rendering: pixelated;
        display: block;
      }
      .mc-adv-icon {
        position: absolute;
        left: 8em;
        top: 50%;
        transform: translateY(-50%);
        width: 16em; height: 16em;
        image-rendering: pixelated;
      }
      .mc-adv-text {
        position: absolute;
        left: 30em;
        top: 0; bottom: 0;
        right: 4em;
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 0;
        overflow: hidden;
      }
      .mc-adv-label {
        font-size: 6em;
        line-height: 1.1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        text-shadow: 1px 1px 0 #000;
        margin-bottom: 0.4em;
      }
      .mc-adv-title {
        font-size: 8em;
        line-height: 1.1;
        color: #fff;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        text-shadow: 1px 1px 0 #000;
      }
    `;
    const s = document.createElement("style");
    s.textContent = css;
    document.head.appendChild(s);
  }

  function getStack() {
    let anchor = document.getElementById("mc-adv-anchor");
    if (!anchor) {
      anchor = document.createElement("div");
      anchor.id = "mc-adv-anchor";
      const stack = document.createElement("div");
      stack.id = "mc-adv-stack";
      anchor.appendChild(stack);
      document.body.appendChild(anchor);
    }
    return anchor.querySelector("#mc-adv-stack");
  }

  function playSound(key) {
    try {
      const a = new Audio(CFG.sounds[key]);
      a.volume = 1.0;
      a.play().catch(function () {});
    } catch (e) {}
  }

  function animateToast(wrapper, isChallenge) {
    let animStart      = -1;
    let becameFull     = -1;
    let visibility     = "SHOW";
    let soundPlayed    = false;
    let outSoundPlayed = false;
    let finished       = false;

    function vp(now) {
      let t = (now - animStart) / SLIDE_MS;
      t = Math.min(Math.max(t, 0), 1);
      t = t * t;
      return visibility === "HIDE" ? 1 - t : t;
    }

    function tick(now) {
      if (finished) return;
      if (animStart === -1) { animStart = now; visibility = "SHOW"; }

      if (!soundPlayed) {
        soundPlayed = true;
        playSound(isChallenge ? "challenge_complete" : "in");
      }

      if (visibility === "SHOW" && (now - animStart) <= SLIDE_MS) becameFull = now;
      const fullyFor = becameFull >= 0 ? now - becameFull : 0;

      if (fullyFor >= DISPLAY_MS && visibility !== "HIDE") {
        const curVP = vp(now);
        animStart   = now - (1 - curVP) * SLIDE_MS;
        visibility  = "HIDE";
      }

      if (visibility === "HIDE" && !outSoundPlayed) {
        outSoundPlayed = true;
        playSound("out");
      }

      wrapper.style.transform = "translateX(" + ((1 - vp(now)) * 100) + "%)";

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

  function showToast(title, iconSrc, isChallenge) {
    const stack = getStack();

    const wrapper = document.createElement("div");
    wrapper.className = "mc-adv-toast";

    // em base: 1em = 1 MC pixel unit, set via font-size on wrapper
    // toast is 160×32 MC units, wrapper is clamp(280px,28vw,520px) wide
    // so 1em = width/160
    wrapper.style.fontSize = "calc(clamp(280px, 28vw, 520px) / 160)";

    const bg = document.createElement("img");
    bg.className = "mc-adv-bg";
    bg.src = CFG.bg;
    bg.alt = "";
    wrapper.appendChild(bg);

    const label = isChallenge ? "Challenge Complete!" : "Advancement Made!";
    const labelColor = isChallenge ? COLOR_CHALLENGE : COLOR_NORMAL;

    const textDiv = document.createElement("div");
    textDiv.className = "mc-adv-text";
    textDiv.style.fontFamily = '"' + CFG.fontName + '", monospace';

    const labelEl = document.createElement("div");
    labelEl.className = "mc-adv-label";
    labelEl.style.color = labelColor;
    labelEl.textContent = label;

    const titleEl = document.createElement("div");
    titleEl.className = "mc-adv-title";
    titleEl.textContent = title;

    textDiv.appendChild(labelEl);
    textDiv.appendChild(titleEl);
    wrapper.appendChild(textDiv);

    if (iconSrc) {
      const icon = document.createElement("img");
      icon.className = "mc-adv-icon";
      icon.src = iconSrc;
      icon.alt = "";
      wrapper.appendChild(icon);
    }

    stack.appendChild(wrapper);
    animateToast(wrapper, isChallenge);
  }

  function processQueue() {
    if (_busy || !_queue.length) return;
    _busy = true;
    const next = _queue.shift();
    loadFont(function () { showToast(next.title, next.icon, next.challenge); });
  }

  window.grantAdvancement = function (title, description, iconPath, isChallenge) {
    injectStyles();
    _queue.push({ title: title || "", icon: iconPath || null, challenge: !!isChallenge });
    processQueue();
  };

})();