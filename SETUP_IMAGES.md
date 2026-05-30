# 🖼️ Setup de Imagens para Firebase Storage

## Estrutura de Pastas

```
public/images/
├── cosmeticos/          (10 produtos × 5 imagens cada)
│   ├── biore-uv-1.jpg
│   ├── biore-uv-2.jpg
│   ├── biore-uv-3.jpg
│   ├── biore-uv-4.jpg
│   ├── biore-uv-5.jpg
│   └── ... (outras pastas de produtos)
├── doces/              (10 produtos × 5 imagens cada)
├── acessorios/         (10 produtos × 5 imagens cada)
└── papelaria/          (10 produtos × 5 imagens cada)
```

**Total: 40 produtos × 5 imagens = 200 imagens**

---

## Passo 1: Prepare as Imagens

1. **Organize as imagens** em estrutura de pastas conforme acima
2. **Nomeie** cada imagem como: `{productId}-{numero}.jpg`
   - Exemplo: `biore-uv-1.jpg`, `biore-uv-2.jpg`, etc.
3. **Redimensione** para ~600x600px (otimiza tamanho)
4. **Comprima** para reduzir espaço (use TinyPNG, ImageMagick)

---

## Passo 2: Configure Firebase Admin SDK

1. Vá para [Firebase Console](https://console.firebase.google.com/)
2. Selecione seu projeto
3. Vá para **Project Settings** (engrenagem no topo)
4. Clique na aba **Service Accounts**
5. Clique em **Generate New Private Key**
6. Salve o arquivo como `serviceAccountKey.json` **na raiz do projeto**

---

## Passo 3: Instale Dependências

```bash
npm install --save-dev firebase-admin
```

---

## Passo 4: Execute o Upload

```bash
npx ts-node upload-images.ts
```

Isso vai:
- ✅ Ler as imagens de `public/images/`
- ✅ Fazer upload para Firebase Storage
- ✅ Gerar um arquivo `image-urls.json` com as URLs

---

## Passo 5: Atualize os Produtos

O script gerará um arquivo `image-urls.json` similar a:

```json
{
  "biore-uv": [
    "https://storage.googleapis.com/seu-bucket.appspot.com/products/cosmeticos/biore-uv/biore-uv-1.jpg",
    "https://storage.googleapis.com/seu-bucket.appspot.com/products/cosmeticos/biore-uv/biore-uv-2.jpg",
    ...
  ],
  ...
}
```

Use essas URLs para atualizar `src/data/products.ts`:

```typescript
{
  id: 'biore-uv',
  name: 'Bioré UV...',
  image: 'https://storage.googleapis.com/.../biore-uv-1.jpg',
  gallery: [
    'https://storage.googleapis.com/.../biore-uv-1.jpg',
    'https://storage.googleapis.com/.../biore-uv-2.jpg',
    'https://storage.googleapis.com/.../biore-uv-3.jpg',
    'https://storage.googleapis.com/.../biore-uv-4.jpg',
    'https://storage.googleapis.com/.../biore-uv-5.jpg'
  ],
  ...
}
```

---

## 🎯 Checklist

- [ ] Pastas criadas em `public/images/`
- [ ] 200 imagens organizadas e nomeadas
- [ ] `serviceAccountKey.json` criado e salvo
- [ ] `firebase-admin` instalado
- [ ] `upload-images.ts` executado com sucesso
- [ ] `image-urls.json` gerado
- [ ] `src/data/products.ts` atualizado com URLs do Firebase
- [ ] Deploy realizado

---

## 📝 Nomes dos Produtos (para referência)

### Cosméticos (10)
- biore-uv
- hada-labo
- dhc-cleansing
- melano-cc
- senka-whip
- lululun-mask
- keana-mask
- curel-cream
- softymo-oil
- anessa-sun

### Doces (10)
- kitkat-matcha
- sencha-tea
- pocky-chocolate
- jagariko-calbee
- takenoko-meiji
- konjac-jelly
- matcha-powder
- hichew-candy
- kakijack
- royce-matcha

### Acessórios (10)
- luffy-figure
- kirby-plush
- muji-organizer
- tiger-bottle
- nerv-totebag
- demon-slayer-pad
- naruto-nendo
- divoom-speaker
- zojirushi-mug
- moon-cushion

### Papelaria (10)
- sakura-pens
- kokuyo-notebooks
- tombow-eraser
- washi-tape
- lihit-case
- pilot-kakuno
- tombow-pencil
- midori-notebook
- pentel-pens
- signo-dx

---

## ❓ Dúvidas?

- **Erro de autenticação?** Verifique se `serviceAccountKey.json` está salvo corretamente
- **Imagens não encontradas?** Verifique a estrutura de pastas e nomes
- **URLs quebradas?** Certifique-se que o bucket está público no Firebase

---

**Próximo passo**: Após fazer upload, execute `npm run build && vercel --prod` para atualizar o site com as novas URLs! 🚀
