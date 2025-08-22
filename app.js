// ===== DOM helpers =====
const $ = (sel) => document.querySelector(sel);
const $all = (sel) => Array.from(document.querySelectorAll(sel));

// ======== Riot DDragon 설정 ========
const CDN_BASE = "https://ddragon.leagueoflegends.com/cdn";
const LOCALE = "ko_KR";

let CHAMPS = [];  // { id, name, img }
let PATCH = null;

// ======== 밴픽 프리셋 ========
const PRESETS = {
  Bo1: {
    games: 1,
    rounds: [
      // Ban 1
      { type: "BAN",  side: "BLUE", count: 1 },
      { type: "BAN",  side: "RED",  count: 1 },
      { type: "BAN",  side: "BLUE", count: 1 },
      { type: "BAN",  side: "RED",  count: 1 },
      { type: "BAN",  side: "BLUE", count: 1 },
      { type: "BAN",  side: "RED",  count: 1 },
      // Pick 1
      { type: "PICK", side: "BLUE", count: 1 },
      { type: "PICK", side: "RED",  count: 1 },
      { type: "PICK", side: "RED",  count: 1 },
      { type: "PICK", side: "BLUE", count: 1 },
      { type: "PICK", side: "BLUE", count: 1 },
      { type: "PICK", side: "RED",  count: 1 },
      // Ban 2
      { type: "BAN",  side: "RED",  count: 1 },
      { type: "BAN",  side: "BLUE", count: 1 },
      { type: "BAN",  side: "RED",  count: 1 },
      { type: "BAN",  side: "BLUE", count: 1 },
      // Pick 2
      { type: "PICK", side: "RED",  count: 1 },
      { type: "PICK", side: "BLUE", count: 1 },
      { type: "PICK", side: "BLUE", count: 1 },
      { type: "PICK", side: "RED",  count: 1 },
    ],
    pickTimer: 30,
    banTimer: 30,
  }
};
PRESETS.Bo3 = { ...PRESETS.Bo1, games: 3 };
PRESETS.Bo5 = { ...PRESETS.Bo1, games: 5 };

// ====== DOM cache ======
const el = {
  start: $("#btnStart"),
  back:  $("#btnBack"),
  reset: $("#btnReset"),
  chkTimer: $("#chkTimer"),
  search: $("#searchInput"),
  confirm: $("#btnConfirm"),
  endGame: $("#btnEndGame"),

  status: $("#status"),
  pool: $("#pool"),
  bluePicks: $("#blue-picks"),
  blueBans:  $("#blue-bans"),
  redPicks:  $("#red-picks"),
  redBans:   $("#red-bans"),
  seriesInfo: $("#seriesInfo"),
  history: $("#history"),
};

// ===== 시리즈/게임 상태 =====
let mode = (document.querySelector('input[name="mode"]:checked')?.value) || "Bo1";
let useTimer = true;
let started = false;
let gameIndex = 0;
let seriesTaken = new Set();
let results = [];

let phaseIndex = 0;
let blue = { bans: [], picks: [] };
let red  = { bans: [], picks: [] };
let taken = new Set();
let ticking = null;
let actionLog = [];

let staged = null;
let q = "";

// ===== 렌더링 =====
function initSlots() {
  const mk = () => Array.from({ length: 5 }).map(() => {
    const d = document.createElement("div");
    d.className = "slot";
    d.textContent = "-";
    return d;
  });
  el.blueBans.replaceChildren(...mk());
  el.bluePicks.replaceChildren(...mk());
  el.redBans.replaceChildren(...mk());
  el.redPicks.replaceChildren(...mk());
}

function renderSeriesInfo() {
  const total = PRESETS[mode].games;
  el.seriesInfo.textContent = `Game ${gameIndex + 1} / ${total}`;
  el.endGame.textContent = `${gameIndex + 1}세트 밴픽 종료`;
  el.endGame.disabled = isLastGame();
}

