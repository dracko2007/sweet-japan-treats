# 📧 Configuração do Email (Resend)

## ⚠️ IMPORTANTE: Domínio Personalizado

Para enviar emails com um endereço personalizado (como `pedidos@sabordocampo.com`), você precisa **verificar seu domínio** no Resend.

## 🚀 Opção 1: Usar Domínio de Teste (Recomendado para testes)

**Já está configurado!** O sistema está usando `onboarding@resend.dev` que funciona imediatamente.

✅ Vantagens:
- Funciona instantaneamente
- Não requer configuração DNS
- Perfeito para testes

❌ Desvantagens:
- Email do remetente é genérico
- Pode cair em spam

---

## 🌐 Opção 2: Configurar Domínio Personalizado (Produção)

### Passo 1: Adicionar Domínio no Resend

1. Acesse: https://resend.com/domains
2. Clique em **"Add Domain"**
3. Digite seu domínio: `sabordocampo.com`
4. Clique em **"Add"**

### Passo 2: Configurar DNS

O Resend vai fornecer **3 registros DNS** que você precisa adicionar no seu provedor de domínio:

```
Tipo: TXT
Nome: _resend
Valor: [código fornecido pelo Resend]

Tipo: CNAME  
Nome: resend._domainkey
Valor: [código fornecido pelo Resend]

Tipo: MX
Nome: @
Valor: [servidor fornecido pelo Resend]
```

**Onde adicionar:**
- Se comprou domínio na **GoDaddy**: Painel DNS da GoDaddy
- Se usa **Cloudflare**: Dashboard do Cloudflare > DNS
- Se usa **Registro.br**: Painel de DNS do Registro.br

### Passo 3: Aguardar Verificação

- Pode levar de **alguns minutos até 48 horas**
- Resend vai verificar automaticamente
- Você receberá um email quando estiver pronto

### Passo 4: Atualizar Configuração

Após verificação, atualize o `.env`:

```env
VITE_FROM_EMAIL=pedidos@sabordocampo.com
```

E também no **Vercel** (Environment Variables):
- Variável: `VITE_FROM_EMAIL`
- Valor: `pedidos@sabordocampo.com`

Depois, **redeploy** no Vercel.

---

## 🧪 Testar Envio de Email

1. Abra o navegador e vá para o site
2. Faça um pedido de teste
3. Verifique o console do navegador (F12)
4. Procure por mensagens começando com `📧`

**Se ver:**
- `✅ Email sent successfully via Resend!` → Funcionou!
- `❌ Resend API error` → Veja o erro no console
- `⚠️ VITE_RESEND_API_KEY not configured` → Falta configurar no Vercel

---

## 🔍 Verificar Emails Enviados

1. Acesse: https://resend.com/emails
2. Veja todos os emails enviados
3. Clique em um para ver detalhes
4. Verifique status de entrega

---

## ❓ Problemas Comuns

### Email não chega na caixa de entrada

**Solução 1:** Verificar spam/lixeira
**Solução 2:** Usar domínio verificado (emails de teste podem cair em spam)
**Solução 3:** Adicionar `onboarding@resend.dev` nos contatos

### Erro "Domain not found"

- Você está tentando usar um domínio não verificado
- Volte para `onboarding@resend.dev` temporariamente
- Ou complete a verificação do domínio

### Erro "Invalid API key"

- Verifique se a chave está correta no `.env`
- Verifique se está configurada no Vercel
- Verifique se fez redeploy após configurar

---

## 📋 Checklist de Configuração

- [ ] API Key do Resend configurada no `.env`
- [ ] API Key configurada no Vercel (Environment Variables)
- [ ] `VITE_FROM_EMAIL` configurado (use `onboarding@resend.dev` para testes)
- [ ] Redeploy feito no Vercel
- [ ] Teste de envio realizado
- [ ] Emails chegando na caixa de entrada

**Para produção:**
- [ ] Domínio adicionado no Resend
- [ ] Registros DNS configurados
- [ ] Domínio verificado (aguardar até 48h)
- [ ] `VITE_FROM_EMAIL` atualizado para domínio personalizado
- [ ] Redeploy final no Vercel
