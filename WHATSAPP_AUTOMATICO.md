# 📱 CONFIGURAÇÃO DE WHATSAPP AUTOMÁTICO

## Twilio WhatsApp API

Para envio automático de mensagens WhatsApp (sem precisar clicar), use o Twilio.

### 1. Criar conta no Twilio
- Acesse: https://www.twilio.com/try-twilio
- Crie uma conta grátis
- Ganhe $15 de crédito inicial

### 2. Obter credenciais
No console do Twilio:
- Vá em "Account" → "API keys & tokens"
- Copie:
  - `Account SID`
  - `Auth Token`

### 3. Configurar WhatsApp Sandbox (teste grátis)
- No console, vá em "Messaging" → "Try it out" → "Send a WhatsApp message"
- Siga as instruções para conectar seu número ao sandbox
- O número do sandbox é: `whatsapp:+14155238886`

### 4. Configurar variáveis de ambiente

Edite o arquivo `.env`:

```bash
# WhatsApp Configuration (Twilio)
VITE_TWILIO_ACCOUNT_SID=AC1234567890abcdef
VITE_TWILIO_AUTH_TOKEN=sua_auth_token_aqui
VITE_TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
```

### 5. Configurar no Vercel

No painel do Vercel:
1. Vá em "Settings" → "Environment Variables"
2. Adicione:
   - `VITE_TWILIO_ACCOUNT_SID` = seu Account SID
   - `VITE_TWILIO_AUTH_TOKEN` = seu Auth Token
   - `VITE_TWILIO_WHATSAPP_FROM` = `whatsapp:+14155238886`
3. Faça redeploy

### 6. Produção (números reais)

Para usar com números reais (não sandbox):
1. Faça upgrade no Twilio (pago por mensagem)
2. Solicite aprovação de template de mensagem
3. Configure número WhatsApp Business oficial
4. Custo aproximado: $0.005-0.01 por mensagem

## Plano Gratuito

**Sandbox (Teste):**
- ✅ Grátis
- ✅ $15 de crédito inicial
- ❌ Requer ativação manual de cada número receptor
- ✅ Perfeito para testar!

**Produção:**
- Pago por mensagem
- Sem necessidade de ativação prévia
- Templates aprovados pela Meta

## Comportamento do Sistema

**SEM configurar Twilio:**
- Abre WhatsApp Web com mensagem pré-preenchida
- Você precisa clicar em "Enviar"

**COM Twilio configurado:**
- Envia mensagens automaticamente
- Sem necessidade de clicar
- Funciona em segundo plano

## Testando

1. Configure as credenciais no `.env`
2. Reinicie o servidor de desenvolvimento
3. Faça um pedido de teste
4. As mensagens serão enviadas automaticamente! 🚀

## Alternativa: WhatsApp Business API

Se preferir a API oficial da Meta:
- Mais complexo de configurar
- Gratuito após aprovação
- Requer Meta Business Account
- Processo de aprovação pode levar semanas

O Twilio é mais rápido e fácil de implementar! ⚡
