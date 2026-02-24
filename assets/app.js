/*
  Sesión 4 — App interactiva (estática) para GitHub Pages
  - Mochila: exacto (DP) vs heurístico (greedy ratio)
  - TSP pequeño: heurística (Nearest Neighbor) vs exacto (brute force, n<=10)
  - Medición: tiempo (performance.now), calidad y gap
  - Export: JSON
*/

/* =========================
   RNG reproducible (xmur3 + mulberry32)
   ========================= */
function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}
function mulberry32(a) {
  return function () {
    let t = (a += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function makeRng(seedStr){
  const seedFn = xmur3(seedStr);
  return mulberry32(seedFn());
}
function clamp(x, lo, hi){ return Math.max(lo, Math.min(hi, x)); }

/* =========================
   Utilidades UI
   ========================= */
function $(id){ return document.getElementById(id); }
function fmtMs(ms){
  if (ms < 1) return `${ms.toFixed(3)} ms`;
  if (ms < 1000) return `${ms.toFixed(1)} ms`;
  return `${(ms/1000).toFixed(2)} s`;
}
function fmtPct(x){
  if (!isFinite(x)) return "—";
  return (x*100).toFixed(2) + "%";
}
function setText(id, txt){ $(id).textContent = txt; }
function showWarn(prefixId, show, text){
  const box = $(prefixId + "_warn");
  const t = $(prefixId + "_warn_text");
  if (!box || !t) return;
  box.hidden = !show;
  if (show) t.textContent = text;
}

/* =========================
   Tabs
   ========================= */
const tabKn = $("tab-knapsack");
const tabTsp = $("tab-tsp");
const panelKn = $("panel-knapsack");
const panelTsp = $("panel-tsp");

function activateTab(which){
  const kn = which === "knapsack";
  tabKn.classList.toggle("tab--active", kn);
  tabTsp.classList.toggle("tab--active", !kn);
  tabKn.setAttribute("aria-selected", kn ? "true" : "false");
  tabTsp.setAttribute("aria-selected", !kn ? "true" : "false");
  panelKn.classList.toggle("panel--active", kn);
  panelTsp.classList.toggle("panel--active", !kn);
}
tabKn.addEventListener("click", ()=>activateTab("knapsack"));
tabTsp.addEventListener("click", ()=>activateTab("tsp"));

/* =========================
   Estado global + export
   ========================= */
let STATE = {
  lastRun: null, // se llena tras ejecutar algo
  knapsack: { items: [], W: 60, n: 18, seed: "S4-2510A", results: {} },
  tsp: { points: [], n: 9, seed: "S4-2510A", mode: "grid", results: {} }
};

function enableExport(){
  $("exportBtn").disabled = !STATE.lastRun;
}
function exportJSON(){
  if (!STATE.lastRun) return;
  const payload = {
    app: "Sesion4-ExactoVsHeuristico",
    created_at: new Date().toISOString(),
    lastRun: STATE.lastRun,
    knapsack: STATE.knapsack,
    tsp: STATE.tsp
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `sesion4_resultados_${STATE.lastRun}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
$("exportBtn").addEventListener("click", exportJSON);

/* =========================
   KNAPSACK (Mochila)
   ========================= */
function genItems(n, rng){
  // pesos 1..15, valores 5..90 con sesgo para variedad
  const items = [];
  for(let i=0;i<n;i++){
    const w = 1 + Math.floor(rng()*15);
    const base = 5 + Math.floor(Math.pow(rng(), 0.65)*85);
    const v = base + Math.floor((rng()-0.5)*10);
    items.push({ w, v: Math.max(1, v) });
  }
  return items;
}

function knapsackExactDP(items, W){
  // dp[i][w] = max valor usando primeros i items con capacidad w
  const n = items.length;
  const dp = Array.from({length: n+1}, ()=> new Array(W+1).fill(0));
  const keep = Array.from({length: n+1}, ()=> new Array(W+1).fill(false));

  for(let i=1;i<=n;i++){
    const {w: wi, v: vi} = items[i-1];
    for(let cap=0; cap<=W; cap++){
      let best = dp[i-1][cap];
      let take = false;
      if (wi <= cap){
        const cand = dp[i-1][cap-wi] + vi;
        if (cand > best){
          best = cand;
          take = true;
        }
      }
      dp[i][cap] = best;
      keep[i][cap] = take;
    }
  }

  // reconstruir seleccion
  let cap = W;
  const chosen = [];
  for(let i=n; i>=1; i--){
    if (keep[i][cap]){
      chosen.push(i-1);
      cap -= items[i-1].w;
    }
  }
  chosen.reverse();
  return { value: dp[n][W], chosen };
}

function knapsackGreedy(items, W){
  const idx = items.map((_,i)=>i);
  idx.sort((a,b)=> (items[b].v/items[b].w) - (items[a].v/items[a].w));
  let wUsed=0, value=0;
  const chosen=[];
  for(const i of idx){
    const it = items[i];
    if (wUsed + it.w <= W){
      wUsed += it.w;
      value += it.v;
      chosen.push(i);
    }
  }
  return { value, chosen };
}

function renderItems(items){
  const tb = $("k_items_tbl");
  tb.innerHTML = "";
  items.forEach((it, i)=>{
    const tr = document.createElement("tr");
    const ratio = (it.v/it.w).toFixed(2);
    tr.innerHTML = `<td>${i}</td><td>${it.w}</td><td>${it.v}</td><td>${ratio}</td>`;
    tb.appendChild(tr);
  });
}
function renderSelection(targetId, items, chosen, W){
  if (!chosen) { $(targetId).textContent = "—"; return; }
  let w=0, v=0;
  const parts = chosen.map(i=>{
    const it = items[i];
    w += it.w; v += it.v;
    return `#${i}(${it.w},${it.v})`;
  });
  $(targetId).textContent = parts.length ? `${parts.join(" · ")}  |  peso=${w}/${W}, valor=${v}` : "∅ (no se elige nada)";
}

function timeCall(fn){
  const t0 = performance.now();
  const out = fn();
  const t1 = performance.now();
  return { ms: t1 - t0, out };
}

function knResetResults(){
  setText("k_exact_value","—");
  setText("k_exact_time","—");
  setText("k_heur_value","—");
  setText("k_heur_time","—");
  setText("k_gap","—");
  $("k_exact_sel").textContent="—";
  $("k_heur_sel").textContent="—";
  showWarn("k", false, "");
  STATE.knapsack.results = {};
}

function knGen(){
  const seed = $("seedInput").value.trim() || "seed";
  const n = parseInt($("k_n").value,10);
  const W = parseInt($("k_W").value,10);

  // sincroniza seed en ambos paneles
  $("seedInput2").value = seed;

  const rng = makeRng(seed + "|kn|" + n + "|" + W);
  const items = genItems(n, rng);

  STATE.knapsack.seed = seed;
  STATE.knapsack.n = n;
  STATE.knapsack.W = W;
  STATE.knapsack.items = items;

  renderItems(items);
  knResetResults();

  $("k_run_exact").disabled = false;
  $("k_run_heur").disabled = false;
  $("k_run_both").disabled = false;
  enableExport();
}

function knRunExact(){
  const {items, W} = STATE.knapsack;
  if (!items.length) return;

  const {ms, out} = timeCall(()=>knapsackExactDP(items, W));
  STATE.knapsack.results.exact = { value: out.value, chosen: out.chosen, ms };

  setText("k_exact_value", String(out.value));
  setText("k_exact_time", `tiempo: ${fmtMs(ms)}`);
  renderSelection("k_exact_sel", items, out.chosen, W);

  knUpdateGap();
  STATE.lastRun = "knapsack";
  enableExport();
}

function knRunHeur(){
  const {items, W} = STATE.knapsack;
  if (!items.length) return;

  const {ms, out} = timeCall(()=>knapsackGreedy(items, W));
  STATE.knapsack.results.heur = { value: out.value, chosen: out.chosen, ms };

  setText("k_heur_value", String(out.value));
  setText("k_heur_time", `tiempo: ${fmtMs(ms)}`);
  renderSelection("k_heur_sel", items, out.chosen, W);

  knUpdateGap();
  STATE.lastRun = "knapsack";
  enableExport();
}

function knUpdateGap(){
  const ex = STATE.knapsack.results.exact;
  const he = STATE.knapsack.results.heur;
  if (!ex || !he){
    setText("k_gap","—");
    return;
  }
  const gap = ex.value === 0 ? 0 : (ex.value - he.value) / ex.value;
  setText("k_gap", fmtPct(gap));

  // mini-aviso didáctico si gap grande
  if (gap > 0.15){
    showWarn("k", true, "Gap notable: la heurística eligió bien localmente, pero no encontró la mejor combinación global.");
  } else {
    showWarn("k", false, "");
  }
}

$("k_n").addEventListener("input", ()=> setText("k_n_val", $("k_n").value));
$("k_W").addEventListener("input", ()=> setText("k_W_val", $("k_W").value));
$("k_gen").addEventListener("click", knGen);
$("k_run_exact").addEventListener("click", knRunExact);
$("k_run_heur").addEventListener("click", knRunHeur);
$("k_run_both").addEventListener("click", ()=>{ knRunExact(); knRunHeur(); });

/* =========================
   TSP (Ruta pequeña)
   ========================= */
function genPoints(n, rng, mode){
  const pts = [];
  const used = new Set();

  function addPoint(x,y){
    const key = `${x.toFixed(3)}|${y.toFixed(3)}`;
    if (used.has(key)) return false;
    used.add(key);
    pts.push({x,y});
    return true;
  }

  if (mode === "grid"){
    while(pts.length < n){
      const x = Math.floor(rng()*21);
      const y = Math.floor(rng()*21);
      addPoint(x, y);
    }
  } else if (mode === "circle"){
    const cx = 10, cy = 10;
    const R = 8.5;
    for(let i=0;i<n;i++){
      const ang = (2*Math.PI*i)/n + (rng()-0.5)*0.2;
      const rr = R + (rng()-0.5)*1.2;
      const x = cx + rr*Math.cos(ang);
      const y = cy + rr*Math.sin(ang);
      addPoint(x, y);
    }
  } else { // cluster
    const c1 = {x: 6 + rng()*2, y: 6 + rng()*2};
    const c2 = {x: 16 + rng()*2, y: 14 + rng()*2};
    while(pts.length < n){
      const c = (rng() < 0.5) ? c1 : c2;
      const x = c.x + (rng()-0.5)*3.2;
      const y = c.y + (rng()-0.5)*3.2;
      addPoint(x, y);
    }
  }
  return pts;
}

function dist(a,b){
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}
function tourLength(tour, pts){
  let L=0;
  for(let i=0;i<tour.length-1;i++){
    L += dist(pts[tour[i]], pts[tour[i+1]]);
  }
  return L;
}

function tspNearestNeighbor(pts){
  const n = pts.length;
  const unvisited = new Set();
  for(let i=1;i<n;i++) unvisited.add(i);
  const tour = [0];
  while(unvisited.size){
    const last = tour[tour.length-1];
    let best = null, bestD = Infinity;
    for(const j of unvisited){
      const d = dist(pts[last], pts[j]);
      if (d < bestD){ bestD = d; best = j; }
    }
    tour.push(best);
    unvisited.delete(best);
  }
  tour.push(0);
  return { len: tourLength(tour, pts), tour };
}

// Iterador lexicográfico de permutaciones (next_permutation)
function nextPermutation(arr){
  // devuelve true si pudo avanzar; false si era la última
  let i = arr.length - 2;
  while(i >= 0 && arr[i] >= arr[i+1]) i--;
  if (i < 0) return false;
  let j = arr.length - 1;
  while(arr[j] <= arr[i]) j--;
  [arr[i], arr[j]] = [arr[j], arr[i]];
  // reverse suffix
  let l = i+1, r = arr.length - 1;
  while(l < r){
    [arr[l], arr[r]] = [arr[r], arr[l]];
    l++; r--;
  }
  return true;
}

function tspExactBruteforce(pts){
  const n = pts.length;
  // permutar nodos 1..n-1
  const perm = [];
  for(let i=1;i<n;i++) perm.push(i);
  perm.sort((a,b)=>a-b);

  let bestLen = Infinity;
  let bestTour = null;

  // evalúa perm actual
  const evalPerm = ()=>{
    const tour = [0, ...perm, 0];
    const L = tourLength(tour, pts);
    if (L < bestLen){
      bestLen = L;
      bestTour = tour.slice();
    }
  };

  evalPerm();
  while(nextPermutation(perm)){
    evalPerm();
  }
  return { len: bestLen, tour: bestTour };
}

function renderPoints(pts){
  const tb = $("t_points_tbl");
  tb.innerHTML = "";
  pts.forEach((p,i)=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${i}</td><td>${p.x.toFixed(2)}</td><td>${p.y.toFixed(2)}</td>`;
    tb.appendChild(tr);
  });
}

function renderTour(targetId, tour){
  if (!tour) { $(targetId).textContent = "—"; return; }
  $(targetId).textContent = tour.join(" → ");
}

function tspResetResults(){
  setText("t_heur_len","—");
  setText("t_heur_time","—");
  setText("t_exact_len","—");
  setText("t_exact_time","—");
  setText("t_gap","—");
  $("t_heur_tour").textContent="—";
  $("t_exact_tour").textContent="—";
  showWarn("t", false, "");
  STATE.tsp.results = {};
  drawTspCanvas(null, null);
}

function tspGen(){
  const seed = $("seedInput2").value.trim() || "seed";
  const n = parseInt($("t_n").value,10);
  const mode = $("t_mode").value;

  // sincroniza seed al panel knapsack
  $("seedInput").value = seed;

  const rng = makeRng(seed + "|tsp|" + n + "|" + mode);
  const pts = genPoints(n, rng, mode);

  STATE.tsp.seed = seed;
  STATE.tsp.n = n;
  STATE.tsp.mode = mode;
  STATE.tsp.points = pts;

  renderPoints(pts);
  tspResetResults();

  $("t_run_heur").disabled = false;
  $("t_run_both").disabled = false;

  // exacto solo si n<=10
  const enableExact = n <= 10;
  $("t_run_exact").disabled = !enableExact;
  if (!enableExact){
    showWarn("t", true, "Exacto desactivado para n>10 (evita congelar el navegador). Prueba 8→9→10.");
  } else {
    showWarn("t", false, "");
  }

  enableExport();
}

function tspRunHeur(){
  const pts = STATE.tsp.points;
  if (!pts.length) return;

  const {ms, out} = timeCall(()=>tspNearestNeighbor(pts));
  STATE.tsp.results.heur = { len: out.len, tour: out.tour, ms };

  setText("t_heur_len", out.len.toFixed(3));
  setText("t_heur_time", `tiempo: ${fmtMs(ms)}`);
  renderTour("t_heur_tour", out.tour);

  tspUpdateGap();
  drawTspCanvas(out.tour, STATE.tsp.results.exact?.tour || null);

  STATE.lastRun = "tsp";
  enableExport();
}

function tspRunExact(){
  const pts = STATE.tsp.points;
  if (!pts.length) return;

  const n = pts.length;
  if (n > 10){
    showWarn("t", true, "Exacto desactivado para n>10.");
    return;
  }

  showWarn("t", true, "Ejecutando exacto… si tardase demasiado, baja n (por ejemplo a 9 o 8).");
  // Deja respirar al navegador antes de un cálculo pesado
  setTimeout(()=>{
    const {ms, out} = timeCall(()=>tspExactBruteforce(pts));
    STATE.tsp.results.exact = { len: out.len, tour: out.tour, ms };

    setText("t_exact_len", out.len.toFixed(3));
    setText("t_exact_time", `tiempo: ${fmtMs(ms)}`);
    renderTour("t_exact_tour", out.tour);

    showWarn("t", false, "");
    tspUpdateGap();
    drawTspCanvas(STATE.tsp.results.heur?.tour || null, out.tour);

    STATE.lastRun = "tsp";
    enableExport();
  }, 20);
}

function tspUpdateGap(){
  const ex = STATE.tsp.results.exact;
  const he = STATE.tsp.results.heur;
  if (!ex || !he){
    setText("t_gap","—");
    return;
  }
  const gap = ex.len === 0 ? 0 : (he.len - ex.len) / ex.len;
  setText("t_gap", fmtPct(gap));
}

$("t_n").addEventListener("input", ()=> setText("t_n_val", $("t_n").value));
$("t_mode").addEventListener("change", ()=>{ /* solo UI */ });
$("t_gen").addEventListener("click", tspGen);
$("t_run_heur").addEventListener("click", tspRunHeur);
$("t_run_exact").addEventListener("click", tspRunExact);
$("t_run_both").addEventListener("click", ()=>{ tspRunHeur(); tspRunExact(); });

/* =========================
   Canvas (visualización rápida)
   ========================= */
function drawTspCanvas(tourHeur, tourExact){
  const canvas = $("t_canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const pts = STATE.tsp.points;

  // limpiar
  ctx.clearRect(0,0,canvas.width,canvas.height);

  if (!pts.length){
    // placeholder
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = "rgba(255,255,255,.7)";
    ctx.font = "14px " + getComputedStyle(document.documentElement).getPropertyValue("--sans");
    ctx.fillText("Genera puntos para ver la ruta", 18, 32);
    return;
  }

  // normalizar coords a canvas
  let minX=Infinity, maxX=-Infinity, minY=Infinity, maxY=-Infinity;
  pts.forEach(p=>{
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  });
  const pad = 26;
  const W = canvas.width, H = canvas.height;
  const sx = (W - 2*pad) / Math.max(1e-9, (maxX - minX));
  const sy = (H - 2*pad) / Math.max(1e-9, (maxY - minY));
  const s = Math.min(sx, sy);

  function map(p){
    return {
      x: pad + (p.x - minX)*s,
      y: pad + (p.y - minY)*s
    };
  }
  const mpts = pts.map(map);

  function drawPath(tour, strokeStyle, alpha){
    if (!tour) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    const p0 = mpts[tour[0]];
    ctx.moveTo(p0.x, p0.y);
    for(let i=1;i<tour.length;i++){
      const p = mpts[tour[i]];
      ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    ctx.restore();
  }

  // 1) dibuja exacto debajo (si existe) y heurística encima
  drawPath(tourExact, "rgba(45,212,191,.95)", 0.75);   // verde agua
  drawPath(tourHeur, "rgba(124,92,255,.95)", 0.85);    // violeta

  // puntos
  ctx.save();
  for(let i=0;i<mpts.length;i++){
    const p = mpts[i];
    ctx.fillStyle = (i===0) ? "rgba(251,191,36,.95)" : "rgba(233,238,255,.92)";
    ctx.beginPath();
    ctx.arc(p.x, p.y, (i===0)?6:4.5, 0, Math.PI*2);
    ctx.fill();

    ctx.fillStyle = "rgba(11,16,32,.95)";
    ctx.font = "11px " + getComputedStyle(document.documentElement).getPropertyValue("--mono");
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(i), p.x, p.y);
  }
  ctx.restore();

  // leyenda
  ctx.save();
  ctx.globalAlpha = 0.95;
  ctx.font = "12px " + getComputedStyle(document.documentElement).getPropertyValue("--sans");
  ctx.fillStyle = "rgba(233,238,255,.85)";
  ctx.fillText("Heurística (NN)", 18, H-18);
  ctx.fillStyle = "rgba(124,92,255,.95)";
  ctx.fillRect(128, H-26, 12, 12);

  ctx.fillStyle = "rgba(233,238,255,.85)";
  ctx.fillText("Exacto", 164, H-18);
  ctx.fillStyle = "rgba(45,212,191,.95)";
  ctx.fillRect(212, H-26, 12, 12);

  ctx.restore();
}

/* =========================
   Inicialización
   ========================= */
function init(){
  // sincroniza seeds iniciales
  $("seedInput2").value = $("seedInput").value;

  // valores iniciales de sliders
  setText("k_n_val", $("k_n").value);
  setText("k_W_val", $("k_W").value);
  setText("t_n_val", $("t_n").value);

  // placeholder canvas
  drawTspCanvas(null, null);

  // Generación inicial automática para que la app “arranque con algo”
  knGen();
  tspGen();
}
init();
