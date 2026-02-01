/**
 * Wishlist Service
 * Gerencia lista de desejos do usuário no localStorage
 */

export interface WishlistItem {
  productId: string;
  productName: string;
  productImage: string;
  productPrice: number;
  addedAt: string;
}

const STORAGE_KEY = 'sweet-japan-wishlist';

export const wishlistService = {
  // Get user's wishlist
  getWishlist: (userEmail: string): WishlistItem[] => {
    try {
      const wishlistData = localStorage.getItem(`${STORAGE_KEY}_${userEmail}`);
      return wishlistData ? JSON.parse(wishlistData) : [];
    } catch (error) {
      console.error('Error loading wishlist:', error);
      return [];
    }
  },

  // Add item to wishlist
  addToWishlist: (userEmail: string, item: Omit<WishlistItem, 'addedAt'>): boolean => {
    try {
      const wishlist = wishlistService.getWishlist(userEmail);
      
      // Check if already exists
      if (wishlist.some(w => w.productId === item.productId)) {
        return false; // Already in wishlist
      }

      const newItem: WishlistItem = {
        ...item,
        addedAt: new Date().toISOString(),
      };

      wishlist.push(newItem);
      localStorage.setItem(`${STORAGE_KEY}_${userEmail}`, JSON.stringify(wishlist));
      return true;
    } catch (error) {
      console.error('Error adding to wishlist:', error);
      return false;
    }
  },

  // Remove item from wishlist
  removeFromWishlist: (userEmail: string, productId: string): boolean => {
    try {
      const wishlist = wishlistService.getWishlist(userEmail);
      const filtered = wishlist.filter(item => item.productId !== productId);
      
      localStorage.setItem(`${STORAGE_KEY}_${userEmail}`, JSON.stringify(filtered));
      return true;
    } catch (error) {
      console.error('Error removing from wishlist:', error);
      return false;
    }
  },

  // Check if item is in wishlist
  isInWishlist: (userEmail: string, productId: string): boolean => {
    const wishlist = wishlistService.getWishlist(userEmail);
    return wishlist.some(item => item.productId === productId);
  },

  // Clear entire wishlist
  clearWishlist: (userEmail: string): boolean => {
    try {
      localStorage.removeItem(`${STORAGE_KEY}_${userEmail}`);
      return true;
    } catch (error) {
      console.error('Error clearing wishlist:', error);
      return false;
    }
  },

  // Get wishlist count
  getWishlistCount: (userEmail: string): number => {
    return wishlistService.getWishlist(userEmail).length;
  },
};
