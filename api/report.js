import { buildReport, buildReportData } from '../lib/report.js';
import { sendWhatsApp, sendWhatsAppTemplate } from '../lib/whatsapp.js';
import { listActiveUsers } from '../lib/users.js';

// Vercel Cron. Percorre todos os usuários ativos e manda o resumo de cada um.
// Oficial (fora da janela de 24h) exige template; WHATSAPP_USE_TEMPLATE=false
// força texto livre (útil em teste dentro da janela ou com Evolution API).

export default async function handler(req, res) {
  const auth = req.headers['authorization'];
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).end();
  }

  const useTemplate = process.env.WHATSAPP_USE_TEMPLATE !== 'false';
  const templateName = process.env.REPORT_TEMPLATE_NAME || 'resumo_mensal';
  const templateLang = process.env.REPORT_TEMPLATE_LANG || 'pt_BR';

  const users = await listActiveUsers();
  let sent = 0;

  for (const u of users) {
    try {
      if (useTemplate) {
        const d = await buildReportData(u.id);
        if (d.count === 0) continue; // não incomoda quem não gastou nada
        const params = [d.monthName, d.totalStr, String(d.count), d.topCategory];
        const ok = await sendWhatsAppTemplate(u.phone, templateName, templateLang, params);
        if (ok) sent += 1;
      } else {
        const text = await buildReport(u.id);
        const ok = await sendWhatsApp(u.phone, text);
        if (ok) sent += 1;
      }
    } catch (e) {
      console.error('Falha no relatório do usuário', u.id, e);
    }
  }

  return res.status(200).json({ users: users.length, sent, mode: useTemplate ? 'template' : 'text' });
}