function filteredChamps() {
  if (!q) return CHAMPS;
  const s = q.toLowerCase();
  return CHAMPS.filter(c => c.name.toLowerCase().includes(s) || c.id.toLowerCase().includes(s));
}

function renderPool() {
  if (CHAMPS.length === 0) {
    el.pool.innerHTML = `<div style="grid-column:1/-1;color:#9ca3af;padding:8px;">챔피언 이미지 불러오는 중...</div>`;
    return;
  }
  const active = started && isActive();
  const frag = document.createDocumentFragment();
  filteredChamps().forEach((c) => {
    const btn = document.createElement("button");
    btn.disabled = !active || taken.has(c.id) || seriesTaken.has(c.id);
    btn.addEventListener("click", () => stageChampion(c));

    const img = document.createElement("img");
    img.loading = "lazy";
    img.alt = c.name;
    img.src = c.img;
    img.onerror = () => { img.style.display = "none"; };

    const meta = document.createElement("div"); 
    meta.className = "meta";
    const name = document.createElement("div"); 
    name.className = "name"; 
    name.textContent = c.name;
    meta.append(name);

    btn.append(img, meta);
    frag.appendChild(btn);
  });
  el.pool.replaceChildren(frag);
}

function setStatus(text) {
  el.status.classList.remove("hidden");
  el.status.className = "status";
  el.status.textContent = text;
}

function slotSetImage(slotEl, champ) {
  slotEl.classList.remove("staged");
  slotEl.textContent = "";
  if (!champ) { slotEl.textContent = "-"; return; }
  const img = document.createElement("img");
  img.alt = champ.name;
  img.src = champ.img;
  img.loading = "lazy";
  img.onerror = () => { slotEl.textContent = champ.name; };
  slotEl.appendChild(img);
}

function updateBanSlots() {
  [blue.bans, red.bans].forEach((arr, idx) => {
    const target = idx === 0 ? el.blueBans : el.redBans;
    target.childNodes.forEach((node, i) => { slotSetImage(node, arr[i]); });
  });
}

function updatePickSlots() {
  [blue.picks, red.picks].forEach((arr, idx) => {
    const target = idx === 0 ? el.bluePicks : el.redPicks;
    target.childNodes.forEach((node, i) => { slotSetImage(node, arr[i]); });
  });
}
// ===== 히스토리 =====
function renderHistoryList(arr) {
  const wrap = document.createElement("div");
  wrap.className = "imgs";
  if (!arr || arr.length === 0) {
    const dash = document.createElement("div");
    dash.style.color = "#9ca3af";
    dash.textContent = "-";
    wrap.appendChild(dash);
    return wrap;
  }
  arr.forEach(ch => {
    const img = document.createElement("img");
    img.alt = ch.name;
    img.src = ch.img;
    img.loading = "lazy";
    img.onerror = () => { img.style.display = "none"; };
    wrap.appendChild(img);
  });
  return wrap;
}

function historySetBlock(n, b, r, live) {
  const wrap = document.createElement("div");
  wrap.className = "set";
  const title = document.createElement("div");
  title.className = "set-title";
  title.textContent = live ? `Game ${n} (진행 중/검토 중)` : `Game ${n}`;
  wrap.appendChild(title);

  const row = document.createElement("div");
  row.className = "row";

  const makeLine = (label, bans, picks, side) => {
    const div = document.createElement("div");
    div.className = "team-line";
    div.innerHTML = `<div class="team-name ${side.toLowerCase()}">${label}</div>`;

    const banLine = document.createElement("div");
    banLine.className = "list";
    const banLabel = document.createElement("span"); banLabel.textContent = "BAN:";
    banLine.append(banLabel, renderHistoryList(bans));

    const pickLine = document.createElement("div");
    pickLine.className = "list";
    const pickLabel = document.createElement("span"); pickLabel.textContent = "PICK:";
    pickLine.append(pickLabel, renderHistoryList(picks));

    div.append(banLine, pickLine);
    return div;
  };

  row.append(makeLine("BLUE", b.bans, b.picks, "blue"),
             makeLine("RED",  r.bans, r.picks, "red"));
  wrap.appendChild(row);
  return wrap;
}

