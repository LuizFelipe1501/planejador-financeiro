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
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) { $('login-error').hidden = false; return; }
    const data = await res.json();
    TOKEN = data.token;
    sessionStorage.setItem('cad_token', TOKEN);
    $('login-error').hidden = true;
    showApp(); load();
  } catch (e) { $('login-error').hidden = false; }
}

// ----- Navegação / ações -----
$('prev-month').addEventListener('click', () => { state.ref = new Date(state.ref.getFullYear(), state.ref.getMonth() - 1, 1); load(); });
$('next-month').addEventListener('click', () => { state.ref = new Date(state.ref.getFullYear(), state.ref.getMonth() + 1, 1); load(); });
$('refresh').addEventListener('click', load);
$('logout').addEventListener('click', () => { sessionStorage.removeItem('cad_token'); location.href = '/painel'; });

// ----- Carregar dados -----
async function load() {
  const label = state.ref.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  $('month-label').textContent = label;
  $('hero-month').textContent = label;

  let items = [];
  try {
    const q = `/api/expenses?month=${monthStr(state.ref)}${TOKEN ? `&t=${encodeURIComponent(TOKEN)}` : ''}`;
    const res = await fetch(q);
    if (res.status === 401) { sessionStorage.removeItem('cad_token'); showGate(); return; }
    if (res.ok) { const data = await res.json(); items = data.expenses || []; if (data.botNumber) $('wa-fab').href = `https://wa.me/${data.botNumber}`; }
  } catch (e) { console.error(e); }

  const incomes = items.filter((r) => r.kind === 'income');
  const expenses = items.filter((r) => r.kind !== 'income');
  const incomeTotal = incomes.reduce((s, r) => s + Number(r.amount), 0);
  const expenseTotal = expenses.reduce((s, r) => s + Number(r.amount), 0);
  const balance = incomeTotal - expenseTotal;

  $('income').textContent = brl0.format(incomeTotal);
  $('expense').textContent = brl0.format(expenseTotal);
  $('balance').textContent = brl.format(balance);
  $('balance').classList.toggle('neg', balance < 0);

  const byCat = {};
  for (const r of expenses) byCat[r.category] = (byCat[r.category] || 0) + Number(r.amount);
  const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  const daysInMonth = new Date(state.ref.getFullYear(), state.ref.getMonth() + 1, 0).getDate();

  renderInsight(incomeTotal, expenseTotal, balance, cats);
  renderFlow(incomes, expenses, daysInMonth);
  renderCats(cats, expenseTotal);
  renderTxns(items);
}

function renderInsight(income, expense, balance, cats) {
  const el = $('insight');
  if (income === 0 && expense === 0) {
    el.textContent = 'Ainda não há lançamentos neste mês. Manda o primeiro pelo WhatsApp.';
    return;
  }
  const parts = [];
  if (balance >= 0) parts.push(`Você está no azul: sobrou <b>${brl0.format(balance)}</b> no período`);
  else parts.push(`Atenção: saíram <b>${brl0.format(-balance)}</b> a mais do que entraram`);
  if (cats.length && expense) {
    const [c, v] = cats[0];
    parts.push(`<b>${c}</b> é seu maior gasto (<b>${Math.round((v / expense) * 100)}%</b>)`);
  }
  el.innerHTML = parts.join('. ') + '.';
}

function renderFlow(incomes, expenses, daysInMonth) {
  const empty = incomes.length + expenses.length === 0;
  $('flow-empty').hidden = !empty;
  $('flow').style.display = empty ? 'none' : 'block';
  if (state.chart) { state.chart.destroy(); state.chart = null; }
  if (empty) return;

  const dIn = new Array(daysInMonth).fill(0);
  const dOut = new Array(daysInMonth).fill(0);
  const put = (arr, r) => { const i = new Date(r.occurred_at + 'T00:00:00').getDate() - 1; if (i >= 0 && i < daysInMonth) arr[i] += Number(r.amount); };
  incomes.forEach((r) => put(dIn, r));
  expenses.forEach((r) => put(dOut, r));

  const labels = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const ctx = $('flow').getContext('2d');
  const gOut = ctx.createLinearGradient(0, 0, 0, 170);
  gOut.addColorStop(0, 'rgba(61,123,255,0.30)'); gOut.addColorStop(1, 'rgba(61,123,255,0)');
  const gIn = ctx.createLinearGradient(0, 0, 0, 170);
  gIn.addColorStop(0, 'rgba(34,197,94,0.30)'); gIn.addColorStop(1, 'rgba(34,197,94,0)');

  state.chart = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: [
      { label: 'Entradas', data: dIn, borderColor: '#22c55e', backgroundColor: gIn, borderWidth: 2, fill: true, tension: 0.35, pointRadius: 0, pointHoverRadius: 4 },
      { label: 'Saídas', data: dOut, borderColor: '#3d7bff', backgroundColor: gOut, borderWidth: 2, fill: true, tension: 0.35, pointRadius: 0, pointHoverRadius: 4 },
    ] },
    options: {
      responsive: true, maintainAspectRatio: false, interaction: { intersect: false, mode: 'index' },
      plugins: {
        legend: { display: true, position: 'bottom', labels: { color: '#9aa3b4', boxWidth: 10, boxHeight: 10, usePointStyle: true, font: { size: 11 } } },
        tooltip: { callbacks: { title: (i) => `Dia ${i[0].label}`, label: (i) => `${i.dataset.label}: ${brl.format(i.parsed.y)}` } },
      },
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

function renderTxns(items) {
  $('list-empty').hidden = items.length > 0;
  $('list').innerHTML = items.map((r) => {
    const inc = r.kind === 'income';
    const info = inc ? { c: '#22c55e', e: '💰' } : catInfo(r.category);
    const day = new Date(r.occurred_at + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
    const desc = r.description || r.category;
    const amt = `${inc ? '+' : '−'} ${brl.format(Number(r.amount))}`;
    return `<div class="txn">
      <span class="txn-chip" style="background:${info.c}22;border:1px solid ${info.c}55">${info.e}</span>
      <div class="txn-main"><div class="txn-desc">${desc}</div><div class="txn-cat">${r.category}</div></div>
      <div class="txn-right"><div class="txn-amount ${inc ? 'amt-in' : 'amt-out'}">${amt}</div><div class="txn-day">${day}</div></div>
    </div>`;
  }).join('');
}

// Início
init();

// PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
