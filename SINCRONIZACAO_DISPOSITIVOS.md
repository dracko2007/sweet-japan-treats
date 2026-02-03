# Sincronização de Cadastros entre Dispositivos

## 🎯 Problema Resolvido

Antes, os cadastros feitos no celular ficavam apenas no localStorage do celular, e os do PC apenas no localStorage do PC. Não havia comunicação entre os dispositivos.

## ✅ Solução Implementada

Agora o sistema utiliza **Firebase Authentication** e **Firestore** para sincronizar automaticamente todos os cadastros na nuvem.

## 🔄 Como Funciona

### 1. **Registro de Novos Usuários**

Quando um usuário se cadastra:
- ✅ É criada uma conta no Firebase Authentication
- ✅ Os dados são salvos no Firestore (nuvem)
- ✅ Os dados também são salvos no localStorage (backup local)
- ✅ O usuário recebe um UID único do Firebase

### 2. **Login**

Quando um usuário faz login:
- ✅ O sistema tenta autenticar via Firebase Auth
- ✅ Busca os dados do usuário no Firestore
- ✅ Se não encontrar no Firebase, busca no localStorage (fallback)
- ✅ Salva os dados localmente para acesso offline

### 3. **Sincronização Automática**

- ✅ O sistema escuta mudanças de autenticação do Firebase
- ✅ Quando o usuário faz login em outro dispositivo, os dados são carregados automaticamente
- ✅ Não é necessário fazer nada manualmente

## 📱 Usando em Múltiplos Dispositivos

### Primeiro Acesso (Cadastro):

1. **No Celular:**
   - Registre-se normalmente em `/cadastro`
   - Os dados serão salvos no Firebase automaticamente

2. **No PC:**
   - Faça login com o mesmo email e senha
   - Seus dados serão carregados do Firebase
   - Tudo sincronizado! ✨

### Dados Antigos no localStorage:

Se você tem cadastros antigos apenas no localStorage (feitos antes desta atualização):

1. Acesse `/sync-data` ou clique em "Sincronizar Dados" no seu perfil
2. Clique no botão "Sincronizar Dados"
3. Seus dados locais serão enviados para o Firebase
4. Agora você pode acessar de qualquer dispositivo!

## 🔧 Arquivos Modificados

### 1. `src/context/UserContext.tsx`
- ✅ Adicionado import do `firebaseSyncService`
- ✅ Listener do Firebase Auth para sincronização automática
- ✅ Função `register` agora cria conta no Firebase Auth e salva no Firestore
- ✅ Função `login` tenta Firebase Auth primeiro, fallback para localStorage
- ✅ Função `logout` agora faz logout do Firebase Auth também

### 2. `src/pages/SyncData.tsx` (NOVO)
- ✅ Página para sincronização manual de dados antigos
- ✅ Migra dados do localStorage para Firebase
- ✅ Interface amigável com status e feedback

### 3. `src/App.tsx`
- ✅ Adicionada rota `/sync-data` para a página de sincronização

### 4. `src/pages/Profile.tsx`
- ✅ Adicionado botão "Sincronizar Dados" no perfil

## 🧪 Como Testar

### Teste 1: Novo Cadastro
1. Abra o site no celular
2. Cadastre um novo usuário
3. Abra o site no PC
4. Faça login com o mesmo email/senha
5. ✅ Deve funcionar e mostrar os dados corretos

### Teste 2: Sincronização de Dados Antigos
1. Se você tem dados antigos no localStorage
2. Acesse `/sync-data`
3. Clique em "Sincronizar Dados"
4. Aguarde a confirmação
5. Abra em outro dispositivo e faça login
6. ✅ Deve funcionar e mostrar os dados migrados

### Teste 3: Login em Múltiplos Dispositivos
1. Faça login no celular
2. Faça login no PC com o mesmo usuário
3. ✅ Os dados devem estar sincronizados em ambos

## 🔐 Segurança

- ✅ Senhas são gerenciadas pelo Firebase Auth (hash seguro)
- ✅ Dados são armazenados no Firestore com regras de segurança
- ✅ Cada usuário só acessa seus próprios dados
- ✅ localStorage é usado como backup, não como fonte principal

## 📊 Estrutura no Firebase

### Firestore Collections:

```
users/
  {uid}/
    id: string
    name: string
    email: string
    phone: string
    address: object
    createdAt: timestamp
    lastSyncAt: timestamp

orders/
  {orderNumber}/
    userId: string
    orderNumber: string
    items: array
    totalAmount: number
    status: string
    syncedAt: timestamp
```

## ⚠️ Avisos Importantes

1. **Primeira vez:** Se você já tem cadastros locais, use a página de sincronização
2. **Novos cadastros:** Serão automaticamente sincronizados, não precisa fazer nada
3. **Internet:** É necessário ter conexão com a internet para sincronizar
4. **Backup:** O localStorage continua sendo usado como backup local

## 🚀 Próximos Passos (Opcional)

- [ ] Sincronizar cupons no Firebase
- [ ] Sincronizar lista de desejos no Firebase
- [ ] Adicionar sincronização em tempo real com onSnapshot
- [ ] Implementar cache offline mais robusto
- [ ] Adicionar indicador de status de sincronização na UI

## 💡 Dicas

- Use a mesma conta em todos os dispositivos
- A sincronização é automática após o login
- Se tiver problemas, tente fazer logout e login novamente
- A página de sincronização manual é útil apenas para dados antigos
