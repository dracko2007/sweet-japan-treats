import { ADMIN_PASSWORD } from '@/config/admin';

// Exige a senha do admin antes de ações destrutivas (excluir pedido/cliente,
// resetar histórico). Evita exclusões acidentais.
// Retorna true só se a senha digitada bater com a do admin.
export function requireAdminPassword(action = 'esta ação'): boolean {
  const input = window.prompt(`🔒 Digite a senha do admin para confirmar ${action}:`);
  if (input === null) return false; // cancelou
  if (input === ADMIN_PASSWORD) return true;
  window.alert('❌ Senha incorreta. Ação cancelada.');
  return false;
}
