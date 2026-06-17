import React, { useState, useEffect } from 'react';
import { X, Mail, Send, Users, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { customerService } from '@/services/customerService';

const RESEND_API_KEY = import.meta.env.VITE_RESEND_API_KEY;
const FROM_EMAIL = import.meta.env.VITE_FROM_EMAIL || 'onboarding@resend.dev';

interface PromoNotificationModalProps {
  onClose: () => void;
}

const PromoNotificationModal: React.FC<PromoNotificationModalProps> = ({ onClose }) => {
  const [subject, setSubject] = useState('🌸 Promoção Especial - Japan Express');
  const [body, setBody] = useState(
    'Olá {nome}!\n\nTemos uma promoção especial para você! Acesse nossa loja e confira as ofertas exclusivas.\n\nAcesse: https://japanexpress-store.com\n\nEquipe Japan Express 🌸'
  );
  const [recipients, setRecipients] = useState<{ email: string; name: string }[]>([]);
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<{ email: string; ok: boolean }[]>([]);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const customers = customerService.getAllCustomers();
    const list = customers
      .filter(c => c.email && c.email.includes('@'))
      .map(c => ({ email: c.email, name: c.name || 'Cliente' }));
    setRecipients(list);
  }, []);

  const buildHtml = (name: string) => {
    const personalized = body.replace(/\{nome\}/gi, name);
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">
    <div style="background:linear-gradient(135deg,#e11d48,#9333ea);padding:32px;text-align:center">
      <h1 style="color:#fff;margin:0;font-size:28px">🌸 Japan Express</h1>
    </div>
    <div style="padding:32px">
      <pre style="white-space:pre-wrap;font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#333;margin:0">${personalized}</pre>
    </div>
    <div style="background:#f9f9f9;padding:16px;text-align:center;font-size:12px;color:#999">
      Japan Express · <a href="https://japanexpress-store.com" style="color:#e11d48">japanexpress-store.com</a>
    </div>
  </div>
</body>
</html>`;
  };

  const sendEmails = async () => {
    if (!RESEND_API_KEY) {
      alert('VITE_RESEND_API_KEY não configurada. Configure no Vercel para enviar e-mails.');
      return;
    }
    if (recipients.length === 0) {
      alert('Nenhum cliente cadastrado encontrado.');
      return;
    }

    setSending(true);
    setResults([]);
    const partial: { email: string; ok: boolean }[] = [];

    for (const r of recipients) {
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: FROM_EMAIL,
            to: r.email,
            subject,
            html: buildHtml(r.name),
          }),
        });
        partial.push({ email: r.email, ok: res.ok });
      } catch {
        partial.push({ email: r.email, ok: false });
      }
      setResults([...partial]);
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    setSending(false);
    setSent(true);
  };

  const successCount = results.filter(r => r.ok).length;
  const failCount = results.filter(r => !r.ok).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" />
            <h2 className="font-bold text-lg">Notificação Promocional</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-secondary">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Recipients info */}
          <div className="flex items-center gap-2 text-sm bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 rounded-lg px-3 py-2">
            <Users className="w-4 h-4 shrink-0" />
            <span>{recipients.length} cliente(s) cadastrado(s) receberão este e-mail</span>
          </div>

          {/* Subject */}
          <div>
            <label className="block text-sm font-semibold mb-1">Assunto</label>
            <input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Assunto do e-mail..."
            />
          </div>

          {/* Body */}
          <div>
            <label className="block text-sm font-semibold mb-1">
              Mensagem <span className="text-muted-foreground font-normal">(use {'{nome}'} para personalizar)</span>
            </label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={10}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-y"
              placeholder="Mensagem da promoção..."
            />
          </div>

          {/* PWA push note */}
          <div className="text-xs text-muted-foreground bg-secondary/50 rounded-lg px-3 py-2">
            💡 <strong>Notificação push PWA:</strong> requer configuração de VAPID keys + Firebase Cloud Messaging. Por enquanto apenas e-mail é enviado.
          </div>

          {/* Results */}
          {results.length > 0 && (
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="bg-secondary px-3 py-2 text-sm font-semibold flex items-center justify-between">
                <span>Resultado ({successCount} ok / {failCount} erro)</span>
                {sent && !sending && (
                  <span className={successCount > 0 ? 'text-green-600' : 'text-red-600'}>
                    {successCount > 0 ? '✓ Enviado' : '✗ Falhou'}
                  </span>
                )}
              </div>
              <div className="max-h-48 overflow-y-auto divide-y divide-border">
                {results.map(r => (
                  <div key={r.email} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                    {r.ok
                      ? <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
                      : <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                    <span className="truncate">{r.email}</span>
                    <span className={r.ok ? 'text-green-600 ml-auto' : 'text-red-500 ml-auto'}>
                      {r.ok ? 'ok' : 'erro'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-border flex gap-3 justify-end">
          <Button variant="outline" onClick={onClose}>Fechar</Button>
          <Button
            onClick={sendEmails}
            disabled={sending || sent || recipients.length === 0}
            className="gap-2"
          >
            {sending ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Enviando {results.length}/{recipients.length}...</>
            ) : sent ? (
              <><CheckCircle className="w-4 h-4" /> Concluído</>
            ) : (
              <><Send className="w-4 h-4" /> Enviar para {recipients.length} clientes</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PromoNotificationModal;
