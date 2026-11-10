import React, { useEffect, useState } from 'react';
import { Play, X } from 'lucide-react';
import { affiliateService, type AffiliateReview, type ReviewPlatform } from '@/services/affiliateService';

const PLATFORM_LABEL: Record<ReviewPlatform, string> = { youtube: 'YouTube', tiktok: 'TikTok', instagram: 'Instagram' };

/**
 * Vídeos de review deste produto, enviados pelos divulgadores e aprovados no admin.
 * Não ocupa espaço nenhum quando o produto não tem vídeo.
 */
const ProductVideoReviews: React.FC<{ productId: string }> = ({ productId }) => {
  const [reviews, setReviews] = useState<AffiliateReview[]>([]);
  const [playing, setPlaying] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setReviews([]);
    affiliateService.getApprovedReviews(productId).then((list) => { if (active) setReviews(list); });
    return () => { active = false; };
  }, [productId]);

  if (reviews.length === 0) return null;

  return (
    <div className="mt-12">
      <h2 className="font-display text-xl md:text-2xl font-bold text-foreground mb-1">Veja quem já testou</h2>
      <p className="text-sm text-muted-foreground mb-4">Vídeos de criadores que receberam e testaram este produto.</p>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide md:grid md:grid-cols-4 md:overflow-visible">
        {reviews.map((review) => {
          const thumb = review.platform === 'youtube' && review.videoId
            ? `https://img.youtube.com/vi/${review.videoId}/hqdefault.jpg`
            : review.thumbnail;
          const title = review.title || `Review no ${PLATFORM_LABEL[review.platform]}`;
          const open = () => {
            if (review.platform === 'youtube' && review.videoId) setPlaying(review.videoId);
            else window.open(review.url, '_blank', 'noopener,noreferrer');
          };
          return (
            <button
              key={review.id}
              type="button"
              onClick={open}
              className="group w-56 shrink-0 overflow-hidden rounded-2xl border border-border bg-card text-left shadow-sm md:w-auto"
              aria-label={`Assistir: ${title}`}
            >
              <span className="relative block aspect-video w-full overflow-hidden bg-gradient-to-br from-pink-100 to-fuchsia-100">
                {thumb && (
                  <img
                    src={thumb}
                    alt=""
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="absolute inset-0 h-full w-full object-cover"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                )}
                <span className="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors group-hover:bg-black/35">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/95 shadow-lg">
                    <Play className="ml-0.5 h-5 w-5 fill-primary text-primary" />
                  </span>
                </span>
                <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-bold text-white">
                  {PLATFORM_LABEL[review.platform]}
                </span>
              </span>
              <span className="block p-3">
                <span className="line-clamp-2 text-sm font-bold text-foreground">{title}</span>
                {review.ownerName && <span className="mt-1 block text-xs text-muted-foreground">por {review.ownerName}</span>}
              </span>
            </button>
          );
        })}
      </div>

      {playing && (
        <div className="fixed inset-0 z-[10002] flex items-center justify-center bg-black/85 p-4" onClick={() => setPlaying(null)}>
          <div className="relative w-full max-w-4xl overflow-hidden rounded-2xl bg-black" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setPlaying(null)}
              className="absolute right-3 top-3 z-10 rounded-full bg-black/60 p-2 text-white hover:bg-black/80"
              aria-label="Fechar vídeo"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="aspect-video w-full">
              <iframe
                src={`https://www.youtube.com/embed/${playing}?autoplay=1&rel=0`}
                title="Vídeo de review"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="h-full w-full"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductVideoReviews;
