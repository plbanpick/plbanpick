// ===== DOM helpers =====
const $ = (sel) => document.querySelector(sel);
const $all = (sel) => Array.from(document.querySelectorAll(sel));
const translations = {
  ko: {
    start: "시작하기",
    back: "Back",
    reset: "Reset",
    confirm: "챔피언 선택 (Enter)",
    endgame: (n) => `${n}세트 밴픽 종료`,
    history: "BanPick History",
    pool: "Champion Pool",
    search: "챔피언 이름/영문 검색...",
    blue: "블루팀",
    red: "레드팀",
    timer: "타이머",
    title: "피어리스룰 BanPick",
    series_info: (n, total) => `${n}세트 / 총 ${total}세트`,

    // 상태 메시지
    status_select_mode: "모드를 선택하고 '시작하기'를 누르세요",
    status_reset_done: "리셋 완료",
    status_series_end: "시리즈가 모두 종료되었습니다.",
    status_set_done: (n) =>
      `세트 밴픽 완료. 결과를 확인하고 '${n}세트 밴픽 종료'를 눌러 진행하세요.`,
    status_start_first: "시작하기를 먼저 누르세요.",
    status_no_candidate: "후보가 없습니다. 챔피언을 먼저 클릭하세요.",
    status_timeout: (type, side) =>
      `${type} — ${side} 시간초과. 후보를 선택해 확정하세요.`,
    status_round_remain: "아직 남은 라운드가 있습니다. 후보를 확정해 진행하세요.",
    status_no_prev_set: "이전 세트가 없습니다.",
    status_no_undo: "되돌릴 항목이 없습니다.",
    status_staged: (type, side, name) =>
      `${type} — ${side} 후보: ${name} → '챔피언 선택'으로 확정`,
    status_undo_done: (type, side) =>
      `${type} — ${side} 취소됨. 다시 선택하세요.`,
    status_back_undo: (n) =>
      `Game ${n}의 마지막 행동을 취소했습니다. 계속 수정하세요.`,

    // 공지
    notice: `오류 또는 수정사항 요청은 
      <a href="mailto:contact@plbanpick.com">contact@plbanpick.com</a> 
      으로 보내주세요.`
  },

  en: {
    start: "Start",
    back: "Back",
    reset: "Reset",
    confirm: "Confirm Champion (Enter)",
    endgame: (n) => `End Game ${n} BanPick`,
    history: "BanPick History",
    pool: "Champion Pool",
    search: "Search champion name...",
    blue: "BLUE",
    red: "RED",
    timer: "Timer",
    title: "Peerless Rule BanPick",
    series_info: (n, total) => `Game ${n} / ${total}`,

    // 상태 메시지
    status_select_mode: "Select a mode and press 'Start'",
    status_reset_done: "Reset complete",
    status_series_end: "The series has ended.",
    status_set_done: (n) =>
      `Set complete. Check results and press 'End Game ${n} BanPick' to continue.`,
    status_start_first: "Press 'Start' first.",
    status_no_candidate: "No candidate. Please select a champion first.",
    status_timeout: (type, side) =>
      `${type} — ${side} timeout. Please select and confirm a champion.`,
    status_round_remain: "There are remaining rounds. Please confirm to proceed.",
    status_no_prev_set: "No previous set available.",
    status_no_undo: "No actions to undo.",
    status_staged: (type, side, name) =>
      `${type} — ${side} candidate: ${name} → confirm with 'Confirm Champion'`,
    status_undo_done: (type, side) =>
      `${type} — ${side} undone. Please select again.`,
    status_back_undo: (n) =>
      `Last action in Game ${n} was undone. Continue editing.`,

    // 공지
    notice: `For errors or feedback, please contact 
      <a href="mailto:contact@plbanpick.com">contact@plbanpick.com</a>.`
  }
};




let currentLang = "ko";
function setLang(lang) {
  currentLang = lang;
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.dataset.i18n;
    const value = translations[lang][key];
    if (!value) return;

    if (typeof value === "function") {
      el.innerHTML = value(gameIndex + 1, PRESETS[mode].games);
    } else if (el.tagName === "INPUT" && el.placeholder) {
      el.placeholder = value;
    } else {
      el.innerHTML = value;
    }
  });

  // 상태창도 현재 언어로 갱신
  if (!started) {
    setStatus(translations[currentLang].status_select_mode);
  }

  // ✅ 강제 업데이트 추가
  renderSeriesInfo();   // 시리즈 정보 새로 그리기
  renderHistory();      // 히스토리도 새 언어 반영
}





// 기본 언어 설정
document.addEventListener("DOMContentLoaded", () => setLang("ko"));


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
const roleMap = {
  TOP: ["Fighter", "Tank"],
  JUNGLE: ["Assassin", "Fighter", "Tank"],
  MID: ["Mage", "Assassin"],
  ADC: ["Marksman"],
  SUPPORT: ["Support", "Mage"],
};

let currentRole = "ALL";
let championRoles = {};

