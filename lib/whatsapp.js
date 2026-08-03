// Envio de mensagens WhatsApp. Suporta Twilio (padrão) e Meta Cloud API.
// Troca pelo WHATSAPP_PROVIDER ('twilio' | 'meta').

const PROVIDER = process.env.WHATSAPP_PROVIDER || 'twilio';

/* ---------------- Twilio ---------------- */
function twilioFrom() {
  const f = process.env.TWILIO_WHATSAPP_FROM || '';
  return f.startsWith('whatsapp:') ? f : `whatsapp:${f}`;
}
function toWhatsapp(to) {
  const digits = String(to).replace(/[^\d]/g, '');
  return `whatsapp:+${digits}`;
}
async function twilioSend(to, text) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const body = new URLSearchParams({ From: twilioFrom(), To: toWhatsapp(to), Body: text });
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });
  if (!res.ok) {
    console.error('Falha Twilio:', res.status, await res.text());
    return false;
  }
  return true;
}

/* ---------------- Meta Cloud API ---------------- */
const GRAPH_VERSION = process.env.GRAPH_API_VERSION || 'v23.0';
function metaEndpoint() {
  return `https://graph.facebook.com/${GRAPH_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
}
function metaHeaders() {
  return { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' };
}
async function metaSend(to, text) {
  const res = await fetch(metaEndpoint(), {
    method: 'POST', headers: metaHeaders(),
    body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: text, preview_url: false } }),
  });
  if (!res.ok) { console.error('Falha Meta:', res.status, await res.text()); return false; }
  return true;
}
async function metaSendTemplate(to, name, lang, params = []) {
  const components = params.length ? [{ type: 'body', parameters: params.map((v) => ({ type: 'text', text: String(v) })) }] : [];
  const res = await fetch(metaEndpoint(), {
    method: 'POST', headers: metaHeaders(),
    body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'template', template: { name, language: { code: lang }, components } }),
  });
  if (!res.ok) { console.error('Falha template Meta:', res.status, await res.text()); return false; }
  return true;
}

/* ---------------- API pública ---------------- */
export async function sendWhatsApp(to, text) {
  return PROVIDER === 'meta' ? metaSend(to, text) : twilioSend(to, text);
}

export async function sendWhatsAppTemplate(to, templateName, languageCode, bodyParams = []) {
  if (PROVIDER === 'meta') return metaSendTemplate(to, templateName, languageCode, bodyParams);
  // Twilio sandbox: sem template aprovado; manda o resumo como texto simples.
  const [mes, total, n, cat] = bodyParams;
  return twilioSend(to, `Resumo de ${mes || ''}: total ${total || ''} em ${n || ''} lançamentos. Maior categoria: ${cat || ''}.`);
}

export { PROVIDER };
