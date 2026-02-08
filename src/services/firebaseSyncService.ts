/**
 * Firebase Sync Service
 * Sincroniza localStorage com Firestore para acesso multi-dispositivo
 */

import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot 
} from 'firebase/firestore';

import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged
} from 'firebase/auth';

import { auth, db, firebaseConfigReady } from '@/config/firebase';

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

export const firebaseSyncService = {
  /**
   * Sincroniza usuário do localStorage para Firestore
   */
  async syncUserToFirestore(userId: string, userData: any) {
    try {
      ensureFirebaseReady();
      const userRef = doc(db, 'users', userId);
      // Clean data before sending (Firestore doesn't like undefined)
      const cleanData = sanitizeData(userData);
      
      await setDoc(userRef, {
        ...cleanData,
        lastSyncAt: new Date().toISOString()
      }, { merge: true });
      
      console.log('✅ [FIREBASE] User synced:', userId);
      return true;
    } catch (error) {
      console.error('❌ [FIREBASE] Error syncing user:', error);
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
      console.error('❌ [FIREBASE] Error getting user:', error);
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
      console.error('❌ [FIREBASE] Error finding user:', error);
      return null;
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
      });
      
      console.log('✅ [FIREBASE] Order synced:', order.orderNumber);
      return true;
    } catch (error) {
      console.error('❌ [FIREBASE] Error syncing order:', error);
      return false;
    }
  },

  /**
   * Busca todos os pedidos de um usuário
   */
  async getOrdersFromFirestore(userId: string) {
    try {
      ensureFirebaseReady();
      const ordersRef = collection(db, 'orders');
      const q = query(ordersRef, where('userId', '==', userId));
      const querySnapshot = await getDocs(q);
      
      const orders: any[] = [];
      querySnapshot.forEach((doc) => {
        orders.push({ id: doc.id, ...doc.data() });
      });
      
      return orders;
    } catch (error) {
      console.error('❌ [FIREBASE] Error getting orders:', error);
      return [];
    }
  },

  /**
   * Busca TODOS os pedidos (para admin)
   */
  async getAllOrdersFromFirestore() {
    try {
      ensureFirebaseReady();
      const ordersRef = collection(db, 'orders');
      const querySnapshot = await getDocs(ordersRef);
      
      const orders: any[] = [];
      querySnapshot.forEach((doc) => {
        orders.push({ id: doc.id, ...doc.data() });
      });
      
      return orders;
    } catch (error) {
      console.error('❌ [FIREBASE] Error getting all orders:', error);
      return [];
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
      
      console.log('✅ [FIREBASE] Order status updated:', orderNumber, status);
      return true;
    } catch (error) {
      console.error('❌ [FIREBASE] Error updating order:', error);
      return false;
    }
  },

  /**
   * Registra usuário no Firebase Auth
   */
  async registerUser(email: string, password: string) {
    try {
      ensureFirebaseReady();
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      console.log('✅ [FIREBASE AUTH] User registered:', userCredential.user.uid);
      return userCredential.user;
    } catch (error: any) {
      console.error('❌ [FIREBASE AUTH] Registration error:', error);
      throw error;
    }
  },

  /**
   * Login com Firebase Auth
   */
  async loginUser(email: string, password: string) {
    try {
      ensureFirebaseReady();
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log('✅ [FIREBASE AUTH] User logged in:', userCredential.user.uid);
      return userCredential.user;
    } catch (error: any) {
      console.error('❌ [FIREBASE AUTH] Login error:', error);
      throw error;
    }
  },

  /**
   * Logout
   */
  async logoutUser() {
    try {
      ensureFirebaseReady();
      await firebaseSignOut(auth);
      console.log('✅ [FIREBASE AUTH] User logged out');
      return true;
    } catch (error) {
      console.error('❌ [FIREBASE AUTH] Logout error:', error);
      return false;
    }
  },

  /**
   * Observa mudanças de autenticação
   */
  onAuthChange(callback: (user: any) => void) {
    if (!firebaseConfigReady || !auth) {
      console.warn('⚠️ [FIREBASE AUTH] onAuthChange skipped: Firebase not configured');
      return () => undefined;
    }
    return onAuthStateChanged(auth, callback);
  },

  /**
   * Migra dados do localStorage para Firestore
   */
  async migrateLocalStorageToFirestore() {
    try {
      console.log('🔄 [FIREBASE] Starting migration from localStorage...');
      
      const usersData = localStorage.getItem('sweet-japan-users');
      if (!usersData) {
        console.log('⚠️ [FIREBASE] No users in localStorage to migrate');
        return { success: true, migrated: 0 };
      }
      
      const users = JSON.parse(usersData);
      let migratedCount = 0;
      
      for (const [email, userData] of Object.entries(users)) {
        const userId = (userData as any).id || `user-${Date.now()}-${Math.random()}`;
        
        // Sincroniza usuário
        await this.syncUserToFirestore(userId, {
          ...userData,
          email
        });
        
        // Sincroniza pedidos do usuário
        if ((userData as any).orders && Array.isArray((userData as any).orders)) {
          for (const order of (userData as any).orders) {
            await this.syncOrderToFirestore(userId, order);
          }
        }
        
        migratedCount++;
      }
      
      console.log(`✅ [FIREBASE] Migration complete! ${migratedCount} users migrated`);
      return { success: true, migrated: migratedCount };
    } catch (error) {
      console.error('❌ [FIREBASE] Migration error:', error);
      return { success: false, error };
    }
  }
};
