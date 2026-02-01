# 🔥 Setup Firebase - Sincronizar Dados Entre Dispositivos

## Por que Firebase?
- ✅ **Grátis** até 50.000 leituras/dia
- ✅ **Tempo real** - sincroniza automaticamente
- ✅ **Fácil** de implementar
- ✅ **Seguro** - autenticação integrada

## Passo 1: Criar Projeto Firebase

1. Acesse: https://console.firebase.google.com/
2. Clique em **"Adicionar projeto"**
3. Nome do projeto: `sweet-japan-treats`
4. Desabilite Google Analytics (opcional)
5. Clique em **"Criar projeto"**

## Passo 2: Ativar Firestore Database

1. No menu lateral, clique em **"Firestore Database"**
2. Clique em **"Criar banco de dados"**
3. Escolha **"Iniciar no modo de produção"**
4. Localização: `asia-northeast1 (Tokyo)` (mais próximo do Japão)
5. Clique em **"Ativar"**

## Passo 3: Configurar Regras de Segurança

No Firestore, vá em **"Regras"** e cole:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Usuários podem ler/escrever seus próprios dados
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Pedidos podem ser lidos pelo usuário e admin
    match /orders/{orderId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
    
    // Admin pode ler tudo
    match /{document=**} {
      allow read: if request.auth.token.email == 'dracko2007@gmail.com';
    }
  }
}
```

## Passo 4: Ativar Autenticação

1. No menu lateral, clique em **"Authentication"**
2. Clique em **"Começar"**
3. Ative **"E-mail/senha"**
4. Salve

## Passo 5: Obter Configuração

1. Clique no ícone de engrenagem ⚙️ ao lado de "Visão geral do projeto"
2. Clique em **"Configurações do projeto"**
3. Role até **"Seus apps"**
4. Clique no ícone **</> (Web)**
5. Registre o app: `sweet-japan-treats-web`
6. **COPIE A CONFIGURAÇÃO** que aparece:

```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "sweet-japan-treats.firebaseapp.com",
  projectId: "sweet-japan-treats",
  storageBucket: "sweet-japan-treats.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
```

## Passo 6: Adicionar ao Projeto

Cole essas credenciais em:
`.env.local` (criar arquivo na raiz do projeto):

```
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=sweet-japan-treats.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=sweet-japan-treats
VITE_FIREBASE_STORAGE_BUCKET=sweet-japan-treats.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
```

## Passo 7: Instalar Dependências

```bash
npm install firebase
# ou
bun install firebase
```

## 📋 Checklist

- [ ] Projeto Firebase criado
- [ ] Firestore ativado
- [ ] Regras de segurança configuradas
- [ ] Authentication ativada (Email/Senha)
- [ ] Configuração copiada
- [ ] Variáveis de ambiente criadas (.env.local)
- [ ] Firebase instalado no projeto

## 🚀 Próximo Passo

Depois de configurar, me avise que eu implemento:
1. Migração do localStorage para Firestore
2. Sincronização automática entre dispositivos
3. Sistema de autenticação com Firebase Auth
4. Backup automático dos dados

## 💰 Limites Gratuitos (Spark Plan)

- **Firestore:**
  - 50.000 leituras/dia
  - 20.000 escritas/dia
  - 20.000 exclusões/dia
  - 1 GB armazenamento

- **Authentication:**
  - Usuários ilimitados
  - 10.000 verificações/mês

**Para um e-commerce pequeno, isso é MAIS que suficiente!** 🎉
