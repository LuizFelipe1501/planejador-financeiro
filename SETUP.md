# Guia de setup — do zero ao ar

Ordem recomendada: Gemini → WhatsApp → Vercel → webhook → template do relatório.
O Supabase já está pronto (só falta a service_role key).

---

## 0. Supabase (feito)
Projeto `caderno-gastos` criado, tabela `expenses` com RLS.
- URL: `https://pumepyunvrbnwxkoakfn.supabase.co`
- Pegue a `service_role key` em Settings > API e guarde para o passo da Vercel.
- Painel: https://supabase.com/dashboard/project/pumepyunvrbnwxkoakfn

---

## 1. Gemini (2 minutos)
1. Entre em https://aistudio.google.com e faça login.
2. "Get API key" > "Create API key". Copie a chave (`AIza...`).
3. Confirme o ID do modelo Flash-Lite disponível na sua conta (o Google renomeia
   com frequência). Guarde para `GEMINI_MODEL`; o padrão do projeto é
   `gemini-3.5-flash-lite`.
4. (Opcional, recomendado para dados financeiros) Ative billing/Tier 1 para que
   seus prompts não sejam usados em treino. No seu volume, o custo é ~zero.

---

## 2. WhatsApp Cloud API (a parte mais chata)

### 2.1 Criar o app
1. Acesse https://developers.facebook.com e faça login com sua conta Meta.
2. My Apps > Create App. Tipo: "Business". Dê um nome (ex.: "caderno-gastos").
3. No painel do app, adicione o produto "WhatsApp" (Set up).

### 2.2 Pegar as credenciais de teste
Na seção WhatsApp > API Setup você verá:
- Um número de teste da Meta (from) já pronto para uso.
- O `Phone number ID` — copie para `WHATSAPP_PHONE_NUMBER_ID`.
- Um token temporário (24h) — serve para testar. Copie para `WHATSAPP_TOKEN`.
- Em "To", adicione o seu número pessoal como destinatário de teste (a Meta
  manda um código de confirmação no seu WhatsApp).

> Dica: mande a mensagem de teste `hello_world` pela própria tela para confirmar
> que o número recebe. Esse template já vem aprovado pela Meta.

### 2.3 Token permanente (para produção)
O token de 24h expira. Para um token que não expira:
1. business.facebook.com > Configurações do negócio > Usuários > Usuários do
   sistema > criar um "System User" (função Admin).
2. Gere um token para esse usuário, com as permissões
   `whatsapp_business_messaging` e `whatsapp_business_management`.
3. Use esse token em `WHATSAPP_TOKEN`.

### 2.4 Seu verify token
Invente qualquer texto secreto (ex.: `caderno-1234`) e guarde em
`WHATSAPP_VERIFY_TOKEN`. Você vai usar o mesmo valor no passo 4.

---

## 3. Deploy na Vercel
1. Suba o projeto num repositório Git (GitHub) e importe em vercel.com
   (Add New > Project), ou use a CLI: `npm i -g vercel` e `vercel`.
2. Em Settings > Environment Variables, preencha TODAS as variáveis do
   `.env.example` (Supabase, Gemini, WhatsApp, ALLOWED_NUMBERS, DASHBOARD_TOKEN).
3. Defina também `CRON_SECRET` (um texto forte). O Vercel passa esse valor no
   header ao chamar o cron; o `/api/report` valida.
4. Deploy. Sua URL será algo como `https://caderno-gastos.vercel.app`.

> Cron no plano grátis (Hobby): roda no máximo 1x por dia e dispara em algum
> momento dentro da hora marcada. O `vercel.json` já usa domingo 12:00 UTC
> (9h de Brasília), o que cabe no limite. Só muda de verdade se você quiser o
> relatório mais de uma vez por dia — aí precisaria do plano Pro ou de um cron
> externo apontando para `/api/report`.

---

