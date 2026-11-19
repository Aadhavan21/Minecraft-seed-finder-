// State
let selectedStructures = new Set(['village', 'ruined_portal', 'outpost']);
let maxRadius = 500;
let foundSeeds = [];
let activeSeedIndex = 0;
let plottedMarkers = [];

// DOM Elements
const structureListEl = document.getElementById('structureList');
const radiusSlider = document.getElementById('radiusSlider');
const radiusValue = document.getElementById('radiusValue');
const seedModeEl = document.getElementById('seedMode');
const searchBtn = document.getElementById('searchBtn');
const scanStatsEl = document.getElementById('scanStats');
const resultsListEl = document.getElementById('resultsList');
const resultCountEl = document.getElementById('resultCount');
const activeSeedSelect = document.getElementById('activeSeedSelect');
const seedPillsEl = document.getElementById('seedPills');
const bannerSeedText = document.getElementById('bannerSeedText');
const copyBannerBtn = document.getElementById('copyBannerBtn');
const radarCanvas = document.getElementById('radarCanvas');
const ctx = radarCanvas.getContext('2d');
const mapTooltip = document.getElementById('mapTooltip');

// Initialize structure checkboxes
function initStructureGrid() {
  structureListEl.innerHTML = '';
  Object.values(STRUCTURE_DEFS).forEach((s) => {
    const label = document.createElement('label');
    label.className = `struct-item ${selectedStructures.has(s.id) ? 'active' : ''}`;
    label.innerHTML = `
      <input type="checkbox" value="${s.id}" ${selectedStructures.has(s.id) ? 'checked' : ''} />
      <span class="struct-icon">${s.icon}</span>
      <div class="struct-meta">
        <span class="struct-name">${s.name}</span>
        <span class="struct-salt">Salt: ${s.salt.toString()}</span>
      </div>
    `;
    const checkbox = label.querySelector('input');
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        selectedStructures.add(s.id);
        label.classList.add('active');
      } else {
        if (selectedStructures.size === 1) {
          checkbox.checked = true;
          return;
        }
        selectedStructures.delete(s.id);
        label.classList.remove('active');
      }
    });
    structureListEl.appendChild(label);
  });
}

radiusSlider.addEventListener('input', (e) => {
  maxRadius = parseInt(e.target.value, 10);
  radiusValue.textContent = `${maxRadius} blocks`;
  if (foundSeeds.length > 0) {
    drawRadarMap(foundSeeds[activeSeedIndex]);
  } else {
    drawEmptyRadar();
  }
});

// Perform 64-bit LCG Seed Scan
function runSeedScan() {
  const startTime = performance.now();
  const mode = seedModeEl.value;
  const targets = Array.from(selectedStructures).map((id) => STRUCTURE_DEFS[id]);

  const matches = [];
  let testedCount = 0;
  const maxIterations = mode === 'verified_db' ? VERIFIED_JAVA_SEEDS.length : 120000;

  for (let i = 0; i < maxIterations; i++) {
    testedCount++;
    const candidateSeed = mode === 'verified_db'
      ? VERIFIED_JAVA_SEEDS[i]
      : generateFull64BitSeed(i + Date.now());

    const foundStructures = [];
    let allMatched = true;
    let totalDist = 0;

    for (const def of targets) {
      const hit = findNearestStructureForSeed(candidateSeed, def, maxRadius);
      if (!hit) {
        allMatched = false;
        break;
      }
      foundStructures.push(hit);
      totalDist += hit.distance;
    }

    if (allMatched) {
      matches.push({
        seed: candidateSeed.toString(),
        structures: foundStructures,
        avgDist: Math.round(totalDist / foundStructures.length)
      });
      if (matches.length >= 10 && mode === 'lcg_live') {
        // Keep scanning a bit more to sort by closest average distance
        if (matches.length >= 25) break;
      }
    }
  }

  // Sort best seeds by closest structure cluster to (0,0)
  matches.sort((a, b) => a.avgDist - b.avgDist);
  foundSeeds = matches.slice(0, 10);

  // If ultra-restrictive combo found fewer than 10 in quick pass, widen fallback pass so user always gets 10 full 64-bit seeds
  let fallbackCounter = 500000;
  while (foundSeeds.length < 10 && fallbackCounter < 650000) {
    fallbackCounter++;
    testedCount++;
    const candidateSeed = generateFull64BitSeed(fallbackCounter);
    const foundStructures = [];
    let valid = true;
    let totalDist = 0;
    for (const def of targets) {
      const hit = findNearestStructureForSeed(candidateSeed, def, Math.max(maxRadius, 850));
      if (!hit) { valid = false; break; }
      foundStructures.push(hit);
      totalDist += hit.distance;
    }
    if (valid) {
      foundSeeds.push({
        seed: candidateSeed.toString(),
        structures: foundStructures,
        avgDist: Math.round(totalDist / foundStructures.length)
      });
    }
  }

  const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
  scanStatsEl.innerHTML = `Evaluated <strong>${testedCount.toLocaleString()}</strong> 64-bit region hashes in <strong>${elapsed}s</strong>.<br>Found <strong>${foundSeeds.length}</strong> exact full-length Java seeds.`;

  activeSeedIndex = 0;
  renderResultsList();
  renderMapSeedSelector();
  selectSeedForMap(0);
}

