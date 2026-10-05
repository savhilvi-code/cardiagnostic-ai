(() => {
  const root = document.getElementById("pulsModeSelection");
  const particles = document.getElementById("pulsModeParticles");
  const canvas = document.getElementById("pulsModeScope");
  if (!root || !particles || !canvas) return;

  const largeWaves = [
    root.querySelector(".puls-mode-large-wave-1"),
    root.querySelector(".puls-mode-large-wave-2"),
    root.querySelector(".puls-mode-large-wave-3")
  ].filter(Boolean);
  const largeWaveGroups = largeWaves.map((svg, layerIndex) => ({
    svg,
    layerIndex,
    paths: Array.from(svg.querySelectorAll("path"))
  }));
  const context = canvas.getContext("2d");
  let particlesReady = false;
  let running = false;
  let animationFrame = 0;
  let canvasWidth = 1;
  let canvasHeight = 1;
  let canvasDpr = 1;
  let centralTime = 0;

  function buildParticles() {
    if (particlesReady) return;
    const fragment = document.createDocumentFragment();
    for (let index = 0; index < 260; index += 1) {
      const particle = document.createElement("i");
      const size = .45 + Math.random() * 2.25;
      const useLowerField = Math.random() < .35;
      const verticalPosition = useLowerField
        ? 48 + Math.pow(Math.random(), 1.45) * 47
        : 12 + Math.pow(Math.random(), .9) * 46;
      particle.className = "puls-mode-particle";
      particle.style.left = `${Math.random() * 100}%`;
      particle.style.top = `${verticalPosition}%`;
      particle.style.width = `${size}px`;
      particle.style.height = `${size}px`;
      particle.style.setProperty("--puls-mode-particle-duration", `${1.2 + Math.random() * 3.8}s`);
      particle.style.animationDelay = `${-Math.random() * 4}s`;
      fragment.appendChild(particle);
    }
    particles.appendChild(fragment);
    particlesReady = true;
  }

  function largeWaveAmplitudeMultiplier() {
    const viewportWidth = window.innerWidth;
    if (viewportWidth <= 560) return 1;
    if (viewportWidth <= 768) return 1 + ((viewportWidth - 560) / 208) * .23;
    if (viewportWidth <= 1440) return 1.23 + ((viewportWidth - 768) / 672) * .22;
    return Math.min(1.48, 1.45 + ((viewportWidth - 1440) / 160) * .03);
  }

  function amplitudeAt(position, time, layer) {
    const travel = position - time * (.105 + layer * .012);
    const envelopeOne = .5 + .5 * Math.sin(travel * Math.PI * 2 * 1.18 + layer * 1.21);
    const envelopeTwo = .5 + .5 * Math.sin(travel * Math.PI * 2 * .57 + 1.7 + layer * .63);
    const envelopeThree = .5 + .5 * Math.sin(travel * Math.PI * 2 * 2.03 + 2.5 - layer * .44);
    const voice = .5 * envelopeOne + .32 * envelopeTwo + .18 * envelopeThree;
    const minimum = [.16, .24, .29][layer];
    const maximum = [1, .86, .76][layer];
    return minimum + (maximum - minimum) * Math.pow(voice, 1.32);
  }

  function drawLargeWaves(time) {
    const responsiveAmplitude = largeWaveAmplitudeMultiplier();
    largeWaveGroups.forEach(({ svg, paths, layerIndex }) => {
      const viewBox = svg.viewBox.baseVal;
      const width = viewBox.width || 1000;
      const height = viewBox.height || 300;
      const centerY = height * .5;
      const cycles = [3.08, 3.14, 3.03][layerIndex];
      const baseAmplitude = height * [.34, .28, .22][layerIndex] * responsiveAmplitude;
      const phaseSpeed = [.56, .49, .43][layerIndex];
      const horizontalOverscan = .18;
      const pointCount = 230;
      let pathData = "";
      for (let index = 0; index <= pointCount; index += 1) {
        const normalizedX = -horizontalOverscan + (index / pointCount) * (1 + horizontalOverscan * 2);
        const x = normalizedX * width;
        const carrier = Math.sin(normalizedX * Math.PI * 2 * cycles - time * phaseSpeed + layerIndex * .32);
        const y = centerY + carrier * baseAmplitude * amplitudeAt(normalizedX, time, layerIndex);
        pathData += `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)} `;
      }
      paths.forEach((path) => path.setAttribute("d", pathData.trim()));
    });
  }

  function resizeCanvas() {
    const bounds = canvas.getBoundingClientRect();
    canvasDpr = Math.min(window.devicePixelRatio || 1, 2);
    canvasWidth = Math.max(1, bounds.width);
    canvasHeight = Math.max(1, bounds.height);
    canvas.width = Math.round(canvasWidth * canvasDpr);
    canvas.height = Math.round(canvasHeight * canvasDpr);
    context.setTransform(canvasDpr, 0, 0, canvasDpr, 0, 0);
  }

  function drawCentralWave() {
    context.clearRect(0, 0, canvasWidth, canvasHeight);
    const centerY = canvasHeight * .5;
    const layers = [
      { amplitude: .059, frequency: 3.10, speed: .58, width: 2.6, alpha: .88, phase: 0 },
      { amplitude: .076, frequency: 3.14, speed: .82, width: 1.55, alpha: .58, phase: .24 },
      { amplitude: .064, frequency: 3.06, speed: .43, width: 1.05, alpha: .38, phase: -.22 },
      { amplitude: .052, frequency: 3.18, speed: 1.02, width: .8, alpha: .25, phase: .42 }
    ];
    layers.forEach((layer, layerIndex) => {
      context.beginPath();
      for (let x = 0; x <= canvasWidth; x += 2) {
        const normalizedX = x / canvasWidth;
        const envelope = .82 + .18 * Math.sin(normalizedX * Math.PI);
        const breatheSpeed = [1.42, 1.13, .91, 1.27][layerIndex];
        const breathePhase = [0, 1.15, 2.45, 3.55][layerIndex];
        const minimumAmplitude = [.10, .22, .20, .24][layerIndex];
        const breathing = minimumAmplitude + (1 - minimumAmplitude) * ((Math.sin(centralTime * breatheSpeed + breathePhase) + 1) / 2);
        const travelSpeed = [1.16, 1.31, .91, 1.47][layerIndex];
        const peakFlow = .88 + .12 * (.62 * Math.sin(normalizedX * Math.PI * 2 * .92 - centralTime * .31 + layerIndex * .71) + .38 * Math.sin(normalizedX * Math.PI * 2 * 1.73 - centralTime * .19 + 1.15 + layerIndex * .43));
        const y = centerY + canvasHeight * layer.amplitude * 1.18 * breathing * envelope * peakFlow * Math.sin(normalizedX * Math.PI * 2 * layer.frequency - centralTime * travelSpeed + layer.phase);
        if (x === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      const gradient = context.createLinearGradient(0, 0, canvasWidth, 0);
      gradient.addColorStop(0, `rgba(23,72,207,${layer.alpha * .55})`);
      gradient.addColorStop(.24, `rgba(39,117,255,${layer.alpha * .86})`);
      gradient.addColorStop(.5, `rgba(92,166,255,${layer.alpha})`);
      gradient.addColorStop(.76, `rgba(38,113,255,${layer.alpha * .84})`);
      gradient.addColorStop(1, `rgba(20,67,199,${layer.alpha * .5})`);
      context.strokeStyle = gradient;
      context.lineWidth = layer.width;
      context.shadowBlur = layerIndex === 0 ? 10 : 4;
      context.shadowColor = layerIndex === 0 ? "rgba(38,119,255,.75)" : "rgba(25,87,232,.34)";
      context.stroke();
    });
    context.shadowBlur = 0;
    centralTime += .025;
  }

  function animate(now) {
    if (!running) return;
    drawLargeWaves(now * .001);
    drawCentralWave();
    animationFrame = requestAnimationFrame(animate);
  }

  function show() {
    buildParticles();
    root.hidden = false;
    const app = document.getElementById("app");
    if (app) app.inert = true;
    root.querySelectorAll(".puls-mode-card").forEach((card) => card.classList.remove("selected"));
    requestAnimationFrame(() => {
      resizeCanvas();
      if (!running) {
        running = true;
        animationFrame = requestAnimationFrame(animate);
      }
      root.querySelector("[data-puls-mode='text']")?.focus();
    });
  }

  function hide() {
    running = false;
    cancelAnimationFrame(animationFrame);
    root.hidden = true;
    const app = document.getElementById("app");
    if (app) app.inert = false;
  }

  root.querySelectorAll(".puls-mode-card").forEach((card) => {
    card.addEventListener("click", () => {
      root.querySelectorAll(".puls-mode-card").forEach((candidate) => candidate.classList.toggle("selected", candidate === card));
      const mode = card.dataset.pulsMode;
      window.dispatchEvent(new CustomEvent("puls-mode-selected", { detail: { mode } }));
      if (mode === "text") window.setTimeout(hide, 220);
    });
  });

  window.addEventListener("resize", () => {
    if (!root.hidden) resizeCanvas();
  }, { passive: true });

  window.PulsModeSelection = { show, hide };
})();
