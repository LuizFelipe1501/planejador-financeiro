// Envia texto pelo WhatsApp Cloud API (Meta).
//
// IMPORTANTE sobre a janela de 24h:
// - Respostas a uma mensagem que o usuário mandou nas últimas 24h podem ser
//   texto livre e são GRATUITAS. É o caso do "Anotado: ..." e do relatório
//   pedido sob demanda.
// - Mensagens que VOCÊ inicia fora dessa janela (ex.: o relatório agendado
//   quando você não falou com o bot há mais de 24h) precisam de um TEMPLATE
//   aprovado pela Meta, senão a Meta rejeita o envio. Veja o README.

export async function sendWhatsApp(to, text) {
  const url = `https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text, preview_url: false },
    }),
  });

  if (!res.ok) {
    console.error('Falha ao enviar WhatsApp:', res.status, await res.text());
    return false;
  }
  return true;
}