## 4. Configurar o webhook na Meta
1. No app, WhatsApp > Configuration > Webhook > Edit.
2. Callback URL: `https://SEU-PROJETO.vercel.app/api/webhook`
3. Verify token: o mesmo `WHATSAPP_VERIFY_TOKEN` do passo 2.4.
4. Salve. A Meta chama seu endpoint com um GET e ele responde o challenge.
5. Em "Webhook fields", assine o campo `messages`.

Teste: mande `mercado 45` do seu número para o número de teste. Deve responder
"Anotado: R$ 45,00 em alimentação". Mande `relatório` para ver o resumo.

---

## 5. Template do relatório agendado (utility)

Necessário só para o relatório automático fora da janela de 24h. O relatório
pedido com `relatório` funciona sem isso.

### Opção A — pela interface (mais fácil)
1. business.facebook.com > WhatsApp Manager > Modelos de mensagem > Criar modelo.
2. Categoria: **Utility**. Idioma: **Português (BR)**. Nome: `resumo_mensal`.
3. Corpo (body), exatamente com 4 variáveis:

   ```
   Seu resumo de {{1}}: total de {{2}} em {{3}} lançamentos. Maior categoria: {{4}}. Abra o painel para ver os detalhes.
   ```

4. Nos exemplos das variáveis, preencha algo como: `julho de 2026`, `R$ 1.240,00`,
   `18`, `alimentação`.
5. Envie para aprovação. Utility costuma aprovar rápido.

### Opção B — via API (curl)
Precisa do `WHATSAPP_BUSINESS_ACCOUNT_ID` (WABA ID, na tela API Setup):

```bash
curl -X POST 'https://graph.facebook.com/v23.0/<WABA_ID>/message_templates' \
  -H 'Authorization: Bearer <WHATSAPP_TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "resumo_mensal",
    "category": "UTILITY",
    "language": "pt_BR",
    "components": [{
      "type": "BODY",
      "text": "Seu resumo de {{1}}: total de {{2}} em {{3}} lançamentos. Maior categoria: {{4}}. Abra o painel para ver os detalhes.",
      "example": { "body_text": [["julho de 2026","R$ 1.240,00","18","alimentação"]] }
    }]
  }'
```

Depois de aprovado, garanta que na Vercel estejam:
`WHATSAPP_USE_TEMPLATE=true`, `REPORT_TEMPLATE_NAME=resumo_mensal`,
`REPORT_TEMPLATE_LANG=pt_BR`.

Para testar o cron manualmente: chame `GET /api/report` com o header
`Authorization: Bearer <CRON_SECRET>`.

---

## Checklist final
- [ ] service_role key na Vercel
- [ ] GEMINI_API_KEY na Vercel
- [ ] WHATSAPP_TOKEN, PHONE_NUMBER_ID, VERIFY_TOKEN na Vercel
- [ ] ALLOWED_NUMBERS com seu número (DDI, ex.: 5561999998888)
- [ ] DASHBOARD_TOKEN e CRON_SECRET definidos
- [ ] Webhook verificado e campo `messages` assinado
- [ ] Template `resumo_mensal` aprovado (só para o relatório automático)

---

## 6. Multiusuário (já preparado)
O projeto já nasce multi-tenant, mas em modo de teste:
- **Onboarding automático**: um número novo que manda mensagem vira um usuário e
  recebe um link pessoal do painel (`/painel?t=<token>`).
- **Trava de teste**: enquanto `ALLOWED_NUMBERS` estiver preenchida, só esses
  números conseguem entrar. Esvazie a variável quando quiser abrir a qualquer um.
- **APP_URL**: defina com a URL pública (ex.: `https://caderno-gastos.vercel.app`)
  pra que o link do painel seja montado corretamente no onboarding.
- **Relatório**: o cron percorre a tabela `users` e manda o resumo de cada um.
- **Painel**: cada pessoa só vê os próprios gastos, via o token do seu link.
  Sem token, o painel mostra um aviso pra abrir pelo link do WhatsApp.

Para escalar de verdade depois (vender): verifique o negócio na Meta (sai do
limite de 250/dia), troque o link-token por login real (Supabase Auth) e
adicione uma fila pro webhook responder rápido sob volume.
