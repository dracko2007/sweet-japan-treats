import { useState, useEffect } from 'react';
import { db } from '@/config/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const isDev = import.meta.env.DEV;
const devLog = isDev ? console.log.bind(console) : () => {};
const devWarn = isDev ? console.warn.bind(console) : () => {};
const devError = isDev ? console.error.bind(console) : () => {};


// Controla o modo manutenção (flag em Firestore settings/maintenance).
// FAIL-SAFE: qualquer erro de leitura mantém o site NORMAL (nunca trava).
export const useMaintenanceMode = () => {
  const [isEnabled, setIsEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!db) {
        if (active) setLoading(false);
        return;
      }
      try {
        const snap = await getDoc(doc(db, 'settings', 'maintenance'));
        if (active) setIsEnabled(snap.exists() && snap.data().enabled === true);
      } catch (e) {
        // Falha de leitura (ex: regra não publicada) → site fica NORMAL
        devWarn('[maintenance] leitura falhou, mantendo site normal:', e);
        if (active) setIsEnabled(false);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  // Liga/desliga (só admin consegue gravar pelas regras)
  const toggle = async (): Promise<boolean> => {
    if (!db) return isEnabled;
    const newState = !isEnabled;
    try {
      await setDoc(doc(db, 'settings', 'maintenance'), {
        enabled: newState,
        updatedAt: new Date().toISOString(),
      });
      setIsEnabled(newState);
      return newState;
    } catch (e) {
      devError('[maintenance] não foi possível salvar:', e);
      return isEnabled;
    }
  };

  return { isEnabled, loading, toggle };
};
