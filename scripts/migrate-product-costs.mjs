#!/usr/bin/env node
/**
 * Move o custo dos produtos de `products/{id}.cost` (leitura pública) para
 * `productCosts/{id}` (só admin).
 *
 *   node scripts/migrate-product-costs.mjs            só mostra o que faria
 *   node scripts/migrate-product-costs.mjs --apply    migra (grava backup antes)
 *
 * Antes de apagar qualquer coisa, grava `backups/product-costs-<data>.json`
 * com o custo de cada produto. Para desfazer, basta regravar `cost` nos
 * produtos a partir desse arquivo.
 *
 * Seguro rodar de novo: produto sem `cost` no doc público é ignorado, e um
 * custo já existente em productCosts não é sobrescrito.
 *
 * Não mexe em `updatedAt` do produto: o custo não faz parte do catálogo
 * público, então nenhum cliente precisa ressincronizar.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { cert, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import process from 'node:process';

const apply = process.argv.includes('--apply');
const conta = JSON.parse(readFileSync(new URL('../serviceAccountKey.json', import.meta.url), 'utf8'));
initializeApp({ credential: cert(conta) });
const db = getFirestore();

const [produtos, custos] = await Promise.all([
  db.collection('products').get(),
  db.collection('productCosts').get(),
]);
const jaMigrados = new Set(custos.docs.map((d) => d.id));

const pendentes = [];
for (const d of produtos.docs) {
  const data = d.data();
  if (!Object.prototype.hasOwnProperty.call(data, 'cost')) continue;
  const n = Number(data.cost);
  const cost = Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
  pendentes.push({ id: d.id, name: String(data.name || ''), cost, raw: data.cost, jaTemCusto: jaMigrados.has(d.id) });
}

console.log(`Projeto: ${conta.project_id}`);
console.log(`Produtos: ${produtos.size} · com "cost" no doc público: ${pendentes.length} · já em productCosts: ${jaMigrados.size}`);
console.log(`  com custo > 0: ${pendentes.filter((p) => p.cost > 0).length} · custo 0/vazio: ${pendentes.filter((p) => p.cost === 0).length}`);

if (!apply) {
  console.log('\nNada foi alterado. Para migrar: node scripts/migrate-product-costs.mjs --apply');
  process.exit(0);
}
if (!pendentes.length) {
  console.log('Nada a migrar.');
  process.exit(0);
}

mkdirSync(new URL('../backups/', import.meta.url), { recursive: true });
const carimbo = new Date().toISOString().replace(/[:.]/g, '-');
const arquivo = new URL(`../backups/product-costs-${carimbo}.json`, import.meta.url);
writeFileSync(arquivo, JSON.stringify({ project: conta.project_id, at: new Date().toISOString(), items: pendentes }, null, 2));
console.log(`Backup: ${arquivo.pathname}`);

// 1) copia; 2) confere; 3) só então apaga do doc público.
const LOTE = 200; // cada produto usa 2 escritas; limite do batch é 500
for (let i = 0; i < pendentes.length; i += LOTE) {
  const batch = db.batch();
  for (const p of pendentes.slice(i, i + LOTE)) {
    if (!p.jaTemCusto) {
      batch.set(db.collection('productCosts').doc(p.id), { cost: p.cost, updatedAt: FieldValue.serverTimestamp() });
    }
  }
  await batch.commit();
}

const conferencia = await db.collection('productCosts').get();
const gravados = new Map(conferencia.docs.map((d) => [d.id, d.data().cost]));
const faltando = pendentes.filter((p) => !gravados.has(p.id));
if (faltando.length) {
  console.error(`ERRO: ${faltando.length} custo(s) não apareceram em productCosts. Nada foi apagado.`);
  process.exit(1);
}

for (let i = 0; i < pendentes.length; i += LOTE) {
  const batch = db.batch();
  for (const p of pendentes.slice(i, i + LOTE)) {
    batch.update(db.collection('products').doc(p.id), { cost: FieldValue.delete() });
  }
  await batch.commit();
}

console.log(`Migrados: ${pendentes.length}. O campo "cost" saiu dos documentos públicos.`);
