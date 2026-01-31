# 📧 CONFIGURAÇÃO DE NOTIFICAÇÕES

## Email (Resend)

O site usa a API do Resend para enviar emails. Para ativar:

### 1. Criar conta no Resend
- Acesse: https://resend.com
- Crie uma conta grátis
- Verifique seu email

### 2. Obter API Key
- No dashboard do Resend, vá em "API Keys"
- Clique em "Create API Key"
- Dê um nome (ex: "Sabor do Campo")
- Copie a chave (começa com `re_...`)

### 3. Configurar domínio (IMPORTANTE)
- No Resend, vá em "Domains"
- Adicione seu domínio (ex: `sabordocampo.com`)
- Configure os registros DNS conforme instruções
- Aguarde verificação

### 4. Configurar variáveis de ambiente

Crie ou edite o arquivo `.env` na raiz do projeto:

```bash
# Email Configuration
VITE_RESEND_API_KEY=re_SuaChaveAqui123456789
VITE_FROM_EMAIL=pedidos@sabordocampo.com
```

### 5. Configurar no Vercel

No painel do Vercel:
1. Vá em "Settings" → "Environment Variables"
2. Adicione:
   - `VITE_RESEND_API_KEY` = sua chave do Resend
   - `VITE_FROM_EMAIL` = seu email de envio
3. Faça redeploy

## WhatsApp

O WhatsApp funciona automaticamente! Quando finalizar um pedido:

1. **Mensagem para Paula (070-1367-1679)**
   - Abre automaticamente o WhatsApp Web
   - Mensagem pré-preenchida com detalhes do pedido
   - Só precisa clicar em "Enviar"

2. **Mensagem para o Cliente**
   - Abre 2 segundos depois
   - Mensagem de confirmação do pedido
   - Também pré-preenchida, só clicar em "Enviar"

### Testando

Sem configurar o Resend:
- Emails: Abrirão em nova janela para visualização
- WhatsApp: Funciona normalmente

Com Resend configurado:
- Emails: Enviados automaticamente
- WhatsApp: Funciona normalmente

## Plano Gratuito do Resend

- ✅ 100 emails/dia
- ✅ 3.000 emails/mês
- ✅ Domínio personalizado
- ✅ Sem cartão de crédito

Perfeito para começar! 🎉
