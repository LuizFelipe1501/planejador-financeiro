const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

// Cores por categoria (consistentes entre gráfico e legenda)
const CAT_COLORS = {
  'alimentação': '#0f6e56',
  'transporte': '#3b8bd4',
  'moradia': '#c8622e',
  'lazer': '#9b5de5',
  'saúde': '#e24b4a',
  'educação': '#ba7517',
  'compras': '#d4537e',
  'assinaturas': '#1d9e75',
  'contas': '#5f5e5a',
  'outros': '#888780',
};
const colorFor = (cat) => CAT_COLORS[cat] || '#888780';

const state = {
  ref: new Date(), // mês de referência
  chart: null,
};

const $ = (id) => document.getElementById(id);
const token = () => sessionStorage.getItem('dash_token');
const monthStr = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

// ---------- Gate ----------
function showApp() {
  $('gate').hidden = true;
  $('app').hidden = false;
  load();
}

async function tryLogin(pwd) {
  sessionStorage.setItem('dash_token', pwd);
  const res = await fetch(`/api/expenses?month=${monthStr(state.ref)}`, {
    headers: { 'x-dashboard-token': pwd },
  });
  if (res.status === 401) {
    sessionStorage.removeItem('dash_token');
    return false;
  }
  return true;
}

$('gate-btn').addEventListener('click', async () => {
  const pwd = $('gate-input').value.trim();
  if (!pwd) return;
  const ok = await tryLogin(pwd);
  if (ok) {
    $('gate-error').hidden = true;
    showApp();
  } else {
    $('gate-error').hidden = false;
  }
});
$('gate-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') $('gate-btn').click();
});

// ---------- Navegação de mês ----------
$('prev-month').addEventListener('click', () => {
  state.ref = new Date(state.ref.getFullYear(), state.ref.getMonth() - 1, 1);
  load();
});
$('next-month').addEventListener('click', () => {
  state.ref = new Date(state.ref.getFullYear(), state.ref.getMonth() + 1, 1);
  load();
});
$('refresh').addEventListener('click', load);
$('logout').addEventListener('click', () => {
  sessionStorage.removeItem('dash_token');
  location.reload();
});

// ---------- Carregar e renderizar ----------
async function load() {
  $('month-label').textContent = state.ref.toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  });

  let data;
  try {
    const res = await fetch(`/api/expenses?month=${monthStr(state.ref)}`, {
      headers: { 'x-dashboard-token': token() },
    });
    if (res.status === 401) {
      location.reload();
      return;
    }
    data = await res.json();
  } catch (e) {
    console.error(e);
    return;
  }

  const expenses = data.expenses || [];
  const total = expenses.reduce((s, r) => s + Number(r.amount), 0);

  $('total').textContent = brl.format(total);
  $('count').textContent = `${expenses.length} lançamento${expenses.length !== 1 ? 's' : ''}`;

  renderCategories(expenses, total);
  renderList(expenses);
}

function renderCategories(expenses, total) {
  const byCat = {};
  for (const r of expenses) {
    byCat[r.category] = (byCat[r.category] || 0) + Number(r.amount);
  }
  const entries = Object.entries(byCat).sort((a, b) => b[1] - a[1]);

  const empty = entries.length === 0;
  $('chart-empty').hidden = !empty;
  $('chart').style.display = empty ? 'none' : 'block';

  // Legenda com leader dots
  $('legend').innerHTML = entries
    .map(([cat, val]) => {
      const pct = total ? Math.round((val / total) * 100) : 0;
      return `<li>
        <span class="dot" style="background:${colorFor(cat)}"></span>
        <span class="cat">${cat}</span>
        <span class="lead"></span>
        <span class="val">${brl.format(val)} · ${pct}%</span>
      </li>`;
    })
    .join('');

  // Gráfico
  if (state.chart) state.chart.destroy();
  if (empty) return;

  state.chart = new Chart($('chart'), {
    type: 'doughnut',
    data: {
      labels: entries.map(([c]) => c),
      datasets: [
        {
          data: entries.map(([, v]) => v),
          backgroundColor: entries.map(([c]) => colorFor(c)),
          borderWidth: 2,
          borderColor: getComputedStyle(document.body).getPropertyValue('--card') || '#fff',
        },
      ],
    },
    options: {
      cutout: '62%',
      plugins: { legend: { display: false } },
      responsive: true,
      maintainAspectRatio: false,
    },
  });
}

function renderList(expenses) {
  $('list-empty').hidden = expenses.length > 0;
  $('list').innerHTML = expenses
    .map((r) => {
      const d = new Date(r.occurred_at + 'T00:00:00');
      const day = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      const desc = r.description || r.category;
      return `<li>
        <span class="day">${day}</span>
        <span class="desc">${desc}<small>${r.category}</small></span>
        <span class="amount">${brl.format(Number(r.amount))}</span>
      </li>`;
    })
    .join('');
}

// ---------- Início ----------
if (token()) {
  showApp();
}

// Service worker (PWA)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
