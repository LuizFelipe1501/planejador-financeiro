# Caderno de gastos

Planejador financeiro pessoal: você manda seus gastos por texto no WhatsApp, o
Gemini interpreta a mensagem, o gasto cai no Supabase e você acompanha tudo num
dashboard PWA (instalável no celular). Também dá pra pedir um resumo do mês pelo
próprio WhatsApp.

Tudo roda num único deploy na Vercel: front estático em `/public` e funções
serverless em `/api`.

## Arquitetura

```
Você (WhatsApp) → Gateway (Meta Cloud API) → /api/webhook
                                                  ↓ interpreta com Gemini
                                              Supabase (banco)
                                                  ↓
                    ┌─────────────────────────────┼──────────────────────────┐
              Dashboard PWA               /api/report (Cron)            (widget: fase 2)
              (/public + /api/expenses)   → resumo no WhatsApp
```

## Estrutura

```
api/
  webhook.js     recebe mensagens, interpreta e grava
  report.js      relatório agendado (Vercel Cron)
  expenses.js    API que o dashboard consome (protegida por token)
lib/
  gemini.js      parser de gasto (texto → JSON) via Gemini Flash-Lite
  whatsapp.js    envio de mensagens (Meta Cloud API)
  report.js      monta o texto do resumo do mês
  supabase.js    cliente do banco (service role)
public/
  index.html     dashboard
  app.js, styles.css, manifest.json, sw.js, icon.svg
supabase/
  schema.sql     tabela de gastos (rode no Supabase)
vercel.json      configuração do cron
.env.example     variáveis necessárias
```

## Passo a passo

### 1. Supabase (JÁ CONFIGURADO)
O projeto `caderno-gastos` já foi criado (região sa-east-1) e a tabela
`expenses` já está de pé com RLS. Você só precisa de uma coisa: pegar a
`service_role key` em Settings > API e colocar em `SUPABASE_SERVICE_ROLE_KEY`.

- Project URL: `https://pumepyunvrbnwxkoakfn.supabase.co`
- Dashboard: https://supabase.com/dashboard/project/pumepyunvrbnwxkoakfn

(O `schema.sql` fica no repo só como referência/versionamento; não precisa rodar
de novo.)

### 2. Gemini
No Google AI Studio, gere uma API key (sem cartão). Confira o ID do modelo atual
de Flash-Lite disponível na sua conta e ajuste `GEMINI_MODEL` se necessário — o
Google renomeia os modelos com frequência.

### 3. WhatsApp Cloud API (Meta)
1. Crie um app em developers.facebook.com e adicione o produto WhatsApp.
2. Pegue o `WHATSAPP_PHONE_NUMBER_ID` e um token de acesso (`WHATSAPP_TOKEN`).
3. Invente um `WHATSAPP_VERIFY_TOKEN` (qualquer texto secreto).
4. Depois do deploy, configure o webhook apontando para
   `https://SEU-PROJETO.vercel.app/api/webhook`, usando o mesmo verify token, e
   assine o evento `messages`.

> Alternativa não oficial: se preferir a Evolution API (self-hosted, sem custo
> de mensagem, mas fora dos termos do WhatsApp), troque a implementação de
> `lib/whatsapp.js` e o parsing do payload em `api/webhook.js`.

### 4. Deploy na Vercel
1. Suba o projeto num repositório e importe na Vercel (ou use `vercel` na CLI).
2. Em Settings > Environment Variables, preencha tudo do `.env.example`.
3. O `vercel.json` já agenda o relatório para domingo 12:00 UTC (9h de Brasília).

### 5. Testar
Mande uma mensagem pro número: `mercado 45` ou `uber 22 ontem`. O bot responde
"Anotado: ...". Envie `relatório` para ver o resumo. Acesse o dashboard em
`https://SEU-PROJETO.vercel.app` e entre com o `DASHBOARD_TOKEN`.

## Comandos no WhatsApp
- Gasto normal: `mercado 45`, `torrei 80 no ifood`, `uber 22 ontem`
- `relatório` — resumo do mês (grátis, é resposta dentro da janela de 24h)
- `ajuda` — lista de comandos

## Pontos de atenção (honestos)

- **Relatório agendado x janela de 24h.** No WhatsApp oficial, uma mensagem que o
  bot inicia fora da janela de 24h exige um *template* aprovado pela Meta. Ou
  seja: o `relatório` que você pede funciona sempre; o agendado automático só
  entrega garantido se você tiver interagido nas últimas 24h. Para automático de
  verdade, crie um template utility e adapte `lib/whatsapp.js`. Na Evolution API
  não há essa restrição.
- **Segurança.** Só números em `ALLOWED_NUMBERS` conseguem gravar. O dashboard
  usa uma senha simples (`DASHBOARD_TOKEN`). Para algo mais robusto, migre para
  Supabase Auth.
- **Privacidade do Gemini.** No free tier, os prompts podem ser usados para
  treino do Google. Como são dados financeiros, considere habilitar billing
  (Tier 1) para remover isso — o custo no seu volume é praticamente zero.
- **Idempotência.** Se a Meta reenviar um evento, o gasto pode ser gravado duas
  vezes. Para uso pessoal é raro; se quiser blindar, guarde o `message.id` e
  ignore repetidos.

## Custo estimado
Volume pessoal (dezenas de mensagens/dia): Gemini no free tier, Supabase no free
tier, Vercel no plano Hobby, mensagens recebidas/respondidas gratuitas no
WhatsApp. Na prática, R$ 0/mês para começar.