function renderResultsList() {
  resultCountEl.textContent = `${foundSeeds.length} / 10`;
  resultsListEl.innerHTML = '';

  foundSeeds.forEach((item, idx) => {
    const card = document.createElement('div');
    card.className = `seed-card ${idx === activeSeedIndex ? 'selected' : ''}`;
    card.dataset.index = idx;

    const structsHtml = item.structures
      .map(
        (s) => `
        <div class="struct-tag">
          <span>${s.icon} ${s.name}</span>
          <span>X: <strong>${s.x}</strong>, Z: <strong>${s.z}</strong> (${s.distance}m)</span>
        </div>`
      )
      .join('');

    card.innerHTML = `
      <div class="seed-card-top">
        <span class="seed-rank">Seed #${idx + 1} • Avg ${item.avgDist}m</span>
        <button class="btn-small copy-card-btn" data-seed="${item.seed}">Copy</button>
      </div>
      <div class="seed-number">${item.seed}</div>
      <div class="struct-tags">${structsHtml}</div>
    `;

    card.addEventListener('click', (e) => {
      if (e.target.classList.contains('copy-card-btn')) {
        navigator.clipboard.writeText(item.seed);
        e.target.textContent = 'Copied!';
        setTimeout(() => (e.target.textContent = 'Copy'), 1200);
        return;
      }
      selectSeedForMap(idx);
    });

    resultsListEl.appendChild(card);
  });
}

function renderMapSeedSelector() {
  activeSeedSelect.innerHTML = '';
  seedPillsEl.innerHTML = '';

  if (foundSeeds.length === 0) {
    activeSeedSelect.disabled = true;
    return;
  }

  activeSeedSelect.disabled = false;

  foundSeeds.forEach((item, idx) => {
    // Dropdown option for each of the 10 seeds
    const opt = document.createElement('option');
    opt.value = idx;
    opt.textContent = `Seed #${idx + 1}: ${item.seed}`;
    activeSeedSelect.appendChild(opt);

    // Quick pill button for each of the 10 seeds
    const pill = document.createElement('button');
    pill.className = `pill-btn ${idx === activeSeedIndex ? 'active' : ''}`;
    pill.textContent = `#${idx + 1}`;
    pill.title = `Inspect Seed #${idx + 1}: ${item.seed}`;
    pill.addEventListener('click', () => selectSeedForMap(idx));
    seedPillsEl.appendChild(pill);
  });
}

activeSeedSelect.addEventListener('change', (e) => {
  selectSeedForMap(parseInt(e.target.value, 10));
});

function selectSeedForMap(index) {
  if (!foundSeeds[index]) return;
  activeSeedIndex = index;
  activeSeedSelect.value = index;

  // Highlight selected card
  document.querySelectorAll('.seed-card').forEach((el, i) => {
    el.classList.toggle('selected', i === index);
  });

  // Highlight selected pill
  document.querySelectorAll('.pill-btn').forEach((el, i) => {
    el.classList.toggle('active', i === index);
  });

  const current = foundSeeds[index];
  bannerSeedText.textContent = current.seed;
  copyBannerBtn.disabled = false;

  drawRadarMap(current);
}

copyBannerBtn.addEventListener('click', () => {
  if (!foundSeeds[activeSeedIndex]) return;
  navigator.clipboard.writeText(foundSeeds[activeSeedIndex].seed);
  copyBannerBtn.textContent = 'Copied!';
  setTimeout(() => (copyBannerBtn.textContent = 'Copy Seed'), 1200);
});

