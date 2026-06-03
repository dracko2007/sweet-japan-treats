import React, { useEffect, useState } from 'react';
import { ShieldCheck, Loader2, Trash2, Plus, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { adminService, AdminEntry, AdminRole } from '@/services/adminService';
import { useUser } from '@/context/UserContext';
import { useToast } from '@/hooks/use-toast';
import { requireAdminPassword } from '@/utils/adminGuard';
import { isValidEmail } from '@/utils/validation';

const ROLE_LABEL: Record<number, string> = {
  1: 'Nível 1 — vê e gerencia (sem deletar, sem financeiro)',
  2: 'Nível 2 — Nível 1 + deletar',
  3: 'Nível 3 — completo (financeiro + admins)',
};
const ROLE_BADGE: Record<number, string> = {
  1: 'bg-gray-100 text-gray-700',
  2: 'bg-blue-100 text-blue-700',
  3: 'bg-amber-100 text-amber-800',
};

const AdminAccessManager: React.FC = () => {
  const { user, permissions } = useUser();
  const { toast } = useToast();
  const [list, setList] = useState<AdminEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AdminRole>(1);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setList(await adminService.getAdmins());
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  if (!permissions.canManageAdmins) {
    return (
      <div className="text-center py-16 bg-card rounded-2xl border border-border">
        <ShieldCheck className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Apenas administradores nível 3 podem gerenciar admins.</p>
      </div>
    );
  }

  const add = async () => {
    if (!isValidEmail(email)) { toast({ title: 'E-mail inválido', variant: 'destructive' }); return; }
    if (!requireAdminPassword(`adicionar o admin ${email}`)) return;
    setSaving(true);
    const ok = await adminService.addAdmin(email.trim(), role, user?.email || '');
    setSaving(false);
    if (ok) {
      toast({ title: '✅ Admin adicionado', description: `${email} (nível ${role})` });
      setEmail('');
      setRole(1);
      load();
    } else {
      toast({ title: 'Não foi possível adicionar', description: 'Verifique permissões/regras do Firestore.', variant: 'destructive' });
    }
  };

  const remove = async (e: string) => {
    if (!confirm(`Remover o acesso admin de ${e}?`)) return;
    if (!requireAdminPassword(`remover o admin ${e}`)) return;
    const ok = await adminService.removeAdmin(e);
    if (ok) { toast({ title: 'Admin removido', description: e }); load(); }
    else toast({ title: 'Não foi possível remover', variant: 'destructive' });
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-primary" /> Administradores
        </h2>
        <p className="text-sm text-muted-foreground">Gerencie quem tem acesso ao painel e o nível de cada um.</p>
      </div>

      {/* Adicionar admin */}
      <div className="bg-card rounded-2xl border border-border p-5 mb-6">
        <h3 className="font-semibold mb-3 flex items-center gap-2"><Plus className="w-4 h-4" /> Adicionar admin</h3>
        <div className="grid sm:grid-cols-[1fr_auto_auto] gap-3 items-end">
          <div>
            <label className="text-xs font-semibold block mb-1">E-mail</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="pessoa@email.com"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold block mb-1">Nível</label>
            <select
              value={role}
              onChange={(e) => setRole(Number(e.target.value) as AdminRole)}
              className="px-3 py-2 rounded-lg border border-border bg-background text-sm"
            >
              <option value={1}>Nível 1</option>
              <option value={2}>Nível 2</option>
              <option value={3}>Nível 3</option>
            </select>
          </div>
          <Button onClick={add} disabled={saving} className="btn-primary gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Adicionar
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">{ROLE_LABEL[role]}</p>
        <p className="text-[11px] text-amber-700 mt-1">
          ℹ️ A pessoa precisa ter (ou criar) uma conta de cliente com este e-mail. Ao logar, ela escolhe entrar como Admin ou Cliente.
        </p>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="py-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></div>
      ) : (
        <div className="space-y-2">
          {list.map((a) => {
            const isSuper = adminService.isSuperAdmin(a.email);
            return (
              <div key={a.email} className="bg-card rounded-xl border border-border p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-foreground flex items-center gap-1.5 truncate">
                    {isSuper && <Crown className="w-4 h-4 text-amber-500 shrink-0" />}
                    {a.email}
                  </p>
                  <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${ROLE_BADGE[a.role]}`}>
                    {ROLE_LABEL[a.role]}
                  </span>
                </div>
                {isSuper ? (
                  <span className="text-xs text-muted-foreground shrink-0">fixo</span>
                ) : (
                  <Button onClick={() => remove(a.email)} variant="outline" size="sm" className="gap-1.5 text-red-600 shrink-0">
                    <Trash2 className="w-4 h-4" /> Remover
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminAccessManager;
