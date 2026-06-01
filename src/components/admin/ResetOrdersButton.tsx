import React, { useState } from 'react';
import { Trash2, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { orderService } from '@/services/orderService';
import { useToast } from '@/hooks/use-toast';
import { requireAdminPassword } from '@/utils/adminGuard';

// Botão de RESET TOTAL do histórico de pedidos (localStorage + Firestore).
const ResetOrdersButton: React.FC = () => {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const handleReset = async () => {
    const ok = window.confirm(
      'Apagar TODO o histórico de pedidos?\n\n' +
      'Isso remove todos os pedidos do banco (Firestore) e do navegador, ' +
      'inclusive o histórico de "Comprar Novamente" dos clientes.\n\n' +
      'Esta ação NÃO pode ser desfeita.'
    );
    if (!ok) return;
    if (!requireAdminPassword('o reset do histórico de pedidos')) return;

    setBusy(true);
    try {
      const removed = await orderService.clearAllOrders();
      toast({
        title: '🧹 Histórico resetado',
        description: `${removed} pedido(s) removidos do banco + dados locais limpos. Recarregando...`,
      });
      setTimeout(() => window.location.reload(), 1200);
    } catch (e: any) {
      toast({ title: 'Erro ao resetar', description: e?.message, variant: 'destructive' });
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/10 p-5 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
          <AlertTriangle className="w-5 h-5 text-red-600" />
        </div>
        <div>
          <p className="font-semibold text-red-900 dark:text-red-300">Resetar histórico de pedidos</p>
          <p className="text-xs text-red-700 dark:text-red-400">
            Apaga todos os pedidos (banco + navegador). Use para limpar dados antigos/de teste.
          </p>
        </div>
      </div>
      <Button onClick={handleReset} disabled={busy} variant="destructive" size="sm" className="gap-2 shrink-0">
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
        {busy ? 'Apagando...' : 'Resetar'}
      </Button>
    </div>
  );
};

export default ResetOrdersButton;
