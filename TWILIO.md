# WhatsApp via Twilio Sandbox (teste rápido)

O jeito mais rápido de testar WhatsApp real, sem verificar empresa na Meta.
O código já está pronto para Twilio (`WHATSAPP_PROVIDER=twilio`).

## Passo a passo

### 1. Criar conta
Cadastre-se em https://www.twilio.com/try-twilio (trial gratuito).

### 2. Abrir o Sandbox do WhatsApp
No Console: Messaging → Try it out → Send a WhatsApp message.
Você verá:
- O número do sandbox (geralmente **+1 415 523 8886**).
- Uma frase de entrada tipo **"join laranja-tigre"** (duas palavras).

### 3. Entrar no sandbox
Do SEU WhatsApp, mande a frase (ex.: `join laranja-tigre`) para o número do
sandbox. Ele responde confirmando que você está conectado. (Cada pessoa que for
testar precisa fazer isso uma vez — é limitação do sandbox.)

### 4. Apontar o webhook para o seu app
Ainda na tela do Sandbox, aba "Sandbox settings":
- Em **"When a message comes in"**, cole:
  `https://planejador-financeiro-gamma.vercel.app/api/webhook`
- Método: **POST**. Salve.

### 5. Pegar as credenciais
No painel principal do Console:
- **Account SID** (começa com `AC...`)
- **Auth Token** (clique para revelar)
- O número do sandbox no formato `whatsapp:+14155238886`

### 6. Variáveis na Vercel
Em Settings → Environment Variables, adicione/ajuste:
```
WHATSAPP_PROVIDER=twilio
TWILIO_ACCOUNT_SID=AC...            (seu Account SID)
TWILIO_AUTH_TOKEN=...               (seu Auth Token)
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
WHATSAPP_USE_TEMPLATE=false
ALLOWED_NUMBERS=55XXXXXXXXXXX       (seu número com DDI, só dígitos)
```
Depois faça **Redeploy** (variável nova só vale no próximo deploy).

### 7. Testar
Do seu WhatsApp (já conectado ao sandbox), mande `mercado 45` para o número do
sandbox. O bot deve responder "Anotado: R$ 45,00 em alimentação", e o gasto cai
no painel. Como é número novo, você também recebe o link pessoal do painel.

## Observações honestas
- **Sandbox = teste.** Só fala com quem mandou a frase "join". Para produção,
  você registra um número próprio (aí sim pode valer a pena um número +55) e sai
  do sandbox — o código não muda, só as credenciais.
- **Janela de 24h** vale igual: respostas ao usuário são livres; iniciar conversa
  fora da janela exige template aprovado. Por isso o relatório agendado está em
  `WHATSAPP_USE_TEMPLATE=false` (texto simples) enquanto testa.
- **Segurança:** a validação da assinatura do Twilio (X-Twilio-Signature) não
  está ligada — para teste tudo bem; para produção, vale adicionar.
- **Conta multiusuário:** o número do WhatsApp cria/usa a conta dele próprio
  (com link pessoal), separada das contas de login (luiz/demo). É o comportamento
  certo do multiusuário.