function renderHistory() {
  const frag = document.createDocumentFragment();
  results.forEach((g, i) => {
    frag.appendChild(historySetBlock(i + 1, g.blue, g.red, false));
  });

  const seriesEnded =
    results.length === PRESETS[mode].games &&
    isOver() &&
    isCurrentGameEmpty();

  const hasAnyCurrent =
    (blue.bans.length + blue.picks.length + red.bans.length + red.picks.length) > 0;

  if (!seriesEnded && (hasAnyCurrent || isActive())) {
    const liveNo = results.length + 1;
    frag.appendChild(historySetBlock(liveNo, blue, red, !isOver()));
  }
  el.history.replaceChildren(frag);
}

// ==== 후보(스테이징) 표시 ====
function clearStagedUI() {
  $all(".slot.staged").forEach(n => {
    n.classList.remove("staged");
    if (!n.firstChild) n.textContent = "-";
  });
}

function renderStaged() {
  clearStagedUI();
  if (!staged || !isActive()) return;

  const phase = currentPhase();
  const isBlue = phase.side === "BLUE";
  const isBan  = phase.type === "BAN";
  const arr = isBan ? (isBlue ? blue.bans : red.bans) : (isBlue ? blue.picks : red.picks);
  const idx = arr.length;
  const target = (isBlue
    ? (isBan ? el.blueBans : el.bluePicks)
    : (isBan ? el.redBans : el.redPicks)
  ).childNodes[idx];

  if (target) {
    target.classList.add("staged");
    slotSetImage(target, staged);
  }
  setStatus(`${phase.type} — ${phase.side} 후보: ${staged.name} → '챔피언 선택'으로 확정`);
}

// ===== 진행/타이머 =====
function currentPhase() { return PRESETS[mode].rounds[phaseIndex]; }
function isOver()      { return phaseIndex >= PRESETS[mode].rounds.length; }
function isActive()    { return !isOver(); }
function isLastGame()  { return (gameIndex + 1) === PRESETS[mode].games; }

function isCurrentGameEmpty() {
  return (
    blue.bans.length === 0 && blue.picks.length === 0 &&
    red.bans.length  === 0 && red.picks.length  === 0
  );
}

function isIdleBetweenSets() {
  const roundsLen = PRESETS[mode].rounds.length;
  return isCurrentGameEmpty() && (phaseIndex === 0 || phaseIndex >= roundsLen);
}

function startTimer() {
  clearTimer();
  if (!started || !isActive()) return;

  const cfg = PRESETS[mode];
  const phase = currentPhase();

  if (!useTimer) {
    setStatus(`${phase.type} — ${phase.side}`);
    return;
  }

  let left = phase.type === "BAN" ? cfg.banTimer : cfg.pickTimer;
  const label = () => `${phase.type} — ${phase.side} / ⏱ ${left}s`;

  setStatus(label());
  el.status.classList.remove("pulse","pulse-danger");
  void el.status.offsetWidth;
  el.status.classList.add("pulse");

  ticking = setInterval(() => {
    left--;
    setStatus(label());

    el.status.classList.remove("pulse","pulse-danger");
    void el.status.offsetWidth;
    el.status.classList.add(left <= 5 ? "pulse-danger" : "pulse");

    if (left <= 0) {
      if (staged) {
        commitStaged();
      } else {
        setStatus(`${phase.type} — ${phase.side} 시간초과. 후보를 선택해 확정하세요.`);
        clearTimer();
      }
    }
  }, 1000);
}

function clearTimer() { if (ticking) clearInterval(ticking); ticking = null; }

