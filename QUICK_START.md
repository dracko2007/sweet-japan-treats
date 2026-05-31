# ⚡ Quick Start: Setup Automático de Imagens

## 🎯 Um Comando Faz TUDO

```bash
npm install --save-dev firebase-admin sharp && npx ts-node auto-setup-images.ts
```

## 📋 Pré-requisito: Firebase Credentials

**ANTES de executar:**

1. Vá para [Firebase Console](https://console.firebase.google.com/)
2. Selecione seu projeto
3. **Project Settings** (engrenagem) → **Service Accounts**
4. Clique em **Generate New Private Key**
5. Salve o arquivo como **`serviceAccountKey.json`** na **raiz do projeto** (mesmo nível que package.json)

---

## 🚀 Processo Automático

O script faz isso **em sequência**:

1. ✅ **Gera 200 imagens** de placeholder (5 por produto)
2. ✅ **Faz upload para Firebase Storage** automaticamente
3. ✅ **Atualiza products.ts** com URLs permanentes do Firebase
4. ✅ **Commit e Push** para GitHub
5. ✅ **Deploy no Vercel** com novo site ao vivo

---

## ⏱️ Tempo Total: ~5-10 minutos

```
Gerando imagens:        ~2 min
Upload Firebase:        ~2 min
Atualizar products.ts:  ~1 min
Commit & Push:          ~1 min
Deploy Vercel:          ~2 min
```

---

## ✅ Ao Terminar

- ✨ **200 imagens** no Firebase Storage
- 🌐 **products.ts** atualizado com URLs permanentes
- 🚀 **Site live** em: https://japan-express.vercel.app

---

## 🐛 Se der erro

**"serviceAccountKey.json not found"**
→ Siga passo 1-5 acima e salve na raiz

**"Firebase initialization failed"**
→ Verifique se as credenciais estão corretas

**"Vercel deploy failed"**
→ Vercel pode pedir login: execute `vercel login` primeiro

---

## 🎬 GO!

```bash
npm install --save-dev firebase-admin sharp && npx ts-node auto-setup-images.ts
```

**That's it!** Deixa rodar! ☕
