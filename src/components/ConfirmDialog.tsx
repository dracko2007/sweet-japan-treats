import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { AlertTriangle, Loader2, Lock } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useUser } from '@/context/UserContext';
import { useToast } from '@/hooks/use-toast';
import { verifyAdminPassword } from '@/utils/adminGuard';

/**
 * Padrão único de confirmação do site (substitui confirm/prompt/alert nativos).
 *
 * Regra de exclusão em 2 níveis:
 *  - nível 1: confirmação (o que será apagado / o que fica);
 *  - nível 2 (`password`): também exige a senha do admin, na própria janela —
 *    pedidos, clientes, dados financeiros e ações em massa.
 *
 * A ação vai em `onConfirm`: roda com o botão em "carregando" (sem clique
 * duplo) e, se lançar erro, a mensagem aparece na janela, que continua aberta.
 */
export interface ConfirmField {
  name: string;
  label: string;
  type?: 'text' | 'number';
  defaultValue?: string;
  placeholder?: string;
  hint?: string;
  required?: boolean;
}

export type ConfirmValues = Record<string, string>;

export interface ConfirmOptions {
  title: string;
  description?: React.ReactNode;
  /** Consequências, uma por linha (ex.: "Os pedidos continuam no financeiro"). */
  details?: string[];
  confirmLabel?: string;
  /** Ação destrutiva: botão vermelho e rótulo padrão "Excluir". */
  destructive?: boolean;
  /** Nível 2: exige a senha do admin. */
  password?: boolean;
  /** Permissão mínima; sem ela a janela nem abre (toast "Sem permissão"). */
  permission?: 'delete' | 'financial';
  fields?: ConfirmField[];
  onConfirm?: (values: ConfirmValues) => Promise<void> | void;
}

type Open = (options: ConfirmOptions) => Promise<ConfirmValues | null>;

const ConfirmContext = createContext<Open | null>(null);

const PERMISSION_TEXT = {
  delete: 'Seu nível de admin não permite excluir (Nível 2+).',
  financial: 'Esta ação é financeira (Nível 3).',
} as const;

export const ConfirmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [values, setValues] = useState<ConfirmValues>({});
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const resolver = useRef<((result: ConfirmValues | null) => void) | null>(null);

  const open = useCallback<Open>((next) => {
    resolver.current?.(null);
    setOptions(next);
    setValues(Object.fromEntries((next.fields ?? []).map((f) => [f.name, f.defaultValue ?? ''])));
    setPassword('');
    setError('');
    setBusy(false);
    const { promise, resolve } = Promise.withResolvers<ConfirmValues | null>();
    resolver.current = resolve;
    return promise;
  }, []);

  const finish = (result: ConfirmValues | null) => {
    resolver.current?.(result);
    resolver.current = null;
    setOptions(null);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!options || busy) return;
    const missing = options.fields?.find((f) => f.required !== false && !values[f.name]?.trim());
    if (missing) { setError(`Preencha "${missing.label}".`); return; }
    setBusy(true);
    setError('');
    try {
      if (options.password && !(await verifyAdminPassword(password))) {
        setError('Senha incorreta.');
        return;
      }
      await options.onConfirm?.(values);
      finish(values);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Não foi possível concluir. Tente de novo.');
    } finally {
      setBusy(false);
    }
  };

  const destructive = !!options?.destructive;

  return (
    <ConfirmContext.Provider value={open}>
      {children}
      <Dialog open={!!options} onOpenChange={(isOpen) => { if (!isOpen && !busy) finish(null); }}>
        <DialogContent className="max-w-md rounded-2xl" onInteractOutside={(e) => { if (busy) e.preventDefault(); }}>
          {options && (
            <form onSubmit={submit} className="space-y-4">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {destructive && <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" aria-hidden />}
                  {options.title}
                </DialogTitle>
                {options.description && <DialogDescription>{options.description}</DialogDescription>}
              </DialogHeader>

              {!!options.details?.length && (
                <ul className="space-y-1 rounded-xl bg-muted/60 px-4 py-3 text-sm text-muted-foreground">
                  {options.details.map((line) => <li key={line}>• {line}</li>)}
                </ul>
              )}

              {options.fields?.map((field, index) => (
                <div key={field.name} className="space-y-1.5">
                  <Label htmlFor={`confirm-${field.name}`}>{field.label}</Label>
                  <Input
                    id={`confirm-${field.name}`}
                    type={field.type ?? 'text'}
                    inputMode={field.type === 'number' ? 'decimal' : undefined}
                    placeholder={field.placeholder}
                    value={values[field.name] ?? ''}
                    onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.value }))}
                    autoFocus={index === 0}
                    disabled={busy}
                  />
                  {field.hint && <p className="text-xs text-muted-foreground">{field.hint}</p>}
                </div>
              ))}

              {options.password && (
                <div className="space-y-1.5">
                  <Label htmlFor="confirm-password" className="flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5" aria-hidden /> Senha do admin
                  </Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoFocus={!options.fields?.length}
                    disabled={busy}
                  />
                </div>
              )}

              {error && (
                <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}

              <DialogFooter className="gap-2 sm:gap-0">
                <Button type="button" variant="outline" onClick={() => finish(null)} disabled={busy}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant={destructive ? 'destructive' : 'default'}
                  disabled={busy || (options.password && !password)}
                >
                  {busy && <Loader2 className="animate-spin" aria-hidden />}
                  {options.confirmLabel ?? (destructive ? 'Excluir' : 'Confirmar')}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  );
};

/**
 * `const confirm = useConfirm();`
 * `if (!(await confirm({ ... }))) return;` — resolve com os valores dos campos
 * (objeto vazio sem campos) quando confirmado e `null` quando cancelado/sem permissão.
 */
export const useConfirm = (): Open => {
  const open = useContext(ConfirmContext);
  if (!open) throw new Error('useConfirm precisa de <ConfirmProvider>');
  const { permissions } = useUser();
  const { toast } = useToast();
  return useCallback<Open>((options) => {
    const allowed = options.permission === 'financial'
      ? permissions.canFinancial
      : options.permission === 'delete' ? permissions.canDelete : true;
    if (!allowed) {
      toast({ title: 'Sem permissão', description: PERMISSION_TEXT[options.permission!], variant: 'destructive' });
      return Promise.resolve(null);
    }
    return open(options);
  }, [open, permissions.canDelete, permissions.canFinancial, toast]);
};