// ==== 후보 선택/확정 ====
function stageChampion(champ) {
  if (!started) { setStatus("시작하기를 먼저 누르세요."); return; }
  if (!isActive()) return;
  if (taken.has(champ.id) || seriesTaken.has(champ.id)) return;
  staged = champ;
  renderStaged();
}

function commitStaged() {
  if (!started) { setStatus("시작하기를 먼저 누르세요."); return; }
  if (!isActive() || !staged || el.confirm.disabled) {
    if (!staged) setStatus("후보가 없습니다. 챔피언을 먼저 클릭하세요.");
    return;
  }

  const phase = currentPhase();
  const isBlue = phase.side === "BLUE";
  const isBan  = phase.type === "BAN";
  const chosen = staged;

  if (isBan) {
    (isBlue ? blue.bans : red.bans).push(chosen);
    updateBanSlots();
  } else {
    (isBlue ? blue.picks : red.picks).push(chosen);
    updatePickSlots();
  }

  taken.add(chosen.id);
  actionLog.push({ kind: phase.type, side: phase.side, champId: chosen.id });

  staged = null;
  renderPool();
  renderHistory();
  advance();
}

function advance() {
  phaseIndex++;
  clearTimer();

  if (isOver()) {
    if (isLastGame()) {
      finalizeAndMaybeNext();
      return;
    } else {
      setStatus(`세트 밴픽 완료. 결과를 확인하고 '${gameIndex + 1}세트 밴픽 종료'를 눌러 진행하세요.`);
      el.confirm.disabled = true;
      el.endGame.disabled = false;
      renderPool();
      renderHistory();
      return;
    }
  }
  renderStaged();
  startTimer();
  renderPool();
  renderHistory();
}

function endCurrentGame() {
  if (isActive()) { 
    setStatus("아직 남은 라운드가 있습니다. 후보를 확정해 진행하세요."); 
    return; 
  }
  finalizeAndMaybeNext();
}

function finalizeAndMaybeNext() {
  [...blue.picks, ...red.picks].forEach(c => seriesTaken.add(c.id));
  results.push({ blue: cloneTeam(blue), red: cloneTeam(red) });

  const total = PRESETS[mode].games;
  if (gameIndex + 1 < total) {
    gameIndex++;
    startGame();
  } else {
    blue = { bans: [], picks: [] };
    red  = { bans: [], picks: [] };
    taken = new Set();
    phaseIndex = PRESETS[mode].rounds.length;
    actionLog = [];
    started = false;

    renderHistory();
    renderSeriesInfo();
    el.endGame.disabled = true;
    el.confirm.disabled = true;
    setStatus("시리즈가 모두 종료되었습니다.");
    setModeEnabled(true);
    clearTimer();
  }
}
// ===== Back helpers =====
function cloneTeam(t){ return { bans: t.bans.slice(), picks: t.picks.slice() }; }

function removeLastFrom(arr, champId) {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i]?.id === champId) { arr.splice(i, 1); break; }
  }
}

function rebuildActionLogFromTeams(b, r) {
  const rounds = PRESETS[mode].rounds;
  const log = [];
  let bi=0, bp=0, ri=0, rp=0;
  for (const rd of rounds) {
    if (rd.type === "BAN") {
      const ch = (rd.side === "BLUE") ? b.bans[bi++] : r.bans[ri++];
      if (ch) log.push({ kind: "BAN", side: rd.side, champId: ch.id });
    } else {
      const ch = (rd.side === "BLUE") ? b.picks[bp++] : r.picks[rp++];
      if (ch) log.push({ kind: "PICK", side: rd.side, champId: ch.id });
    }
  }
  return log;
}

function recalcTakenFromTeams(b, r) {
  return new Set([
    ...b.bans.map(c=>c.id), ...b.picks.map(c=>c.id),
    ...r.bans.map(c=>c.id), ...r.picks.map(c=>c.id),
  ]);
}

function recomputeSeriesTakenFromResults() {
  const st = new Set();
  for (const g of results) {
    [...g.blue.picks, ...g.red.picks].forEach(c => st.add(c.id));
  }
  return st;
}

