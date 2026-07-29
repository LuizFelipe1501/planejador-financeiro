// Interpreta uma mensagem de texto solta e devolve um gasto estruturado.
// Usa o structured output do Gemini (responseSchema) para garantir JSON válido.

export const CATEGORIES = [
  'alimentação',
  'transporte',
  'moradia',
  'lazer',
  'saúde',
  'educação',
  'compras',
  'assinaturas',
  'contas',
  'outros',
];

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    is_expense: {
      type: 'boolean',
      description: 'true se a mensagem descreve um gasto/compra com um valor',
    },
    amount: {
      type: 'number',
      description: 'valor gasto em reais, apenas o número',
    },
    category: {
      type: 'string',
      enum: CATEGORIES,
      description: 'categoria mais provável do gasto',
    },
    description: {
      type: 'string',
      description: 'descrição curta do que foi comprado (ex.: "iFood", "Uber", "mercado")',
    },
    occurred_at: {
      type: 'string',
      description: 'data do gasto no formato YYYY-MM-DD, resolvendo termos como "ontem"',
    },
  },
  required: ['is_expense'],
};

export async function parseExpense(text) {
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
  const today = new Date().toISOString().slice(0, 10);

  const prompt = [
    `Hoje é ${today} (fuso de Brasília).`,
    'Você é um extrator de gastos pessoais. Leia a mensagem do usuário e devolva o gasto em JSON.',
    'Se a mensagem não descrever um gasto com valor, retorne is_expense=false e nada mais.',
    'Resolva datas relativas: "ontem", "anteontem", "sexta passada" viram uma data YYYY-MM-DD.',
    'Se nenhuma data for citada, use a data de hoje.',
    'A descrição deve ser curta (o estabelecimento ou item), sem repetir o valor.',
    '',
    `Mensagem: "${text}"`,
  ].join('\n');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': process.env.GEMINI_API_KEY,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0,
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
      },
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Gemini ${res.status}: ${detail}`);
  }

  const data = await res.json();
  const jsonText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!jsonText) throw new Error('Gemini não retornou conteúdo');

  const parsed = JSON.parse(jsonText);

  // Normaliza campos
  if (parsed.is_expense) {
    parsed.amount = Number(parsed.amount);
    if (!parsed.amount || parsed.amount <= 0) parsed.is_expense = false;
    if (!CATEGORIES.includes(parsed.category)) parsed.category = 'outros';
    if (!parsed.occurred_at || !/^\d{4}-\d{2}-\d{2}$/.test(parsed.occurred_at)) {
      parsed.occurred_at = today;
    }
  }

  return parsed;
}
