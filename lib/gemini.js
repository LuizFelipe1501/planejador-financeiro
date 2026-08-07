// Interpreta texto ou imagem e devolve transações (entrada/saída) estruturadas.

export const EXPENSE_CATEGORIES = [
  'alimentação', 'transporte', 'moradia', 'lazer', 'saúde',
  'educação', 'compras', 'assinaturas', 'contas', 'outros',
];
export const INCOME_CATEGORIES = [
  'salário', 'freelance', 'vendas', 'investimentos', 'transferência', 'presente', 'outros',
];
export const CATEGORIES = EXPENSE_CATEGORIES; // compat

function normalizeCategory(kind, category) {
  const set = kind === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  return set.includes(category) ? category : 'outros';
}

const TX_SCHEMA = {
  type: 'object',
  properties: {
    is_transaction: { type: 'boolean', description: 'true se a mensagem descreve dinheiro que entrou ou saiu, com valor' },
    kind: { type: 'string', enum: ['expense', 'income'], description: 'expense = gasto/saída; income = recebimento/entrada' },
    amount: { type: 'number', description: 'valor em reais, positivo, só o número' },
    category: { type: 'string', description: 'categoria mais provável' },
    description: { type: 'string', description: 'descrição curta (estabelecimento, fonte ou item)' },
    occurred_at: { type: 'string', description: 'data YYYY-MM-DD, resolvendo termos como "ontem"' },
  },
  required: ['is_transaction'],
};

export async function parseExpense(text) {
  const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
  const today = new Date().toISOString().slice(0, 10);

  const prompt = [
    `Hoje é ${today} (fuso de Brasília).`,
    'Você extrai transações financeiras pessoais de mensagens. Devolva JSON.',
    'kind="expense" para GASTO/saída de dinheiro (ex.: "mercado 45", "uber 22", "paguei 80 no ifood").',
    'kind="income" para ENTRADA/recebimento (ex.: "recebi 1300 do estágio", "+500 venda", "salário 3000", "caiu 200 de pix").',
    'Sinais de entrada: recebi, ganhei, caiu, entrou, salário, pagamento, venda, "+valor".',
    `Categorias de gasto: ${EXPENSE_CATEGORIES.join(', ')}.`,
    `Categorias de entrada: ${INCOME_CATEGORIES.join(', ')}.`,
    'Se não descrever transação com valor, is_transaction=false.',
    'Resolva datas relativas; sem data, use hoje. Descrição curta, sem repetir o valor.',
    '', `Mensagem: "${text}"`,
  ].join('\n');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: TX_SCHEMA },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);

  const data = await res.json();
  const jsonText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!jsonText) throw new Error('Gemini não retornou conteúdo');
  const parsed = JSON.parse(jsonText);

  if (parsed.is_transaction) {
    parsed.kind = parsed.kind === 'income' ? 'income' : 'expense';
    parsed.amount = Number(parsed.amount);
    if (!parsed.amount || parsed.amount <= 0) parsed.is_transaction = false;
    parsed.category = normalizeCategory(parsed.kind, parsed.category);
    if (!parsed.occurred_at || !/^\d{4}-\d{2}-\d{2}$/.test(parsed.occurred_at)) parsed.occurred_at = today;
  }
  // compat com código antigo
  parsed.is_expense = parsed.is_transaction;
  return parsed;
}

// ---- Print de extrato/fatura: extrai entradas E saídas ----
const IMAGE_SCHEMA = {
  type: 'object',
  properties: {
    transactions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: ['expense', 'income'] },
          amount: { type: 'number' },
          category: { type: 'string' },
          description: { type: 'string' },
          occurred_at: { type: 'string' },
        },
        required: ['amount', 'kind'],
      },
    },
  },
  required: ['transactions'],
};

export async function parseExpensesFromImage(base64, mimeType) {
  const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
  const today = new Date().toISOString().slice(0, 10);

  const prompt = [
    `Hoje é ${today} (fuso de Brasília).`,
    'A imagem é um extrato/fatura de banco ou app financeiro.',
    'Extraia TODOS os lançamentos. Para cada um: kind="expense" se for saída/débito/compra/pagamento; kind="income" se for entrada/crédito/recebimento/transferência recebida.',
    'IGNORE apenas linhas de saldo e totais.',
    'amount = valor positivo em reais. category apropriada. description curta. occurred_at YYYY-MM-DD (sem ano, use o atual; sem data, hoje).',
    'Sem lançamentos reconhecíveis: transactions = [].',
  ].join('\n');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
    body: JSON.stringify({
      contents: [{ parts: [
        { inline_data: { mime_type: mimeType || 'image/jpeg', data: base64 } },
        { text: prompt },
      ] }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: IMAGE_SCHEMA },
    }),
  });
  if (!res.ok) throw new Error(`Gemini visão ${res.status}: ${await res.text()}`);

  const data = await res.json();
  const jsonText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!jsonText) return [];
  let parsed;
  try { parsed = JSON.parse(jsonText); } catch { return []; }
  const list = Array.isArray(parsed?.transactions) ? parsed.transactions : [];
  return list
    .map((e) => {
      const kind = e.kind === 'income' ? 'income' : 'expense';
      return {
        kind,
        amount: Number(e.amount),
        category: normalizeCategory(kind, e.category),
        description: (e.description || '').slice(0, 120) || null,
        occurred_at: /^\d{4}-\d{2}-\d{2}$/.test(e.occurred_at) ? e.occurred_at : today,
      };
    })
    .filter((e) => e.amount > 0);
}
