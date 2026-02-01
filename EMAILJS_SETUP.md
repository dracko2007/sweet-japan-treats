# 📧 Guia de Configuração - EmailJS (Alternativa Simples)

## ✨ Por que EmailJS?

- ✅ **Funciona no frontend** - Não precisa de backend
- ✅ **Gratuito** - 200 emails/mês grátis
- ✅ **Fácil configuração** - 5 minutos
- ✅ **Sempre funciona** - Fallback para cliente de email

---

## 🚀 Como Configurar (5 minutos)

### 1. Criar Conta no EmailJS

1. Acesse: https://www.emailjs.com/
2. Clique em **"Sign Up"** (grátis)
3. Confirme seu email

### 2. Conectar seu Gmail

1. No dashboard, clique em **"Add New Service"**
2. Escolha **"Gmail"**
3. Clique em **"Connect Account"**
4. Faça login com sua conta Gmail (dracko2007@gmail.com)
5. Autorize o EmailJS
6. Copie o **Service ID** (ex: `service_abc123`)

### 3. Criar Template de Email

1. Vá em **"Email Templates"**
2. Clique em **"Create New Template"**
3. Use este template:

```
Subject: Pedido {{order_number}} - Sabor do Campo

Olá {{to_name}}!

Seu pedido foi confirmado! 🎉

📋 Pedido: {{order_number}}
📅 Data: {{order_date}}

📦 Produtos:
{{items_list}}

💰 Total: {{total_price}}

📍 Endereço de Entrega:
{{shipping_address}}

💳 Pagamento: {{payment_method}}
📞 Contato: {{phone}}

Obrigada pela preferência!

Sabor do Campo - Doce de Leite Artesanal
📞 070-1367-1679
📧 dracko2007@gmail.com
```

4. Salve e copie o **Template ID** (ex: `template_xyz789`)

### 4. Pegar Public Key

1. Vá em **"Account"** → **"General"**
2. Encontre **"Public Key"**
3. Copie (ex: `7aBcDeFgH1234567`)

### 5. Adicionar ao .env

Adicione estas linhas no arquivo `.env`:

```bash
# EmailJS Configuration (Simple Email Service)
VITE_EMAILJS_SERVICE_ID=service_abc123
VITE_EMAILJS_TEMPLATE_ID=template_xyz789
VITE_EMAILJS_PUBLIC_KEY=7aBcDeFgH1234567
```

**Substitua** pelos seus valores reais!

### 6. Reiniciar o Servidor

```bash
# Pare o servidor (Ctrl+C)
# Reinicie:
npm run dev
# ou
bun run dev
```

---

## 🧪 Testar

1. Acesse: `http://localhost:5173/admin`
2. Faça login com `dracko2007@gmail.com`
3. Clique em **"🧪 Testar Notificações"**
4. Verifique seu email!

---

## 🔧 Como Funciona

### Sistema de Fallback Inteligente:

1. **Primeira tentativa:** Resend (se configurado)
2. **Segunda tentativa:** EmailJS (se configurado)
3. **Fallback final:** Abre cliente de email padrão (Gmail/Outlook)

**Resultado:** SEMPRE funciona, de alguma forma! ✅

---

## 📱 WhatsApp Simplificado

O novo sistema de WhatsApp também tem fallback:

1. **Primeira tentativa:** Twilio API (se configurado)
2. **Fallback automático:** Abre WhatsApp Web/App diretamente

**Resultado:** SEMPRE abre o WhatsApp! ✅

---

## 🎯 Vantagens do Sistema Novo

| Funcionalidade | Antes | Agora |
|----------------|-------|-------|
| Email sem backend | ❌ Não | ✅ Sim (EmailJS) |
| Email sempre funciona | ❌ Não | ✅ Sim (fallback para cliente) |
| WhatsApp sem API | ❌ Não | ✅ Sim (abre direto) |
| Configuração complexa | ✅ Sim | ❌ Não (5 minutos) |
| Custo | 💰 APIs pagas | 🆓 Grátis (200 emails/mês) |

---

## 🔐 Segurança no Vercel

Quando fazer deploy, adicione as variáveis:

1. Acesse: **Settings** → **Environment Variables**
2. Adicione:
   ```
   VITE_EMAILJS_SERVICE_ID=seu_service_id
   VITE_EMAILJS_TEMPLATE_ID=seu_template_id
   VITE_EMAILJS_PUBLIC_KEY=sua_public_key
   ```
3. Selecione: **Production, Preview, Development**
4. **Save** e **Redeploy**

---

## ❓ Problemas Comuns

### Email não chega?

1. **Verifique spam/lixo eletrônico**
2. **Confirme Service ID e Template ID** no .env
3. **Reinicie o servidor** após alterar .env
4. **Veja o console** (F12) para logs

### EmailJS diz "Daily quota exceeded"?

- Plano gratuito: 200 emails/mês
- **Solução:** Upgrade ou usar fallback (cliente de email)

### Popup bloqueado?

- WhatsApp/Email podem ser bloqueados pelo navegador
- **Solução:** Permita popups do site

---

## 📞 Suporte

Se tiver problemas:

1. Abra o **console** (F12)
2. Copie os **logs** (começam com 📧 e 📱)
3. Verifique se as variáveis estão no `.env`

O sistema SEMPRE terá um fallback que funciona! 🎉
