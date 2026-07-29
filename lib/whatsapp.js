// Envio de mensagens via WhatsApp Cloud API (Meta).
//
// Dois modos:
// 1) sendWhatsApp        -> texto livre. GRATUITO e permitido apenas DENTRO da
//    janela de 24h (resposta a uma mensagem que o usuário mandou). É o caso do
//    "Anotado: ..." e do relatório pedido com "relatório".
// 2) sendWhatsAppTemplate -> mensagem de TEMPLATE aprovado. É o único jeito de
//    iniciar conversa FORA da janela de 24h (ex.: o relatório agendado). Tem
//    custo de utility (uns centavos). Precisa do template criado e aprovado.

const GRAPH_VERSION = process.env.GRAPH_API_VERSION || 'v23.0';

function endpoint() {
  return `https://graph.facebook.com/${GRAPH_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
}

function authHeaders() {
  return {
    Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
    'Content-Type': 'application/json',
  };
}

export async function sendWhatsApp(to, text) {
  const res = await fetch(endpoint(), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text, preview_url: false },
    }),
  });
  if (!res.ok) {
    console.error('Falha ao enviar texto WhatsApp:', res.status, await res.text());
    return false;
  }
  return true;
}

// bodyParams: array de strings que preenchem {{1}}, {{2}}, ... do corpo do template.
// IMPORTANTE: variáveis de template não aceitam quebras de linha. Por isso o
// relatório agendado manda só os números-chave; o detalhamento fica no painel
// ou na resposta a "relatório".
export async function sendWhatsAppTemplate(to, templateName, languageCode, bodyParams = []) {
  const components = bodyParams.length
    ? [
        {
          type: 'body',
          parameters: bodyParams.map((v) => ({ type: 'text', text: String(v) })),
        },
      ]
    : [];

  const res = await fetch(endpoint(), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        components,
      },
    }),
  });
  if (!res.ok) {
    console.error('Falha ao enviar template WhatsApp:', res.status, await res.text());
    return false;
  }
  return true;
}
