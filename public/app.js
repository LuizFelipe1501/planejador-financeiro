const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const brl0 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

const CAT = {
  'alimentação': { c: '#3d7bff', e: '🍽️' },
  'transporte':  { c: '#38bdf8', e: '🚗' },
  'moradia':     { c: '#f5934a', e: '🏠' },
  'lazer':       { c: '#b98bff', e: '🎉' },
  'saúde':       { c: '#ff6b6b', e: '💊' },
  'educação':    { c: '#f5c451', e: '📚' },
  'compras':     { c: '#ff7eb6', e: '🛍️' },
  'assinaturas': { c: '#2dd4bf', e: '🔁' },
  'contas':      { c: '#8a94a8', e: '📄' },
  'outros':      { c: '#a0a0aa', e: '•' },
};
const catInfo = (c) => CAT[c] || CAT['outros'];

const state = { ref: new Date(), chart: null };
const $ = (id) => document.getElementById(id);
const monthStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

// ----- Sessão -----
const urlToken = new URLSearchParams(location.search).get('t');
let TOKEN = urlToken || sessionStorage.getItem('cad_token') || null;

function showGate() { $('gate').hidden = false; $('app').hidden = true; }
function showApp() { $('gate').hidden = true; $('app').hidden = false; }

function init() {
  if (TOKEN) { showApp(); load(); }
  else { showGate(); }
}

// ----- Login -----
$('login-btn').addEventListener('click', doLogin);
$('login-pass').addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });
$('login-user').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('login-pass').focus(); });

async function doLogin() {
  const username = $('login-user').value.trim();
  const password = $('login-pass').value;
  if (!username || !password) return;
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) { $('login-error').hidden = false; return; }
    const data = await res.json();
    TOKEN = data.token;
    sessionStorage.setItem('cad_token', TOKEN);
    $('login-error').hidden = true;
    showApp(); load();
  } catch (e) {
    $('login-error').hidden = false;
  }
}

// ----- Navegação / ações -----
$('prev-month').addEventListener('click', () => { state.ref = new Date(state.ref.getFullYear(), state.ref.getMonth() - 1, 1); load(); });
$('next-month').addEventListener('click', () => { state.ref = new Date(state.ref.getFullYear(), state.ref.getMonth() + 1, 1); load(); });
$('refresh').addEventListener('click', load);
$('logout').addEventListener('click', () => {
  sessionStorage.removeItem('cad_token');
  location.href = '/painel';
});

// ----- Carregar dados -----
async function load() {
  const label = state.ref.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  $('month-label').textContent = label;
  $('hero-month').textContent = label;

  let expenses = [];
  try {
    const q = `/api/expenses?month=${monthStr(state.ref)}${TOKEN ? `&t=${encodeURIComponent(TOKEN)}` : ''}`;
    const res = await fetch(q);
    if (res.status === 401) { sessionStorage.removeItem('cad_token'); showGate(); return; }
    if (res.ok) { const data = await res.json(); expenses = data.expenses || []; }
  } catch (e) { console.error(e); }

  const total = expenses.reduce((s, r) => s + Number(r.amount), 0);
  const now = new Date();
  const sameMonth = now.getFullYear() === state.ref.getFullYear() && now.getMonth() === state.ref.getMonth();
  const daysInMonth = new Date(state.ref.getFullYear(), state.ref.getMonth() + 1, 0).getDate();
  const daysElapsed = sameMonth ? now.getDate() : daysInMonth;
  const avg = total / Math.max(1, daysElapsed);

  const byCat = {};
  for (const r of expenses) byCat[r.category] = (byCat[r.category] || 0) + Number(r.amount);
  const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  const topCat = cats.length ? cats[0][0] : '—';
  const topPct = cats.length && total ? Math.round((cats[0][1] / total) * 100) : 0;

  $('total').textContent = brl.format(total);
  $('count').textContent = String(expenses.length);
  $('avg').textContent = brl0.format(avg);
  $('top').textContent = topCat;

  renderInsight(expenses, total, topCat, topPct, avg, cats.length);
  renderFlow(expenses, daysInMonth);
  renderCats(cats, total);
  renderTxns(expenses);
}

function renderInsight(expenses, total, topCat, topPct, avg, nCats) {
  const el = $('insight');
  if (!expenses.length) {
    el.textContent = 'Ainda não há gastos neste mês. Manda o primeiro pelo WhatsApp.';
    return;
  }
  const parts = [];
  parts.push(`<b>${topCat}</b> lidera seus gastos, com <b>${topPct}%</b> do total`);
  parts.push(`Você está gastando em média <b>${brl0.format(avg)}</b> por dia`);
  if (nCats >= 4) parts.push(`espalhados por <b>${nCats}</b> categorias`);
  el.innerHTML = parts.join('. ') + '.';
}

function renderFlow(expenses, daysInMonth) {
  const empty = expenses.length === 0;
  $('flow-empty').hidden = !empty;
  $('flow').style.display = empty ? 'none' : 'block';
  if (state.chart) { state.chart.destroy(); state.chart = null; }
  if (empty) return;

  const daily = new Array(daysInMonth).fill(0);
  for (const r of expenses) {
    const idx = new Date(r.occurred_at + 'T00:00:00').getDate() - 1;
    if (idx >= 0 && idx < daysInMonth) daily[idx] += Number(r.amount);
  }
  const labels = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const ctx = $('flow').getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 170);
  grad.addColorStop(0, 'rgba(61, 123, 255, 0.35)');
  grad.addColorStop(1, 'rgba(61, 123, 255, 0)');

  state.chart = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: [{ data: daily, borderColor: '#3d7bff', backgroundColor: grad, borderWidth: 2, fill: true, tension: 0.35, pointRadius: 0, pointHoverRadius: 4, pointHoverBackgroundColor: '#3d7bff' }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { displayColors: false, callbacks: { title: (i) => `Dia ${i[0].label}`, label: (i) => brl.format(i.parsed.y) } } },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#6b7185', maxTicksLimit: 6, font: { size: 10 } } },
        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#6b7185', font: { size: 10 }, callback: (v) => brl0.format(v), maxTicksLimit: 4 } },
      },
    },
  });
}

function renderCats(cats, total) {
  $('cats-empty').hidden = cats.length !== 0;
  const max = cats.length ? cats[0][1] : 1;
  $('cats').innerHTML = cats.map(([cat, val]) => {
    const info = catInfo(cat);
    const pct = total ? Math.round((val / total) * 100) : 0;
    const w = Math.round((val / max) * 100);
    return `<div class="cat-row">
      <div class="cat-top"><span class="cat-dot" style="background:${info.c}"></span><span class="cat-name">${cat}</span></div>
      <span class="cat-val">${brl.format(val)} · ${pct}%</span>
      <div class="cat-bar"><div class="cat-fill" style="width:${w}%;background:${info.c}"></div></div>
    </div>`;
  }).join('');
}

function renderTxns(expenses) {
  $('list-empty').hidden = expenses.length > 0;
  $('list').innerHTML = expenses.map((r) => {
    const info = catInfo(r.category);
    const day = new Date(r.occurred_at + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
    const desc = r.description || r.category;
    return `<div class="txn">
      <span class="txn-chip" style="background:${info.c}22;border:1px solid ${info.c}55">${info.e}</span>
      <div class="txn-main"><div class="txn-desc">${desc}</div><div class="txn-cat">${r.category}</div></div>
      <div class="txn-right"><div class="txn-amount">${brl.format(Number(r.amount))}</div><div class="txn-day">${day}</div></div>
    </div>`;
  }).join('');
}

// Início
init();

// PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
