/**
 * Chaves de funcionalidades da loja.
 *
 * product3d: aba "3D" + AR na página do produto e campo "Modelo 3D" no admin.
 * Desativado até os modelos dos produtos serem gerados (créditos Higgsfield).
 * Para religar, troque para `true` — o código continua todo no lugar:
 *   - src/components/products/Product3DViewer.tsx (visualizador)
 *   - src/components/products/ProductGallery.tsx (aba 3D)
 *   - src/components/admin/ProductManager.tsx (campo do modelo)
 *   - public/models/fino-premium-touch-hair-mask.glb (modelo de teste)
 */
export const FEATURES = {
  product3d: false,
} as const;
