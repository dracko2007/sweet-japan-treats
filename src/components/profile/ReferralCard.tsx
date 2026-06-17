import React, { useState } from 'react';
import { Copy, Check, Users, Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUser } from '@/context/UserContext';
import { useToast } from '@/hooks/use-toast';
import { referralService } from '@/services/referralService';

const ReferralCard: React.FC = () => {
  const { user } = useUser();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  if (!user?.id) return null;

  const link = referralService.getReferralLink(user.id);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    toast({ title: 'Link copiado!', description: 'Compartilhe com seus amigos.' });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-gradient-to-br from-orange-50 to-pink-50 border border-orange-100 rounded-2xl p-5">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center shrink-0">
          <Users className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="font-bold text-foreground">Apresente um Amigo</h3>
          <p className="text-sm text-muted-foreground">Ganhe <strong>3.000 pontos</strong> quando seu amigo atingir R$ 3.000 em compras</p>
        </div>
      </div>

      <div className="bg-white border border-orange-100 rounded-xl p-3 mb-3">
        <p className="text-xs text-muted-foreground mb-1 font-medium">Seu link exclusivo</p>
        <div className="flex items-center gap-2">
          <p className="text-xs font-mono text-foreground flex-1 truncate">{link}</p>
          <Button size="sm" variant="outline" className="h-7 px-2.5 gap-1 shrink-0" onClick={handleCopy}>
            {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copiado' : 'Copiar'}
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-white/60 rounded-lg px-3 py-2">
        <Gift className="w-3.5 h-3.5 text-orange-400 shrink-0" />
        <span>Seu amigo também ganha um <strong>cupom de boas-vindas</strong> ao se cadastrar</span>
      </div>
    </div>
  );
};

export default ReferralCard;
