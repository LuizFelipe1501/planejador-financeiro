import { buildReport, buildReportData } from '../lib/report.js';
import { sendWhatsApp, sendWhatsAppTemplate } from '../lib/whatsapp.js';

// Disparada pelo Vercel Cron (ver vercel.json). O Vercel invoca via GET e injeta
// o header Authorization: Bearer <CRON_SECRET> se você tiver setado CRON_SECRET.
//
// Como este envio parte do bot (fora da janela de 24h), no WhatsApp OFICIAL ele
// precisa de um TEMPLATE utility aprovado. Variáveis de template não aceitam
// quebra de linha, então mandamos os números-chave; o detalhe completo o usuário
// vê no painel ou respondendo "relatório" (aí abre a janela e vale texto livre).
//
// WHATSAPP_USE_TEMPLATE=false força texto livre (para testes dentro da janela ou
// para Evolution API, que não tem essa restrição).

export default async function handler(req, res) {
  const auth = req.headers['authorization'];
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).end();
  }

  const recipients = (process.env.REPORT_RECIPIENTS || process.env.ALLOWED_NUMBERS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const useTemplate = process.env.WHATSAPP_USE_TEMPLATE !== 'false';
  const templateName = process.env.REPORT_TEMPLATE_NAME || 'resumo_mensal';
  const templateLang = process.env.REPORT_TEMPLATE_LANG || 'pt_BR';

  let sent = 0;

  if (useTemplate) {
    const d = await buildReportData();
    // Ordem das variáveis do template: {{1}} mês, {{2}} total, {{3}} nº, {{4}} categoria
    const params = [d.monthName, d.totalStr, String(d.count), d.topCategory];
    for (const to of recipients) {
      const ok = await sendWhatsAppTemplate(to, templateName, templateLang, params);
      if (ok) sent += 1;
    }
  } else {
    const text = await buildReport();
    for (const to of recipients) {
      const ok = await sendWhatsApp(to, text);
      if (ok) sent += 1;
    }
  }

  return res.status(200).json({ sent, total: recipients.length, mode: useTemplate ? 'template' : 'text' });
}
