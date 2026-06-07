import React, { useEffect, useState } from 'react';
import { Loader2, Save, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { paymentSettingsService, PaymentSettings } from '@/services/paymentSettingsService';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/context/UserContext';

const WisePaymentSettings: React.FC = () => {
  const { toast } = useToast();
  const { permissions } = useUser();
  const [settings, setSettings] = useState<PaymentSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    paymentSettingsService.get().then(setSettings);
  }, []);

  // Configuração de pagamento é financeiro → só nível 3
  if (!permissions.canFinancial) return null;
  if (!settings) return null;

  const save = async () => {
    setSaving(true);
    try {
      const clean: PaymentSettings = {
        wiseLink: settings.wiseLink.trim(),
        wiseEnabled: settings.wiseEnabled && !!settings.wiseLink.trim(),
        pixKey: settings.pixKey.trim(),
        pixReceiverName: settings.pixReceiverName.trim() || 'Japan Express',
        pixCity: settings.pixCity.trim() || 'Sao Paulo',
      };
      await paymentSettingsService.save(clean);
      setSettings(clean);
      toast({ title: '✅ Pagamento salvo', description: clean.pixKey ? 'Chave PIX configurada — o QR Code do checkout usa ela.' : 'Configurações salvas.' });
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-4 mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
            <Wallet className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <p className="font-semibold text-foreground">Pagamento Wise</p>
            <p className="text-xs text-muted-foreground">Cole seu link de cobrança Wise ou Wisetag — aparece no checkout internacional.</p>
          </div>
        </div>
        <Button onClick={save} disabled={saving} size="sm" className="gap-2 shrink-0">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar
        </Button>
      </div>

      <input
        value={settings.wiseLink}
        onChange={(e) => setSettings({ ...settings, wiseLink: e.target.value })}
        placeholder="https://wise.com/pay/me/seunome  ou  @seuwisetag"
        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm mb-2"
      />
      <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
        <input
          type="checkbox"
          checked={settings.wiseEnabled}
          onChange={(e) => setSettings({ ...settings, wiseEnabled: e.target.checked })}
          className="w-4 h-4 rounded border-input text-primary"
        />
        Mostrar a opção <strong>Wise</strong> no checkout (precisa do link preenchido)
      </label>

      {/* Seção PIX */}
      <div className="mt-5 pt-5 border-t border-border space-y-2">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
            <Wallet className="w-4 h-4 text-orange-600" />
          </div>
          <div>
            <p className="font-semibold text-foreground text-sm">Chave PIX (Brasil)</p>
            <p className="text-xs text-muted-foreground">A chave abaixo gera o QR Code / Copia e Cola que o cliente paga.</p>
          </div>
        </div>
        <input
          value={settings.pixKey}
          onChange={(e) => setSettings({ ...settings, pixKey: e.target.value })}
          placeholder="Chave PIX (e-mail, CPF, telefone ou aleatória)"
          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            value={settings.pixReceiverName}
            onChange={(e) => setSettings({ ...settings, pixReceiverName: e.target.value })}
            placeholder="Nome do recebedor (máx 25)"
            maxLength={25}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
          />
          <input
            value={settings.pixCity}
            onChange={(e) => setSettings({ ...settings, pixCity: e.target.value })}
            placeholder="Cidade (máx 15)"
            maxLength={15}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
          />
        </div>
        <p className="text-[11px] text-muted-foreground">
          O nome e a cidade devem ser os mesmos cadastrados na sua conta do banco/PIX.
        </p>
      </div>
    </div>
  );
};

export default WisePaymentSettings;
