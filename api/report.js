import { buildReport } from '../lib/report.js';
import { sendWhatsApp } from '../lib/whatsapp.js';

// Disparada pelo Vercel Cron (ver vercel.json).
//
// ATENÇÃO: como este envio parte do bot (não é resposta a você), se você não
// tiver mandado mensagem nas últimas 24h, a Meta exige um TEMPLATE aprovado.
// Para MVP, o caminho garantido é: mande "relatório" quando quiser (grátis,
// dentro da janela). Se quiser o agendado 100% automático no WhatsApp oficial,
// crie um template utility e troque o sendWhatsApp por um envio de template.
// Com Evolution API (não oficial) não há essa restrição.

export default async function handler(req, res) {
  // Protege o endpoint: o Vercel Cron manda Authorization: Bearer <CRON_SECRET>
  const auth = req.headers['authorization'];
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).end();
  }

  const report = await buildReport();

  const recipients = (process.env.REPORT_RECIPIENTS || process.env.ALLOWED_NUMBERS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  let sent = 0;
  for (const to of recipients) {
    const ok = await sendWhatsApp(to, report);
    if (ok) sent += 1;
  }

  return res.status(200).json({ sent, total: recipients.length });
}
