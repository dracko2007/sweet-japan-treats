#!/bin/bash
# Deploy das regras de segurança do Firestore para produção.
# Rodar uma vez após qualquer alteração em firestore.rules.
# Requer: npm install -g firebase-tools && firebase login

set -e
echo "🔒 Deployando regras do Firestore..."
firebase deploy --only firestore:rules
echo "✅ Regras deployadas com sucesso!"
