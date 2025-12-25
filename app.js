const qEl = document.getElementById("q");
const categoryEl = document.getElementById("category");
const viewEl = document.getElementById("view");

const offlineStatus = document.getElementById("offlineStatus");
const offlineBar = document.getElementById("offlineBar");
const offlineDetail = document.getElementById("offlineDetail");

const onlinePill = document.getElementById("onlinePill");
const verPill = document.getElementById("verPill");

const btnCheck = document.getElementById("btnCheck");
const btnDiff = document.getElementById("btnDiff");
const btnFull = document.getElementById("btnFull");

let TERMS = [];
let DATA_VERSION = 0;

function setOnlinePill() {
  const on = navigator.onLine;
  onlinePill.textContent = on ? "online" : "offline";
  onlinePill.style.borderColor = on ? "#d8f5d8" : "#ffe1e1";
  onlinePill.style.background = on ? "#f2fff2" : "#fff5f5";
}
window.addEventListener("online", setOnlinePill);
window.addEventListener("offline", setOnlinePill);
setOnlinePill();

function setProgress(pct, text, detail = "") {
  offlineBar.style.width = `${pct}%`;
  offlineStatus.textContent = text;
  offlineDetail.textContent = detail;
}

function escapeHtml(s) {
  return (s ?? "").toString().replace(/[&<>"']/g, (c) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"
  }[c]));
}

// imageVersionをURLに反映（同名上書きでも確実に更新）
function imageUrl(termObj) {
  const v = termObj.imageVersion ?? 1;
  return `${termObj.imagePath}?v=${encodeURIComponent(v)}`;
}

function buildCategories() {
  const set = new Set();
  for (const t of TERMS) if (t.category) set.add(t.category);
  const cats = Array.from(set).sort((a,b)=>a.localeCompare(b,"ja"));

  // 既存optionを再構築
  categoryEl.innerHTML = `<option value="">カテゴリ：すべて</option>` +
    cats.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
}

function filteredTerms() {
  const q = qEl.value.trim().toLowerCase();
  const cat = categoryEl.value;

  return TERMS.filter(t => {
    if (cat && t.category !== cat) return false;
    if (!q) return true;
    return (
      (t.term || "").toLowerCase().includes(q) ||
      (t.summary || "").toLowerCase().includes(q) ||
      (t.category || "").toLowerCase().includes(q) ||
      (t.id || "").toLowerCase().includes(q)
    );
  });
}

function renderList() {
  const items = filteredTerms();

  viewEl.innerHTML = items.slice(0, 300).map(t => `
    <div class="row" data-id="${escapeHtml(t.id)}">
      <div class="term">${escapeHtml(t.term)}</div>
      <div class="muted">${escapeHtml(t.category || "")} / ${escapeHtml((t.summary || "").slice(0, 80))}</div>
    </div>
  `).join("");

  for (const row of viewEl.querySelectorAll(".row")) {
    row.addEventListener("click", () => {
      const id = row.getAttribute("data-id");
      const item = TERMS.find(x => x.id === id);
      if (item) renderDetail(item);
    });
  }
}

function renderDetail(t) {
  const url = imageUrl(t);
  viewEl.innerHTML = `
    <button id="backBtn">← 戻る</button>
    <h2 style="margin:12px 0 6px;">${escapeHtml(t.term)}</h2>
    <div class="muted">${escapeHtml(t.category || "")}</div>
    <p style="line-height:1.5;">${escapeHtml(t.summary || "")}</p>
    <img src="${url}" alt="${escapeHtml(t.term)}">
    <div class="small" style="margin-top:8px;">id=${escapeHtml(t.id)} / imageVersion=${escapeHtml(t.imageVersion)}</div>
  `;
  document.getElementById("backBtn").addEventListener("click", renderList);
  window.scrollTo({ top: 0 });
}

async function fetchTermsJson({ bypassCache = true } = {}) {
  // 更新検知のため、terms.jsonはできるだけ最新を取りにいく
  const url = bypassCache ? `terms.json?ts=${Date.now()}` : `terms.json`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`terms.json fetch failed: ${res.status}`);
  const data = await res.json();

  const dv = data.dataVersion ?? 0;
  const terms = data.terms ?? [];
  return { dataVersion: dv, terms };
}

function currentManifestSnapshot(terms) {
  // どの画像が必要かを確定するためのスナップショット（差分判定用）
  // id->imageVersion と dataVersion を保存しておく
  const map = {};
  for (const t of terms) {
    map[t.id] = {
      imagePath: t.imagePath,
      imageVersion: t.imageVersion ?? 1
    };
  }
  return map;
}

function loadLocalSnapshot() {
  try {
    return JSON.parse(localStorage.getItem("snapshot_v1") || "null");
  } catch {
    return null;
  }
}

function saveLocalSnapshot({ dataVersion, snapshot }) {
  localStorage.setItem("dataVersion_v1", String(dataVersion));
  localStorage.setItem("snapshot_v1", JSON.stringify(snapshot));
}

function getLocalDataVersion() {
  const v = localStorage.getItem("dataVersion_v1");
  return v ? Number(v) : 0;
}

function diffImageUrls(newTerms, oldSnapshot) {
  // 追加/更新が必要な画像URL（?v=付き）だけ返す
  const urls = [];
  for (const t of newTerms) {
    const old = oldSnapshot?.[t.id];
    const newV = t.imageVersion ?? 1;

    // 新規 or バージョンが上がった or パスが変わった
    const changed = !old || old.imageVersion !== newV || old.imagePath !== t.imagePath;
    if (changed) urls.push(imageUrl(t));
  }
  return urls;
}

