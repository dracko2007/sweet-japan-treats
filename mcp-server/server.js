#!/usr/bin/env node
/**
 * MCP do Japan Express (japanexpress-store.com) — catálogo + conteúdo da home.
 *
 * Fala Firestore diretamente via Admin SDK (serviceAccountKey.json na raiz do
 * projeto, mesmo arquivo que os scripts em scripts/*.cjs já usam) — sem
 * passar pelo login do painel /admin. Escopo desta sessão de configuração:
 * produtos (CRUD + flags de destaque) e conteúdo editável da home
 * (siteContent/home, siteContent/homePromotion, siteContent/settings,
 * categorias). Pedidos, cupons e financeiro ficam fora — quem precisar disso
 * continua usando o painel /admin.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import admin from 'firebase-admin';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

const serviceAccount = JSON.parse(
  readFileSync(join(projectRoot, 'serviceAccountKey.json'), 'utf8'),
);
admin.initializeApp({ credential: admin.cert(serviceAccount) });
const db = getFirestore();

const PRODUCTS_COL = 'products';
const CATEGORIES_DOC = ['settings', 'product_categories'];

const slugify = (s) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40) || `produto-${Date.now()}`;

/** Gera um id único a partir do nome, tentando o slug puro antes de anexar sufixo. */
async function uniqueProductId(name) {
  const base = slugify(name);
  let candidate = base;
  let n = 1;
  while ((await db.collection(PRODUCTS_COL).doc(candidate).get()).exists) {
    n += 1;
    candidate = `${base}-${n}`;
  }
  return candidate;
}

const priceVariantSchema = z.object({
  id: z.string(),
  label: z.string(),
  price: z.number().int().nonnegative(),
});

const productWriteFields = {
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  image: z.string().optional(),
  thumbnail: z.string().optional(),
  gallery: z.array(z.string()).optional(),
  prices: z.object({ small: z.number().int().nonnegative(), large: z.number().int().nonnegative() }).optional(),
  variants: z.array(priceVariantSchema).optional(),
  flavor: z.string().optional(),
  tags: z.array(z.string()).optional(),
  weightGrams: z.number().nonnegative().optional(),
  discountPercent: z.number().min(0).max(100).optional(),
  hidden: z.boolean().optional(),
  featured: z.boolean().optional(),
  heroCarousel: z.boolean().optional(),
  isNew: z.boolean().optional(),
  rating: z.number().min(0).max(5).optional(),
  salesCount: z.number().int().nonnegative().optional(),
  noPsFee: z.boolean().optional(),
};

const server = new McpServer({ name: 'japanexpress-mcp', version: '1.0.0' });

server.registerTool(
  'list_products',
  {
    title: 'Listar produtos',
    description:
      'Lista produtos do catálogo Japan Express. Filtra por categoria, tag, ou visibilidade; corta em `limit` itens (padrão 50).',
    inputSchema: {
      category: z.string().optional(),
      tag: z.string().optional(),
      hidden: z.boolean().optional().describe('true = só ocultos, false = só visíveis, omitido = ambos'),
      limit: z.number().int().positive().max(500).optional(),
    },
  },
  async ({ category, tag, hidden, limit = 50 }) => {
    const snap = await db.collection(PRODUCTS_COL).get();
    let items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (category) items = items.filter((p) => p.category === category);
    if (tag) items = items.filter((p) => (p.tags || []).includes(tag));
    if (hidden !== undefined) items = items.filter((p) => Boolean(p.hidden) === hidden);
    items = items.slice(0, limit);
    return { content: [{ type: 'text', text: JSON.stringify(items, null, 2) }] };
  },
);

server.registerTool(
  'get_product',
  {
    title: 'Ver produto',
    description: 'Retorna todos os campos de um produto pelo id.',
    inputSchema: { id: z.string() },
  },
  async ({ id }) => {
    const doc = await db.collection(PRODUCTS_COL).doc(id).get();
    if (!doc.exists) {
      return { content: [{ type: 'text', text: `Produto "${id}" não existe.` }], isError: true };
    }
    return { content: [{ type: 'text', text: JSON.stringify({ id: doc.id, ...doc.data() }, null, 2) }] };
  },
);