function backOneSetAndUndo() {
  if (results.length === 0) { setStatus("이전 세트가 없습니다."); return false; }
  const lastGame = results.pop();
  gameIndex = results.length;

  blue = { bans: lastGame.blue.bans.slice(), picks: lastGame.blue.picks.slice() };
  red  = { bans: lastGame.red.bans.slice(),  picks: lastGame.red.picks.slice()  };

  actionLog = rebuildActionLogFromTeams(blue, red);
  const last = actionLog.pop();
  if (last) {
    const arr = (last.kind === "BAN")
      ? (last.side === "BLUE" ? blue.bans : red.bans)
      : (last.side === "BLUE" ? blue.picks : red.picks);
    removeLastFrom(arr, last.champId);
  }

  phaseIndex = actionLog.length;
  staged = null;
  seriesTaken = recomputeSeriesTakenFromResults();
  taken = recalcTakenFromTeams(blue, red);

  started = true;
  setModeEnabled(false);
  el.start.disabled = true;
  el.confirm.disabled = false;
  el.endGame.disabled = isLastGame();

  clearTimer();
  initSlots(); updateBanSlots(); updatePickSlots();
  renderPool(); renderSeriesInfo(); renderHistory(); renderStaged();
  startTimer();

  setStatus(`Game ${gameIndex + 1}의 마지막 행동을 취소했습니다. 계속 수정하세요.`);
  return true;
}

function undoLastAction() {
  if (!started && results.length === 0) { setStatus("시작하기를 먼저 누르세요."); return; }

  if (!started && results.length > 0 && isCurrentGameEmpty()) {
    backOneSetAndUndo();
    return;
  }

  const betweenSets = isIdleBetweenSets();
  const noCurrentActions =
    actionLog.length === 0 &&
    blue.bans.length === 0 && blue.picks.length === 0 &&
    red.bans.length  === 0 && red.picks.length  === 0;

  if (betweenSets && noCurrentActions && results.length > 0) {
    backOneSetAndUndo();
    return;
  }

  if (!actionLog.length) { setStatus("되돌릴 항목이 없습니다."); return; }

  const last = actionLog.pop();
  if (phaseIndex > 0) phaseIndex--;

  const arr = (last.kind === "BAN")
    ? (last.side === "BLUE" ? blue.bans : red.bans)
    : (last.side === "BLUE" ? blue.picks : red.picks);

  removeLastFrom(arr, last.champId);
  taken = recalcTakenFromTeams(blue, red);

  el.confirm.disabled = false;
  el.endGame.disabled = isLastGame();

  clearTimer();
  staged = null;
  initSlots(); updateBanSlots(); updatePickSlots();
  renderPool(); renderHistory(); renderStaged();
  startTimer();

  setStatus(`${last.kind} — ${last.side} 취소됨. 다시 선택하세요.`);
}

function backSeries() { undoLastAction(); }

// ===== 시리즈/게임 제어 =====
function startSeries() {
  clearTimer();
  started = true;
  gameIndex = 0; seriesTaken = new Set(); results = [];
  phaseIndex = 0; blue = { bans:[], picks:[] }; red = { bans:[], picks:[] };
  taken = new Set(); staged = null; actionLog = [];
  initSlots(); updateBanSlots(); updatePickSlots();
  renderPool(); renderSeriesInfo(); renderHistory();
  el.start.disabled = true; el.endGame.disabled = PRESETS[mode].games === 1; el.confirm.disabled = false;
  setModeEnabled(false);
  startTimer();
  el.endGame.disabled = isLastGame();
}

function startGame() {
  clearTimer();
  started = true;
  phaseIndex = 0; blue = { bans:[], picks:[] }; red = { bans:[], picks:[] };
  taken = new Set(); staged = null; actionLog = [];
  initSlots(); updateBanSlots(); updatePickSlots();
  renderPool(); renderSeriesInfo(); renderHistory();
  el.start.disabled = true; el.endGame.disabled = (gameIndex + 1 === PRESETS[mode].games); el.confirm.disabled = false;
  startTimer();
  el.endGame.disabled = isLastGame();
}