// Interactive Map Rendering
function drawEmptyRadar() {
  const w = radarCanvas.width;
  const h = radarCanvas.height;
  const cx = w / 2;
  const cy = h / 2;

  ctx.fillStyle = '#0b0e14';
  ctx.fillRect(0, 0, w, h);

  // Coordinate grid lines
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1;
  const step = 40;
  for (let x = 0; x <= w; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y <= h; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // Axes
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx, 0);
  ctx.lineTo(cx, h);
  ctx.moveTo(0, cy);
  ctx.lineTo(w, cy);
  ctx.stroke();

  // Concentric range rings
  const ringRadii = [0.25, 0.5, 0.75, 1.0];
  const maxPx = w * 0.44;
  ctx.font = '11px monospace';
  ctx.fillStyle = '#64748b';

  ringRadii.forEach((ratio) => {
    const r = maxPx * ratio;
    ctx.strokeStyle = ratio === 1.0 ? 'rgba(56, 189, 248, 0.45)' : '#1e293b';
    ctx.setLineDash(ratio === 1.0 ? [] : [4, 4]);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    const distLabel = Math.round(maxRadius * ratio);
    ctx.fillText(`${distLabel}m`, cx + r - 28, cy - 5);
  });

  // Spawn center (0,0)
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(cx, cy, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText('Spawn (0, 0)', cx + 9, cy + 4);
}

function drawRadarMap(seedObj) {
  drawEmptyRadar();
  plottedMarkers = [];
  if (!seedObj) return;

  const w = radarCanvas.width;
  const h = radarCanvas.height;
  const cx = w / 2;
  const cy = h / 2;

  // Dynamic scale so all plotted structures fit cleanly inside map
  const furthest = Math.max(maxRadius, ...seedObj.structures.map((s) => s.distance));
  const scale = (w * 0.44) / furthest;

  // Draw HUD Title inside canvas
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.fillRect(10, 10, w - 20, 30);
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 12px monospace';
  ctx.fillText(`Viewing Seed #${activeSeedIndex + 1}: ${seedObj.seed}`, 18, 29);

  seedObj.structures.forEach((s) => {
    const px = cx + s.x * scale;
    const py = cy + s.z * scale;

    // Line from spawn to structure
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(px, py);
    ctx.stroke();

    // Outer glow
    ctx.fillStyle = s.color;
    ctx.beginPath();
    ctx.arc(px, py, 11, 0, Math.PI * 2);
    ctx.fill();

    // Inner dark ring
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Emoji icon
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(s.icon, px, py);

    // Coordinate label
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#f1f5f9';
    ctx.font = 'bold 11px monospace';
    ctx.fillText(`${s.name} (${s.x}, ${s.z})`, px + 14, py + 4);

    plottedMarkers.push({
      px,
      py,
      radius: 14,
      data: s
    });
  });
}

// Canvas Hover Tooltip for Exact Chunk & Block Coordinates
radarCanvas.addEventListener('mousemove', (e) => {
  const rect = radarCanvas.getBoundingClientRect();
  const scaleX = radarCanvas.width / rect.width;
  const scaleY = radarCanvas.height / rect.height;
  const mouseX = (e.clientX - rect.left) * scaleX;
  const mouseY = (e.clientY - rect.top) * scaleY;

  const hovered = plottedMarkers.find(
    (m) => Math.hypot(mouseX - m.px, mouseY - m.py) <= m.radius
  );

  if (hovered) {
    const d = hovered.data;
    mapTooltip.innerHTML = `
      <strong>${d.icon} ${d.name}</strong><br>
      Block Coords: <code>X: ${d.x}, Z: ${d.z}</code><br>
      Chunk Coords: <code>[${d.chunkX}, ${d.chunkZ}]</code><br>
      Distance from Spawn: <strong>${d.distance} blocks</strong>
    `;
    mapTooltip.style.left = `${e.clientX - rect.left + 14}px`;
    mapTooltip.style.top = `${e.clientY - rect.top + 14}px`;
    mapTooltip.classList.remove('hidden');
  } else {
    mapTooltip.classList.add('hidden');
  }
});

radarCanvas.addEventListener('mouseleave', () => {
  mapTooltip.classList.add('hidden');
});

searchBtn.addEventListener('click', runSeedScan);

// Boot
initStructureGrid();
drawEmptyRadar();
runSeedScan();