server.registerTool(
  'create_product',
  {
    title: 'Criar produto',
    description:
      'Cria um produto novo. Precisa de `name`, `description`, `category`, `image` e (`prices` ou `variants`) — o id é gerado a partir do nome (slug). Retorna o produto criado com o id definitivo.',
    inputSchema: {
      name: z.string().min(1),
      description: z.string(),
      category: z.string(),
      image: z.string(),
      ...productWriteFields,
    },
  },
  async (fields) => {
    if (!fields.prices && !fields.variants) {
      return {
        content: [{ type: 'text', text: 'Informe `prices` ({small,large} em ¥) ou `variants`.' }],
        isError: true,
      };
    }
    const id = await uniqueProductId(fields.name);
    const doc = {
      ...fields,
      flavor: fields.flavor ?? '',
      hidden: fields.hidden ?? false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    await db.collection(PRODUCTS_COL).doc(id).set(doc);
    return { content: [{ type: 'text', text: JSON.stringify({ id, ...fields }, null, 2) }] };
  },
);

server.registerTool(
  'update_product',
  {
    title: 'Atualizar produto',
    description:
      'Atualiza campos de um produto existente (merge — só envie os campos que quer mudar). Use para editar descrição, preço, tags, marcar heroCarousel/featured, ocultar (hidden), etc.',
    inputSchema: { id: z.string(), ...productWriteFields },
  },
  async ({ id, ...fields }) => {
    const ref = db.collection(PRODUCTS_COL).doc(id);
    if (!(await ref.get()).exists) {
      return { content: [{ type: 'text', text: `Produto "${id}" não existe.` }], isError: true };
    }
    await ref.set({ ...fields, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    const updated = await ref.get();
    return { content: [{ type: 'text', text: JSON.stringify({ id, ...updated.data() }, null, 2) }] };
  },
);

server.registerTool(
  'delete_product',
  {
    title: 'Excluir produto (permanente)',
    description:
      'Apaga o produto do Firestore definitivamente. Prefira `update_product` com `hidden: true` para apenas tirar da vitrine sem perder o cadastro.',
    inputSchema: { id: z.string() },
  },
  async ({ id }) => {
    await db.collection(PRODUCTS_COL).doc(id).delete();
    return { content: [{ type: 'text', text: `Produto "${id}" excluído.` }] };
  },
);

server.registerTool(
  'list_categories',
  {
    title: 'Listar categorias',
    description: 'Lista as categorias de produto (padrão + personalizadas cadastradas no Firestore).',
    inputSchema: {},
  },
  async () => {
    const doc = await db.collection(CATEGORIES_DOC[0]).doc(CATEGORIES_DOC[1]).get();
    const custom = doc.exists ? doc.data().list || [] : [];
    return { content: [{ type: 'text', text: JSON.stringify(custom, null, 2) }] };
  },
);

server.registerTool(
  'upsert_category',
  {
    title: 'Criar/editar categoria personalizada',
    description:
      'Cria ou edita uma categoria personalizada (id, label, icon — ex.: emoji). Categorias padrão do site (cosmeticos, doces, acessorios, ...) não podem ser editadas por aqui.',
    inputSchema: { id: z.string(), label: z.string(), icon: z.string().optional() },
  },
  async ({ id, label, icon }) => {
    const ref = db.collection(CATEGORIES_DOC[0]).doc(CATEGORIES_DOC[1]);
    const doc = await ref.get();
    const list = doc.exists ? doc.data().list || [] : [];
    const next = list.filter((c) => c.id !== id);
    next.push({ id, label, icon: icon || '🌸' });
    await ref.set({ list: next }, { merge: true });
    return { content: [{ type: 'text', text: JSON.stringify({ id, label, icon }, null, 2) }] };
  },
);

server.registerTool(
  'get_home_content',
  {
    title: 'Ver conteúdo da home',
    description: 'Retorna o conteúdo editável da home (siteContent/home): título/subtítulo de vídeos e lista de vídeos promo.',
    inputSchema: {},
  },
  async () => {
    const doc = await db.collection('siteContent').doc('home').get();
    return { content: [{ type: 'text', text: JSON.stringify(doc.exists ? doc.data() : {}, null, 2) }] };
  },
);

server.registerTool(
  'update_home_content',
  {
    title: 'Editar conteúdo da home',
    description: 'Atualiza (merge) o conteúdo editável da home: videosTitle, videosSubtitle, videos ([{id,title,url}]).',
    inputSchema: {
      videosTitle: z.string().optional(),
      videosSubtitle: z.string().optional(),
      videos: z.array(z.object({ id: z.string(), title: z.string(), url: z.string() })).optional(),
    },
  },
  async (fields) => {
    await db.collection('siteContent').doc('home').set({ ...fields, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return { content: [{ type: 'text', text: 'Conteúdo da home atualizado.' }] };
  },
);

server.registerTool(
  'get_home_promotion',
  {
    title: 'Ver promoção ativa da home',
    description: 'Retorna a promoção em destaque no hero cinematográfico da home (siteContent/homePromotion), se houver.',
    inputSchema: {},
  },
  async () => {
    const doc = await db.collection('siteContent').doc('homePromotion').get();
    return { content: [{ type: 'text', text: doc.exists ? JSON.stringify(doc.data(), null, 2) : 'Nenhuma promoção ativa.' }] };
  },
);

server.registerTool(
  'set_home_promotion',
  {
    title: 'Definir/limpar promoção ativa da home',
    description:
      'Define a promoção que aparece como primeiro painel do hero cinematográfico. Envie `clear: true` para remover a promoção ativa (volta ao carrossel padrão).',
    inputSchema: {
      clear: z.boolean().optional(),
      name: z.string().optional(),
      description: z.string().optional(),
      image: z.string().optional(),
      priceYen: z.number().int().nonnegative().optional(),
      originalPriceYen: z.number().int().nonnegative().optional(),
      link: z.string().optional(),
      expiresAt: z.number().int().optional().describe('timestamp ms; omitido = sem prazo'),
    },
  },
  async ({ clear, ...fields }) => {
    const ref = db.collection('siteContent').doc('homePromotion');
    if (clear) {
      await ref.delete();
      return { content: [{ type: 'text', text: 'Promoção da home removida.' }] };
    }
    await ref.set({ ...fields, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return { content: [{ type: 'text', text: JSON.stringify(fields, null, 2) }] };
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('japanexpress-mcp falhou ao iniciar:', err);
  process.exit(1);
});
