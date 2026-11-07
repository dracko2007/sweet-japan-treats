#!/usr/bin/env node
// Firebase CLI executes predeploy hooks through its bundled runtime. Keep this
// guard CommonJS so `firebase deploy --dry-run` works across CLI versions.
if (process.env.RULES_DEPLOY_OK === '1') {
  console.log('[guard-rules] RULES_DEPLOY_OK=1 — seguindo com o deploy.');
  process.exit(0);
}

console.error(`
[guard-rules] Deploy de regras bloqueado.

  Este comando publica as regras INTEIRAS (firestore.rules e/ou storage.rules).
  O storage.rules daqui já ficou diferente do que está no ar uma vez. Antes de
  soltar, veja o que muda em produção:

      node scripts/rules-history.mjs diff

  Publicar pelo script:

      node scripts/rules-history.mjs publish

  Se ainda assim quiser o deploy do firebase-tools:

      RULES_DEPLOY_OK=1 firebase deploy --only firestore:rules,storage
`);
process.exit(1);