// championRoles.json 로드
fetch("./championRoles.json")
  .then(res => res.json())
  .then(data => {
    championRoles = data;
    console.log("Champion roles loaded:", championRoles);
    renderPool();   // 데이터가 준비된 후 챔피언 풀 다시 그림
  })
  .catch(err => console.error("championRoles.json 로드 실패:", err));




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
  const n = gameIndex + 1;

  // 시리즈 정보 갱신
  el.seriesInfo.textContent = translations[currentLang].series_info(n, total);

  // ✅ End Game 버튼 텍스트도 여기서 갱신
  el.endGame.textContent = translations[currentLang].endgame(n);

  // 버튼 활성화/비활성화
  el.endGame.disabled = false;
  if (isLastGame()) {
    el.endGame.disabled = true;
  }
}




function filteredChamps() {
  let list = CHAMPS;

  // 검색 필터 (공백 무시)
  if (q) {
    const s = q.toLowerCase().replace(/\s+/g, "");
    list = list.filter(c =>
      c.name.toLowerCase().replace(/\s+/g, "").includes(s) ||
      c.id.toLowerCase().replace(/\s+/g, "").includes(s)
    );
  }

  // 역할 필터
  if (currentRole !== "ALL") {
    list = list.filter(c => {
      const role = championRoles[c.id.toLowerCase()]; // JSON key는 소문자
      if (!role) return false;
      return role.toUpperCase() === currentRole; // 버튼 값은 대문자니까 맞춰줌
    });
  }

  return list;
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

    btn.append(img);
    frag.appendChild(btn);
  });
  el.pool.replaceChildren(frag);
}

// === 여기 아래에 넣기 ===
document.querySelectorAll(".role-filters button").forEach(btn => {
  btn.addEventListener("click", () => {
    currentRole = btn.dataset.role;
    renderPool();
  });
});

// 그다음에 이벤트 리스너들 (el.start.addEventListener...) 이어짐


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
  title.textContent = live ? `Game ${n} ` : `Game ${n}`;
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
  setStatus(translations[currentLang].status_staged(phase.type, phase.side, staged.name));
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
  if (!started) { setStatus(translations[currentLang].status_start_first); return; }
  if (!isActive()) return;
  if (taken.has(champ.id) || seriesTaken.has(champ.id)) return;
  staged = champ;
  renderStaged();
}

function commitStaged() {
  if (!started) { 
    setStatus(translations[currentLang].status_start_first); 
    return; 
  }
  if (!isActive() || !staged || el.confirm.disabled) {
    setStatus(translations[currentLang].status_no_candidate);
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
      setStatus(translations[currentLang].status_set_done(gameIndex + 1));
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
    setStatus(translations[currentLang].status_round_remain);
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
    setStatus(translations[currentLang].status_select_mode);
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
  if (results.length === 0) { 
  setStatus(translations[currentLang].status_no_prev_set); 
  return false; 
}

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

  setStatus(translations[currentLang].status_staged(phase.type, phase.side, staged.name));

  return true;
}

function undoLastAction() {
  if (!started && results.length === 0) { setStatus(translations[currentLang].status_round_remain); }

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

  if (!actionLog.length) { 
  setStatus(translations[currentLang].status_no_undo); 
  return; 
}

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

  setStatus(translations[currentLang].status_staged(phase.type, phase.side, staged.name));
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
  phaseIndex = 0;
  blue = { bans: [], picks: [] };
  red  = { bans: [], picks: [] };
  taken = new Set();
  staged = null;
  actionLog = [];

  initSlots();
  updateBanSlots();
  updatePickSlots();
  renderPool();
  renderSeriesInfo();  // ✅ 이 안에서 endGame 번역이 처리됨
  renderHistory();

  el.start.disabled = true;
  el.endGame.disabled = (gameIndex + 1 === PRESETS[mode].games);
  el.confirm.disabled = false;

  startTimer();
  el.endGame.disabled = isLastGame();
}




function resetSeries() {
  clearTimer();
  started = false;
  el.status.classList.remove("pulse","pulse-danger");
  setStatus(translations[currentLang].status_select_mode);
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
    setStatus(translations[currentLang].status_select_mode);
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
    tags: d.tags // 역할 태그 저장
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
  setStatus(translations[currentLang].status_select_mode);
el.start.disabled = false;
}

function setModeEnabled(enabled) {
  $all('input[name="mode"]').forEach(r => r.disabled = !enabled);
}

// boot() 안
function boot() {
  el.start.disabled = true;
  initSlots();
  renderSeriesInfo();
  renderHistory();
  setStatus(translations[currentLang].status_select_mode); // ✅ 수정
  loadChampions();
}

// resetSeries() 안
function resetSeries() {
  clearTimer();
  started = false;
  el.status.classList.remove("pulse","pulse-danger");
  setStatus(translations[currentLang].status_select_mode); // ✅ 수정
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

boot();

const langBtn = document.getElementById("btnLang");

langBtn.addEventListener("click", () => {
  const next = (currentLang === "ko") ? "en" : "ko";
  setLang(next);

  // 버튼 텍스트도 같이 변경
  langBtn.textContent = (next === "ko") ? "English" : "한국어";
  langBtn.classList.toggle("active", next === "en");
});