async function ensureSW() {
  if (!("serviceWorker" in navigator)) {
    setProgress(0, "Service Worker非対応", "このブラウザではオフライン動作ができない");
    return false;
  }

  await navigator.serviceWorker.register("sw.js");
  await navigator.serviceWorker.ready;

  // controllerが付くまで初回はリロードが必要なことがある
  if (!navigator.serviceWorker.controller) {
    setProgress(0, "初回設定中", "一度だけ自動リロードする");
    setTimeout(() => location.reload(), 600);
    return false;
  }

  navigator.serviceWorker.addEventListener("message", (ev) => {
    const msg = ev.data || {};
    if (msg.type === "CACHE_PROGRESS") {
      const pct = msg.total > 0 ? Math.floor((msg.done / msg.total) * 100) : 0;
      setProgress(pct, msg.title || "キャッシュ中", `${msg.done}/${msg.total} 画像`);
    } else if (msg.type === "CACHE_DONE") {
      setProgress(100, msg.title || "完了", msg.detail || "オフラインで利用できる");
    } else if (msg.type === "CACHE_ERROR") {
      setProgress(0, "途中で止まった", msg.detail || "もう一度実行すれば続きから入る");
    } else if (msg.type === "CACHE_CLEARED") {
      setProgress(0, "キャッシュを消した", "完全再キャッシュの準備OK");
    }
  });

  return true;
}

function postToSW(message) {
  navigator.serviceWorker.controller.postMessage(message);
}

async function initApp() {
  const ok = await ensureSW();
  if (!ok) return;

  // terms.json読み込み
  const { dataVersion, terms } = await fetchTermsJson();
  DATA_VERSION = dataVersion;
  TERMS = terms;

  verPill.textContent = `dataVersion: ${DATA_VERSION}`;
  buildCategories();
  renderList();

  // 初回（またはデータ更新後）の自動キャッシュ
  await autoCacheIfNeeded({ forceFull: false });
}

async function autoCacheIfNeeded({ forceFull = false } = {}) {
  const localV = getLocalDataVersion();
  const oldSnapshot = loadLocalSnapshot();

  const { dataVersion, terms } = await fetchTermsJson();
  DATA_VERSION = dataVersion;
  TERMS = terms;
  verPill.textContent = `dataVersion: ${DATA_VERSION}`;
  buildCategories();
  renderList();

  const newSnapshot = currentManifestSnapshot(TERMS);

  // 初回：全部キャッシュ
  const isFirst = !oldSnapshot || localV === 0;

  // 更新あり（dataVersionが上がった）なら差分更新
  const hasUpdate = DATA_VERSION !== localV;

  if (forceFull || isFirst) {
    const urlsAll = TERMS.map(imageUrl);
    setProgress(0, "初回/全量キャッシュ開始", `${urlsAll.length}枚（画面を開いたまま）`);
    postToSW({ type: "CACHE_URLS", title: "全量キャッシュ中", urls: urlsAll });

    // スナップショット更新（キャッシュ開始時点で保存しておく）
    saveLocalSnapshot({ dataVersion: DATA_VERSION, snapshot: newSnapshot });
    return;
  }

  if (hasUpdate) {
    const urlsDiff = diffImageUrls(TERMS, oldSnapshot);
    if (urlsDiff.length === 0) {
      setProgress(100, "更新あり（画像差分なし）", "テキスト更新のみ。オフラインOK");
      saveLocalSnapshot({ dataVersion: DATA_VERSION, snapshot: newSnapshot });
      return;
    }
    setProgress(0, "差分キャッシュ開始", `${urlsDiff.length}枚（追加/更新分のみ）`);
    postToSW({ type: "CACHE_URLS", title: "差分キャッシュ中", urls: urlsDiff });

    saveLocalSnapshot({ dataVersion: DATA_VERSION, snapshot: newSnapshot });
    return;
  }

  // 変更なし
  setProgress(100, "キャッシュ済み", "変更なし。オフラインOK");
}

btnCheck.addEventListener("click", async () => {
  try {
    const localV = getLocalDataVersion();
    const { dataVersion } = await fetchTermsJson();
    const msg = (dataVersion === localV)
      ? `更新なし（dataVersion=${dataVersion}）`
      : `更新あり（local=${localV} → remote=${dataVersion}）`;
    setProgress(100, "更新チェック完了", msg);
  } catch (e) {
    setProgress(0, "更新チェック失敗", String(e));
  }
});

btnDiff.addEventListener("click", async () => {
  try {
    await autoCacheIfNeeded({ forceFull: false });
  } catch (e) {
    setProgress(0, "差分更新失敗", String(e));
  }
});

btnFull.addEventListener("click", async () => {
  try {
    // キャッシュを消して全量再キャッシュ
    setProgress(0, "キャッシュ削除中", "少し待って");
    postToSW({ type: "CLEAR_CACHES" });

    // 少し待ってから全量キャッシュ
    setTimeout(async () => {
      try {
        await autoCacheIfNeeded({ forceFull: true });
      } catch (e) {
        setProgress(0, "完全再キャッシュ失敗", String(e));
      }
    }, 600);
  } catch (e) {
    setProgress(0, "完全再キャッシュ失敗", String(e));
  }
});

qEl.addEventListener("input", renderList);
categoryEl.addEventListener("change", renderList);

// 起動
initApp().catch(e => setProgress(0, "起動失敗", String(e)));
