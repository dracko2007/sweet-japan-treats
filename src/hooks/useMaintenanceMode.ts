import { useState, useEffect } from 'react';
import { db, auth } from '@/config/firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

// Controla o modo manutenção (flag em Firestore settings/maintenance).
// Usa onSnapshot para atualizar todos os tabs/usuários em tempo real.
// FAIL-SAFE: qualquer erro de leitura mantém o site NORMAL (nunca trava).
export const useMaintenanceMode = () => {
  const [isEnabled, setIsEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db) {
      setLoading(false);
      return;
    }

    // Listener real-time: qualquer mudança no Firestore reflete imediatamente
    const unsub = onSnapshot(
      doc(db, 'settings', 'maintenance'),
      (snap) => {
        setIsEnabled(snap.exists() && snap.data().enabled === true);
        setLoading(false);
      },
      (_err) => {
        // Falha de leitura → site fica NORMAL
        setIsEnabled(false);
        setLoading(false);
      }
    );

    return unsub;
  }, []);

  // Liga/desliga — lança erro para que o componente possa mostrar ao usuário
  const toggle = async (): Promise<{ ok: boolean; newState: boolean; error?: string }> => {
    if (!db) return { ok: false, newState: isEnabled, error: 'Firebase não inicializado' };

    const currentUser = auth?.currentUser;
    if (!currentUser) {
      return { ok: false, newState: isEnabled, error: 'Sessão Firebase expirada — faça login novamente' };
    }

    const newState = !isEnabled;
    try {
      await setDoc(doc(db, 'settings', 'maintenance'), {
        enabled: newState,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.email,
      });
      // onSnapshot atualiza isEnabled automaticamente
      return { ok: true, newState };
    } catch (e: any) {
      const msg = e?.code === 'permission-denied'
        ? 'Permissão negada — verifique se está logado como admin no Firebase'
        : String(e?.message || e);
      return { ok: false, newState: isEnabled, error: msg };
    }
  };

  return { isEnabled, loading, toggle };
};
