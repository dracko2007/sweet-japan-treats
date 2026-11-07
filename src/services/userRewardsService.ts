import { authenticatedFetch } from '@/services/authenticatedFetch';

export type RewardNetwork = 'instagram' | 'facebook' | 'tiktok' | 'x';

export interface UserRewardResult {
  ok: true;
  awarded: number;
  total: number;
  alreadyClaimed: boolean;
}

export interface ProductReviewInput {
  productId: string;
  /** 1 a 5. */
  rating: number;
  comment: string;
  /** URLs do Storage da loja (`review-photos/{productId}/…`). */
  images?: string[];
  /** Arquivo em `review-videos/{productId}/…` ou link do YouTube. */
  videoUrl?: string;
}

export interface ProductReviewResult extends UserRewardResult {
  reviewId: string;
}

async function claimReward(body: Record<string, unknown>): Promise<UserRewardResult> {
  const response = await authenticatedFetch('/api/user-rewards', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof payload?.error === 'string' ? payload.error : 'reward_request_failed');
  }
  if (
    payload?.ok !== true
    || !Number.isFinite(payload.awarded)
    || !Number.isFinite(payload.total)
    || typeof payload.alreadyClaimed !== 'boolean'
  ) {
    throw new Error('invalid_reward_response');
  }
  return payload as UserRewardResult;
}

export const userRewardsService = {
  claimSocialFollow(network: RewardNetwork) {
    return claimReward({ action: 'social-follow', network });
  },

  claimBirthday() {
    return claimReward({ action: 'birthday' });
  },

  /**
   * Grava a avaliação pelo servidor, que confere a compra paga, recalcula a
   * nota do produto e dá o ponto. O navegador não grava avaliação no banco.
   */
  async submitProductReview({ productId, rating, comment, images = [], videoUrl = '' }: ProductReviewInput) {
    const body: Record<string, unknown> = { action: 'product-review', productId, rating, comment };
    if (images.length > 0) body.images = images;
    if (videoUrl) body.videoUrl = videoUrl;
    return (await claimReward(body)) as ProductReviewResult;
  },
};

/** Mensagem para o cliente a partir do código de erro da avaliação. */
export function reviewErrorMessage(code: string): string {
  const messages: Record<string, string> = {
    already_reviewed: 'Você já avaliou este produto.',
    verified_purchase_required: 'Só dá para avaliar produtos de pedidos já pagos.',
    verified_email_required: 'Confirme seu e-mail para avaliar.',
    invalid_rating: 'Escolha de 1 a 5 estrelas.',
    invalid_comment: 'O comentário precisa ter de 10 a 3000 caracteres.',
    invalid_review_media: 'Uma das fotos ou o vídeo não foi aceito. Envie de novo pelo formulário.',
    product_not_found: 'Este produto não está mais no catálogo.',
    rate_limited: 'Muitas tentativas seguidas. Aguarde um pouco e tente de novo.',
  };
  return messages[code] || 'Tente novamente.';
}
