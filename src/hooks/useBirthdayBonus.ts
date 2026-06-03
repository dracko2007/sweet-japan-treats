import { useEffect, useRef } from 'react';
import { useUser } from '@/context/UserContext';
import { useToast } from '@/hooks/use-toast';
import { POINTS } from '@/services/pointsService';

/**
 * No aniversário do cliente, concede 1000 pontos (uma vez por ano),
 * mostra mensagem de feliz aniversário e notifica o ganho.
 */
export function useBirthdayBonus() {
  const { user, isAuthenticated, addPoints, updateProfile } = useUser();
  const { toast } = useToast();
  const checked = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || !user?.birthdate || checked.current) return;

    const today = new Date();
    const bd = new Date(user.birthdate);
    if (isNaN(bd.getTime())) return;

    const isBirthday = bd.getMonth() === today.getMonth() && bd.getDate() === today.getDate();
    const alreadyGiven = user.birthdayBonusYear === today.getFullYear();

    if (isBirthday && !alreadyGiven) {
      checked.current = true;
      addPoints(POINTS.birthday);
      updateProfile({ birthdayBonusYear: today.getFullYear() });
      toast({
        title: '🎂 Feliz aniversário, ' + (user.name?.split(' ')[0] || '') + '!',
        description: `Você ganhou ${POINTS.birthday} pontos (¥${POINTS.birthday}) para usar na sua próxima compra. 🎉`,
        duration: 10000,
      });
    }
  }, [isAuthenticated, user, addPoints, updateProfile, toast]);
}
