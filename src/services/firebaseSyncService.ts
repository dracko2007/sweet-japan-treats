import { safeStorage } from '@/utils/storage';
import { requestPasswordReset } from '@/services/mailService';
/**
 * Firebase Sync Service
 * Sincroniza safeStorage com Firestore para acesso multi-dispositivo
 */

import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  deleteField,
  query,
  where,
  onSnapshot,
  orderBy,
  limit,
  startAfter,
  documentId
} from 'firebase/firestore';

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  FacebookAuthProvider,
  TwitterAuthProvider,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail
} from 'firebase/auth';
import type { AuthProvider, ConfirmationResult } from 'firebase/auth';

import { auth, db, firebaseConfigReady } from '@/config/firebase';

// Provedores sociais suportados no login/cadastro.
export type SocialProvider = 'google' | 'facebook' | 'twitter';

// Monta o provedor OAuth correto para cada rede social.
const buildAuthProvider = (key: SocialProvider): AuthProvider => {
  switch (key) {
    case 'facebook': {
      const provider = new FacebookAuthProvider();
      provider.addScope('email');
      return provider;
    }
    case 'twitter':
      // Twitter/X usa OAuth 1.0a — sem escopos adicionais.
      return new TwitterAuthProvider();
    case 'google':
    default: {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      return provider;
    }
  }
};

const isDev = import.meta.env.DEV;
const devLog = isDev ? console.log.bind(console) : () => {};
const devWarn = isDev ? console.warn.bind(console) : () => {};
const devError = isDev ? console.error.bind(console) : () => {};

const getEmailActionSettings = () => {
  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://japanexpress-store.com';

  return {
    url: `${origin}/login?verified=1`,
    handleCodeInApp: false,
  };
};

const ensureFirebaseReady = () => {
  if (!firebaseConfigReady || !auth || !db) {
    const error: any = new Error('Firebase not configured');
    error.code = 'auth/configuration-not-found';
    throw error;
  }
};

// Helper to remove undefined values
const sanitizeData = (data: any): any => {
  if (data === null || data === undefined) return null;
  if (Array.isArray(data)) return data.map(sanitizeData);
  if (typeof data === 'object' && data !== null) {
    if (data instanceof Date) return data.toISOString(); // Convert Dates to string
    return Object.keys(data).reduce((acc, key) => {
      const value = sanitizeData(data[key]);
      if (value !== undefined) {
        acc[key] = value;
      }
      return acc;
    }, {} as any);
  }
  return data;
};

export type OrderPageCursor = string;

export interface OrderPage<T = any> {
  items: T[];
  nextCursor: OrderPageCursor | null;
  hasMore: boolean;
}

interface OrderCursorPosition {
  orderDate: string;
  id: string;
}

interface OrderCursorPayload {
  positions: Record<string, OrderCursorPosition>;
}

const encodeOrderCursor = (payload: OrderCursorPayload): OrderPageCursor =>
  encodeURIComponent(JSON.stringify(payload));

const decodeOrderCursor = (cursor?: OrderPageCursor | null): OrderCursorPayload => {
  if (!cursor) return { positions: {} };
  try {
    const parsed = JSON.parse(decodeURIComponent(cursor));
    return parsed && typeof parsed.positions === 'object'
      ? parsed as OrderCursorPayload
      : { positions: {} };
  } catch {
    return { positions: {} };
  }
};

const orderDateOf = (order: any): string =>
  String(order.orderDate || order.date || order.createdAt || order.syncedAt || '');

const compareOrdersDescending = (left: any, right: any): number => {
  const dateComparison = orderDateOf(right).localeCompare(orderDateOf(left));
  if (dateComparison !== 0) return dateComparison;
  return String(right.id || right.orderNumber || '').localeCompare(
    String(left.id || left.orderNumber || '')
  );
};

const normalizedPageSize = (pageSize: number): number =>
  Math.max(1, Math.min(100, Math.floor(pageSize) || 20));

