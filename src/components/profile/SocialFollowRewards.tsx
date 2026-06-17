import React, { useEffect, useState } from 'react';
import { Check, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUser } from '@/context/UserContext';
import { useToast } from '@/hooks/use-toast';
import { socialFollowService, SocialNetwork, SOCIAL_CONFIG, SOCIAL_POINTS } from '@/services/socialFollowService';

const SocialFollowRewards: React.FC = () => {
  const { user, addPoints } = useUser();
  const { toast } = useToast();
  const [followed, setFollowed] = useState<Partial<Record<SocialNetwork, boolean>>>({});
  const [opened, setOpened] = useState<Partial<Record<SocialNetwork, boolean>>>({});
  const [loading, setLoading] = useState<SocialNetwork | null>(null);

  useEffect(() => {
    if (user?.id) socialFollowService.getFollowedNetworks(user.id).then(setFollowed);
  }, [user?.id]);

  const handleOpen = (net: SocialNetwork) => {
    window.open(SOCIAL_CONFIG[net].url, '_blank');
    setOpened(o => ({ ...o, [net]: true }));
  };

  const handleConfirm = async (net: SocialNetwork) => {
    if (!user?.id) return;
    setLoading(net);
    const { ok, alreadyClaimed } = await socialFollowService.confirmFollow(user.id, net);
    if (alreadyClaimed) {
      toast({ title: 'Já contabilizado', description: `Você já ganhou pontos por seguir o ${SOCIAL_CONFIG[net].label}.` });
    } else if (ok) {
      addPoints(SOCIAL_POINTS);
      setFollowed(f => ({ ...f, [net]: true }));
      toast({ title: `+${SOCIAL_POINTS} pontos!`, description: `Obrigado por seguir o ${SOCIAL_CONFIG[net].label}! 🎉` });
    } else {
      toast({ title: 'Erro', description: 'Tente novamente.', variant: 'destructive' });
    }
    setLoading(null);
  };

  const networks = Object.entries(SOCIAL_CONFIG) as [SocialNetwork, typeof SOCIAL_CONFIG[SocialNetwork]][];
  const totalEarnable = networks.filter(([net]) => !followed[net]).length * SOCIAL_POINTS;

  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-foreground">Siga nossas redes sociais</h3>
          <p className="text-sm text-muted-foreground">+{SOCIAL_POINTS} pontos por rede seguida — uma única vez</p>
        </div>
        {totalEarnable > 0 && (
          <span className="text-xs font-bold bg-orange-100 text-orange-700 px-2.5 py-1 rounded-full">
            Até +{totalEarnable} pts disponíveis
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {networks.map(([net, cfg]) => (
          <div key={net} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border bg-background">
            <div className="flex items-center gap-2.5">
              <div className={`w-8 h-8 rounded-full ${cfg.color} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                {cfg.label[0]}
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{cfg.label}</p>
                <p className="text-xs text-muted-foreground">+{SOCIAL_POINTS} pts</p>
              </div>
            </div>
            {followed[net] ? (
              <span className="flex items-center gap-1 text-xs font-bold text-green-600">
                <Check className="w-3.5 h-3.5" /> Seguido
              </span>
            ) : opened[net] ? (
              <Button size="sm" className="text-xs h-7 px-3" onClick={() => handleConfirm(net)} disabled={loading === net}>
                {loading === net ? '...' : 'Confirmar'}
              </Button>
            ) : (
              <Button size="sm" variant="outline" className="text-xs h-7 px-3 gap-1" onClick={() => handleOpen(net)}>
                Seguir <ExternalLink className="w-3 h-3" />
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SocialFollowRewards;