function resetSeries() {
  clearTimer();
  started = false;
  el.status.classList.remove("pulse","pulse-danger");
  setStatus("리셋 완료");
  actionLog = [];
  gameIndex = 0; seriesTaken = new Set(); results = [];
  phaseIndex = 0; blue = { bans:[], picks:[] }; red  = { bans:[], picks:[] };
  taken = new Set(); staged = null;

  initSlots(); updateBanSlots(); updatePickSlots();
  renderPool(); renderSeriesInfo(); renderHistory();

  el.start.disabled   = false;
  el.endGame.disabled = true;
  el.confirm.disabled = true;
  setModeEnabled(true);
}

// ===== 이벤트 =====
$all('input[name="mode"]').forEach(r => {
  r.addEventListener("change", e => {
    mode = e.target.value;
    renderSeriesInfo(); renderHistory();
  });
});

el.chkTimer.addEventListener("change", e => {
  useTimer = e.target.checked;
  clearTimer();
  if (started) startTimer();
  else {
    el.status.classList.remove("pulse","pulse-danger");
    setStatus("모드를 선택하고 '시작하기'를 누르세요");
  }
});

el.start.addEventListener("click", startSeries);
el.reset.addEventListener("click", resetSeries);
el.back.addEventListener("click", backSeries);
el.confirm.addEventListener("click", commitStaged);
el.endGame.addEventListener("click", endCurrentGame);

el.search.addEventListener("input", e => { q = e.target.value || ""; renderPool(); });

// 단축키
window.addEventListener("keydown", (e) => {
  const key = e.key.toLowerCase();
  const map = { "1":0,"2":1,"3":2,"4":3,"5":4,"6":5,"7":6,"8":7,"9":8,"0":9 };
  if (map.hasOwnProperty(key)) {
    const idx = map[key];
    const btns = Array.from(el.pool.querySelectorAll("button")).filter(b => !b.disabled);
    const btn = btns[idx]; if (btn) btn.click();
    return;
  }
  if (key === " " || key === "enter") { e.preventDefault(); commitStaged(); return; }
  if (key === "b") { backSeries(); return; }
  if (key === "r") { resetSeries(); return; }
});

// ====== DDragon에서 챔피언 이미지 로드 ======
async function loadChampions() {
  try {
    const vRes = await fetch("https://ddragon.leagueoflegends.com/api/versions.json");
    const versions = await vRes.json();
    PATCH = versions[0];

    const cRes = await fetch(`${CDN_BASE}/${PATCH}/data/${LOCALE}/champion.json`);
    const data = await cRes.json();

    CHAMPS = Object.values(data.data)
      .map(d => ({
        id: d.id,
        name: d.name,
        img: `${CDN_BASE}/${PATCH}/img/champion/${d.id}.png`,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "ko"));
  } catch (err) {
    console.warn("DDragon 로딩 실패. 폴백 텍스트 목록 사용", err);
    CHAMPS = [
      { id:"Aatrox", name:"아트록스", img:"" },
      { id:"Ahri", name:"아리", img:"" },
      { id:"Akali", name:"아칼리", img:"" },
      { id:"LeeSin", name:"리 신", img:"" },
      { id:"Ashe", name:"애쉬", img:"" },
    ];
  }
  renderPool();
  setStatus("모드를 선택하고 '시작하기'를 누르세요");
  el.start.disabled = false;
}

function setModeEnabled(enabled) {
  $all('input[name="mode"]').forEach(r => r.disabled = !enabled);
}

function boot() {
  el.start.disabled = true;
  initSlots();
  renderSeriesInfo();
  renderHistory();
  setStatus("챔피언 이미지 불러오는 중...");
  loadChampions();
}
boot();