export const firebaseSyncService = {
  /**
   * Sincroniza usuário do safeStorage para Firestore
   */
  async syncUserToFirestore(userId: string, userData: any) {
    try {
      ensureFirebaseReady();
      const userRef = doc(db, 'users', userId);
      // Remove senha antes de enviar ao Firestore (nunca persistir credencial).
      const { password: _pw, ...safeData } = userData as any;
      const cleanData = sanitizeData(safeData);

      await setDoc(userRef, {
        ...cleanData,
        lastSyncAt: new Date().toISOString()
      }, { merge: true });
      
      devLog('✅ [FIREBASE] User synced:', userId);
      return true;
    } catch (error) {
      devError('❌ [FIREBASE] Error syncing user:', error);
      return false;
    }
  },

  /**
   * Busca usuário do Firestore
   */
  async getUserFromFirestore(userId: string) {
    try {
      ensureFirebaseReady();
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        return userSnap.data();
      }
      return null;
    } catch (error) {
      devError('❌ [FIREBASE] Error getting user:', error);
      return null;
    }
  },

  /**
   * Busca usuário por email
   */
  async getUserByEmail(email: string) {
    try {
      ensureFirebaseReady();
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', email));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const userDoc = querySnapshot.docs[0];
        return { id: userDoc.id, ...userDoc.data() };
      }
      return null;
    } catch (error) {
      devError('❌ [FIREBASE] Error finding user:', error);
      return null;
    }
  },

  /**
   * Soma (ou subtrai) pontos de fidelidade de um cliente pelo e-mail.
   */
  async addPointsToUserByEmail(email: string, amount: number): Promise<{ success: boolean; total?: number; error?: string }> {
    try {
      ensureFirebaseReady();
      const u: any = await this.getUserByEmail(email);
      if (!u?.id) return { success: false, error: 'Cliente não encontrado no Firestore' };
      const total = Math.max(0, (Number(u.points) || 0) + amount);
      await updateDoc(doc(db, 'users', u.id), { points: total });
      return { success: true, total };
    } catch (error: any) {
      devError('❌ [FIREBASE] addPointsToUserByEmail:', error);
      return { success: false, error: error?.message };
    }
  },

  /**
   * Marca/desmarca seguimento de rede social para um usuário pelo e-mail (admin).
   * Não dispara recompensa de pontos — escrita direta ao map socialFollows.
   */
  async setSocialFollowByEmail(email: string, network: 'instagram' | 'tiktok', follow: boolean): Promise<{ success: boolean; error?: string }> {
    try {
      ensureFirebaseReady();
      const u = await this.getUserByEmail(email);
      if (!u?.id) return { success: false, error: 'Cliente não encontrado no Firestore' };
      // Caminho pontilhado, e NÃO um objeto aninhado: `updateDoc` com
      // `{ socialFollows: { instagram } }` SUBSTITUI o map inteiro e apagaria
      // as outras redes (tiktok/facebook/x) que o cliente já confirmou —
      // zerando a recompensa de `SocialFollowRewards`. (`updateDoc` também não
      // aceita `{ merge: true }`; isso é opção de `setDoc`.)
      await updateDoc(doc(db, 'users', u.id), { [`socialFollows.${network}`]: follow });
      devLog('✅ [FIREBASE] Social follow updated:', email, network, follow);
      return { success: true };
    } catch (error: any) {
      devError('❌ [FIREBASE] setSocialFollowByEmail:', error);
      return { success: false, error: error?.message };
    }
  },

  /**
   * Sincroniza pedido para Firestore
   */
  async syncOrderToFirestore(userId: string, order: any) {
    try {
      ensureFirebaseReady();
      const orderRef = doc(db, 'orders', order.orderNumber);
      const cleanOrder = sanitizeData(order);
      
      await setDoc(orderRef, {
        ...cleanOrder,
        userId,
        syncedAt: new Date().toISOString()
      }, { merge: true });
      
      devLog('✅ [FIREBASE] Order synced:', order.orderNumber);
      return true;
    } catch (error) {
      devError('❌ [FIREBASE] Error syncing order:', error);
      return false;
    }
  },

  /**
   * Busca uma página determinística dos pedidos de um usuário.
   * Cada identidade mantém seu próprio cursor porque um pedido pode corresponder
   * tanto ao userId quanto ao customerEmail.
   */
  async getOrdersFromFirestore(
    userId: string,
    userEmail?: string,
    pageSize = 20,
    cursor?: OrderPageCursor | null
  ): Promise<OrderPage> {
    try {
      ensureFirebaseReady();
      const ordersRef = collection(db, 'orders');
      const size = normalizedPageSize(pageSize);
      const previous = decodeOrderCursor(cursor);
      const sources = [
        { key: `userId:${userId}`, field: 'userId', value: String(userId || '').trim() },
        ...Array.from(new Set(
          [userEmail, userEmail?.toLowerCase()]
            .map((email) => String(email || '').trim())
            .filter(Boolean)
        )).map((email) => ({
          key: `customerEmail:${email}`,
          field: 'customerEmail',
          value: email,
        })),
      ].filter((source) => source.value);

      const snapshots = await Promise.all(sources.map(async (source) => {
        const position = previous.positions[source.key];
        const constraints: any[] = [
          where(source.field, '==', source.value),
          orderBy('orderDate', 'desc'),
          orderBy(documentId(), 'desc'),
        ];
        if (position) constraints.push(startAfter(position.orderDate, position.id));
        constraints.push(limit(size + 1));

        const snapshot = await getDocs(query(ordersRef, ...constraints));
        return {
          source,
          // Anotado porque o spread de `DocumentData` colapsava para
          // `{ id: string }`, e o acesso a `orderNumber` mais abaixo não
          // compilava.
          docs: snapshot.docs.map((document): Record<string, any> => ({
            id: document.id,
            ...document.data(),
          })),
        };
      }));

      const merged = snapshots
        .flatMap(({ source, docs }) => docs.map((order) => ({ source, order })))
        .sort((left, right) => compareOrdersDescending(left.order, right.order));
      const positions = { ...previous.positions };
      const items: any[] = [];
      const seen = new Set<string>();
      let consumed = 0;

      for (const entry of merged) {
        const key = String(entry.order.orderNumber || entry.order.id);
        if (items.length >= size && !seen.has(key)) break;
        positions[entry.source.key] = {
          orderDate: orderDateOf(entry.order),
          id: String(entry.order.id),
        };
        consumed += 1;
        if (!seen.has(key)) {
          seen.add(key);
          items.push(entry.order);
        }
      }

      const hasMore = consumed < merged.length
        || snapshots.some(({ docs }) => docs.length > size);
      return {
        items,
        hasMore,
        nextCursor: hasMore ? encodeOrderCursor({ positions }) : null,
      };
    } catch (error) {
      devError('❌ [FIREBASE] Error getting orders:', error);
      throw error;
    }
  },

  /**
   * Busca uma página de pedidos para o admin, ordenada por data e id.
   */
  async getOrdersPageFromFirestore(
    pageSize = 25,
    cursor?: OrderPageCursor | null
  ): Promise<OrderPage> {
    try {
      ensureFirebaseReady();
      const size = normalizedPageSize(pageSize);
      const position = decodeOrderCursor(cursor).positions.admin;
      const constraints: any[] = [
        orderBy('orderDate', 'desc'),
        orderBy(documentId(), 'desc'),
      ];
      if (position) constraints.push(startAfter(position.orderDate, position.id));
      constraints.push(limit(size + 1));

      const snapshot = await getDocs(query(collection(db, 'orders'), ...constraints));
      const documents = snapshot.docs.slice(0, size);
      const items = documents.map((document) => ({
        id: document.id,
        ...document.data(),
      }));
      const hasMore = snapshot.docs.length > size;
      const last = items[items.length - 1];

      return {
        items,
        hasMore,
        nextCursor: hasMore && last
          ? encodeOrderCursor({
              positions: {
                admin: { orderDate: orderDateOf(last), id: String(last.id) },
              },
            })
          : null,
      };
    } catch (error) {
      devError('❌ [FIREBASE] Error getting orders page:', error);
      throw error;
    }
  },

  /**
   * Atualiza status do pedido
   */
  async updateOrderStatus(orderNumber: string, status: string) {
    try {
      ensureFirebaseReady();
      const orderRef = doc(db, 'orders', orderNumber);
      await updateDoc(orderRef, {
        status,
        updatedAt: new Date().toISOString()
      });

      devLog('✅ [FIREBASE] Order status updated:', orderNumber, status);
      return true;
    } catch (error) {
      devError('❌ [FIREBASE] Error updating order:', error);
      return false;
    }
  },

  async confirmPayment(orderNumber: string, adminEmail: string, confirmedAt: string) {
    try {
      ensureFirebaseReady();
      const orderRef = doc(db, 'orders', orderNumber);
      await updateDoc(orderRef, {
        paymentConfirmed: true,
        paymentConfirmedAt: confirmedAt,
        paymentConfirmedBy: adminEmail,
        updatedAt: confirmedAt
      });

      devLog('✅ [FIREBASE] Payment confirmed:', orderNumber, 'by', adminEmail);
      return true;
    } catch (error) {
      devError('❌ [FIREBASE] Error confirming payment:', error);
      return false;
    }
  },

  /**
   * Exclui um pedido do Firestore (delete real, não apenas status).
   * O id do documento é o orderNumber (ver syncOrderToFirestore).
   */
  async deleteOrderFromFirestore(orderNumber: string) {
    try {
      ensureFirebaseReady();
      await deleteDoc(doc(db, 'orders', orderNumber));
      devLog('🗑️ [FIREBASE] Order deleted:', orderNumber);
      return true;
    } catch (error) {
      devError('❌ [FIREBASE] Error deleting order:', error);
      return false;
    }
  },

  /**
   * Exclui do Firestore todos os documentos de usuário com o e-mail dado.
   * O id do documento é auto-gerado, então buscamos pelo campo email.
   */
  async deleteUserByEmail(email: string) {
    try {
      ensureFirebaseReady();
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', email));
      const snap = await getDocs(q);
      if (snap.empty) return true; // nada no Firestore, ok
      await Promise.all(snap.docs.map((d) => deleteDoc(doc(db, 'users', d.id))));
      devLog('🗑️ [FIREBASE] User deleted:', email);
      return true;
    } catch (error) {
      devError('❌ [FIREBASE] Error deleting user:', error);
      return false;
    }
  },

  /**
   * Remove os pedidos de um usuário (limpa o array orders no doc do usuário).
   */
  async clearUserOrdersByEmail(email: string) {
    try {
      ensureFirebaseReady();
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', email));
      const snap = await getDocs(q);
      await Promise.all(
        snap.docs.map((d) => updateDoc(doc(db, 'users', d.id), { orders: [] }))
      );
      return true;
    } catch (error) {
      devError('❌ [FIREBASE] Error clearing user orders:', error);
      return false;
    }
  },

  /**
   * Exclui TODOS os usuários do Firestore (ação em massa do admin).
   */
  async deleteAllUsersFromFirestore() {
    try {
      ensureFirebaseReady();
      const snap = await getDocs(collection(db, 'users'));
      await Promise.all(snap.docs.map((d) => deleteDoc(doc(db, 'users', d.id))));
      devLog('🗑️ [FIREBASE] All users deleted:', snap.size);
      return true;
    } catch (error) {
      devError('❌ [FIREBASE] Error deleting all users:', error);
      return false;
    }
  },

  /**
   * Exclui TODOS os pedidos do Firestore (ação em massa do admin).
   */
  async deleteAllOrdersFromFirestore() {
    try {
      ensureFirebaseReady();
      const snap = await getDocs(collection(db, 'orders'));
      await Promise.all(snap.docs.map((d) => deleteDoc(doc(db, 'orders', d.id))));
      devLog('🗑️ [FIREBASE] All orders deleted:', snap.size);
      return true;
    } catch (error) {
      devError('❌ [FIREBASE] Error deleting all orders:', error);
      return false;
    }
  },

  /**
   * Concede um cupom ao perfil de um cliente (no documento do usuário no Firestore),
   * para que ele apareça em "Meus Cupons" em qualquer dispositivo.
   * Não duplica um código ativo já existente.
   */
  async grantCouponToUserByEmail(email: string, coupon: any) {
    try {
      ensureFirebaseReady();
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', email));
      const snap = await getDocs(q);
      if (snap.empty) return { success: false, granted: 0, error: 'Cliente não encontrado no Firestore.' };

      let granted = 0;
      for (const d of snap.docs) {
        const data = d.data() as { coupons?: any[] };
        const existing = Array.isArray(data.coupons) ? data.coupons : [];
        const already = existing.some(
          (c) => (c.code || '').toUpperCase() === coupon.code.toUpperCase() && !c.isUsed
        );
        if (already) continue;
        await updateDoc(doc(db, 'users', d.id), { coupons: [...existing, coupon] });
        granted++;
      }
      return { success: true, granted };
    } catch (error) {
      devError('❌ [FIREBASE] Error granting coupon:', error);
      return { success: false, granted: 0, error: String(error) };
    }
  },

  /**
   * Concede um cupom a TODOS os clientes do Firestore.
   */
  async grantCouponToAllUsers(coupon: any) {
    try {
      ensureFirebaseReady();
      const snap = await getDocs(collection(db, 'users'));
      let granted = 0;
      await Promise.all(
        snap.docs.map(async (d) => {
          const data = d.data() as { coupons?: any[] };
          const existing = Array.isArray(data.coupons) ? data.coupons : [];
          const already = existing.some(
            (c) => (c.code || '').toUpperCase() === coupon.code.toUpperCase() && !c.isUsed
          );
          if (already) return;
          // id único por usuário para o cupom
          const perUser = { ...coupon, id: `${coupon.id}-${d.id.slice(0, 6)}` };
          await updateDoc(doc(db, 'users', d.id), { coupons: [...existing, perUser] });
          granted++;
        })
      );
      devLog('🎟️ [FIREBASE] Coupon granted to all:', granted);
      return { success: true, granted };
    } catch (error) {
      devError('❌ [FIREBASE] Error granting coupon to all:', error);
      return { success: false, granted: 0, error: String(error) };
    }
  },

  /**
   * Registra usuário no Firebase Auth
   */
  async registerUser(email: string, password: string) {
    try {
      ensureFirebaseReady();
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      devLog('✅ [FIREBASE AUTH] User registered:', userCredential.user.uid);
      
      // Verification is sent by UserContext through /api/send-email.
      
      return userCredential.user;
    } catch (error: any) {
      devError('❌ [FIREBASE AUTH] Registration error:', error);
      throw error;
    }
  },

  /**
   * Resend email verification
   */
  async resendVerificationEmail() {
    try {
      ensureFirebaseReady();
      const currentUser = auth.currentUser;
      if (currentUser) {
        await sendEmailVerification(currentUser, getEmailActionSettings());
        devLog('📧 [FIREBASE AUTH] Verification email resent');
        return true;
      }
      return false;
    } catch (error) {
      devError('❌ [FIREBASE AUTH] Resend verification error:', error);
      return false;
    }
  },

  /**
   * Envia o e-mail de redefinicao de senha.
   *
   * Caminho principal: o mailer da loja, de noreply@japanexpress-store.com, com
   * o mesmo layout dos demais e-mails e sob o SPF/DKIM do dominio.
   *
   * Antes ia direto pelo Firebase, que envia de noreply@<projeto>.firebaseapp.com
   * com o assunto "Reset your password for <nome do projeto>". Chega, mas de um
   * remetente que o cliente nao reconhece, sem a marca da loja e sem aparecer na
   * caixa de Enviados — o que tornava impossivel auditar o que foi enviado.
   *
   * O Firebase segue como rede de seguranca: ficar sem redefinir a senha tranca
   * o cliente para fora da conta, entao um e-mail feio e melhor que nenhum.
   */
  async sendPasswordReset(email: string) {
    const alvo = email.trim().toLowerCase();
    const resultado = await requestPasswordReset(alvo);
    if (resultado.ok) {
      devLog('📧 [RESET] Enviado pelo mailer da loja para:', alvo);
      return true;
    }

    devWarn('[RESET] Mailer da loja falhou (' + resultado.error + '), caindo para o Firebase.');
    try {
      ensureFirebaseReady();
      await sendPasswordResetEmail(auth, alvo);
      devLog('📧 [RESET] Enviado pelo fallback do Firebase (remetente firebaseapp.com).');
      return true;
    } catch (error) {
      devError('❌ [RESET] Os dois caminhos falharam:', error);
      throw error;
    }
  },

  /**
   * Check if current user's email is verified
   */
  isEmailVerified() {
    if (!auth?.currentUser) return false;
    return auth.currentUser.emailVerified;
  },

  /**
   * Reload current user to get updated emailVerified status
   */
  async reloadCurrentUser() {
    try {
      if (auth?.currentUser) {
        await auth.currentUser.reload();
        return auth.currentUser.emailVerified;
      }
      return false;
    } catch (error) {
      devError('❌ [FIREBASE AUTH] Reload error:', error);
      return false;
    }
  },

  /**
   * Login com Firebase Auth
   */
  async loginUser(email: string, password: string) {
    try {
      ensureFirebaseReady();
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      devLog('✅ [FIREBASE AUTH] User logged in:', userCredential.user.uid);
      return userCredential.user;
    } catch (error: any) {
      devError('❌ [FIREBASE AUTH] Login error:', error);
      throw error;
    }
  },

  /**
   * Login social (OAuth popup) — Google, Facebook, Apple ou Twitter/X.
   * E-mails de provedores federados já vêm verificados, então pulam a etapa de
   * confirmação manual — o maior gatilho de cadastro. Retorna o User do Firebase.
   */
  async loginWithProvider(key: SocialProvider) {
    ensureFirebaseReady();
    const provider = buildAuthProvider(key);
    const result = await signInWithPopup(auth, provider);
    devLog(`✅ [FIREBASE AUTH] Social login (${key}):`, result.user.uid);
    return result.user;
  },

  /** Atalho legado — mantém compatibilidade com chamadas antigas. */
  async loginWithGoogle() {
    return this.loginWithProvider('google');
  },

  /**
   * Cria o verificador invisível do reCAPTCHA exigido pelo login por telefone.
   * `containerId` é o id de um elemento vazio já presente no DOM.
   */
  createRecaptchaVerifier(containerId: string) {
    ensureFirebaseReady();
    return new RecaptchaVerifier(auth, containerId, { size: 'invisible' });
  },

  /**
   * Envia o código SMS para o telefone em formato E.164 (ex.: +5511999998888).
   * Retorna o ConfirmationResult usado depois para confirmar o código digitado.
   */
  async sendPhoneCode(phoneE164: string, verifier: RecaptchaVerifier): Promise<ConfirmationResult> {
    ensureFirebaseReady();
    return await signInWithPhoneNumber(auth, phoneE164, verifier);
  },

  /**
   * Logout
   */
  async logoutUser() {
    try {
      ensureFirebaseReady();
      await firebaseSignOut(auth);
      devLog('✅ [FIREBASE AUTH] User logged out');
      return true;
    } catch (error) {
      devError('❌ [FIREBASE AUTH] Logout error:', error);
      return false;
    }
  },

  /**
   * Observa mudanças de autenticação
   */
  onAuthChange(callback: (user: any) => void) {
    if (!firebaseConfigReady || !auth) {
      devWarn('⚠️ [FIREBASE AUTH] onAuthChange skipped: Firebase not configured');
      return () => undefined;
    }
    return onAuthStateChanged(auth, callback);
  },

  /**
   * Migra dados do safeStorage para Firestore
   */
  async migrateLocalStorageToFirestore() {
    try {
      devLog('🔄 [FIREBASE] Starting migration from safeStorage...');
      
      const usersData = safeStorage.getItem('japan-express-users');
      if (!usersData) {
        devLog('⚠️ [FIREBASE] No users in safeStorage to migrate');
        return { success: true, migrated: 0 };
      }
      
      const users = JSON.parse(usersData);
      let migratedCount = 0;
      
      for (const [email, userData] of Object.entries(users)) {
        const userObj = userData as Record<string, any>;
        const userId = userObj.id || `user-${Date.now()}-${Math.random()}`;
        
        // Sincroniza usuário
        await this.syncUserToFirestore(userId, {
          ...userObj,
          email
        });
        
        // Sincroniza pedidos do usuário
        if (userObj.orders && Array.isArray(userObj.orders)) {
          for (const order of userObj.orders) {
            await this.syncOrderToFirestore(userId, order);
          }
        }
        
        migratedCount++;
      }
      
      devLog(`✅ [FIREBASE] Migration complete! ${migratedCount} users migrated`);
      return { success: true, migrated: migratedCount };
    } catch (error) {
      devError('❌ [FIREBASE] Migration error:', error);
      return { success: false, error };
    }
  },

  // Zera pedidos, pontos e cupons de todos os usuários — mantém contas e produtos.
  async unlinkAffiliateFromUser(email: string): Promise<{ success: boolean; error?: string }> {
    try {
      ensureFirebaseReady();
      const snap = await getDocs(query(collection(db, 'users'), where('email', '==', email)));
      if (snap.empty) return { success: false, error: 'Usuário não encontrado' };
      await Promise.all(snap.docs.map(d =>
        updateDoc(doc(db, 'users', d.id), {
          affiliateCode: deleteField(),
          referredBy: deleteField(),
          referralRewardPaid: deleteField(),
        })
      ));
      return { success: true };
    } catch (e: unknown) {
      return { success: false, error: String(e) };
    }
  },

  async resetAllPoints(): Promise<{ success: boolean; users: number; error?: string }> {
    try {
      ensureFirebaseReady();
      // Garante auth de admin antes de escrever
      const { ensureAdminAuth } = await import('@/utils/adminAuth');
      await ensureAdminAuth();
      const snap = await getDocs(collection(db, 'users'));
      const results = await Promise.allSettled(
        snap.docs.map(d => updateDoc(doc(db, 'users', d.id), { points: 0 }))
      );
      const failed = results.filter(r => r.status === 'rejected');
      if (failed.length > 0) {
        const reason = (failed[0] as PromiseRejectedResult).reason;
        devError('❌ [FIREBASE] resetAllPoints partial failure:', reason);
        return { success: false, users: snap.size, error: String(reason) };
      }
      return { success: true, users: snap.size };
    } catch (error) {
      devError('❌ [FIREBASE] resetAllPoints error:', error);
      return { success: false, users: 0, error: String(error) };
    }
  },

  clearAllReviews(): void {
    try {
      localStorage.removeItem('japan-express-reviews');
    } catch { /* ignora */ }
  },

  async resetAllUsersData(): Promise<{ success: boolean; users: number; error?: unknown }> {
    ensureFirebaseReady();
    const snap = await getDocs(collection(db, 'users'));
    await Promise.all(snap.docs.map((d) =>
      updateDoc(doc(db, 'users', d.id), { orders: [], points: 0, coupons: [] })
    ));
    devLog('✅ [FIREBASE] resetAllUsersData: zeroed', snap.size, 'users');
    return { success: true, users: snap.size };
  },

  // Apaga toda a coleção coupon_usage (histórico de uso de cupons).
  async deleteAllCouponUsage(): Promise<boolean> {
    try {
      ensureFirebaseReady();
      const snap = await getDocs(collection(db, 'coupon_usage'));
      await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
      return true;
    } catch (error) {
      devError('❌ [FIREBASE] deleteAllCouponUsage error:', error);
      return false;
    }
  },
};
