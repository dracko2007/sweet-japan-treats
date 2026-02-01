import React, { useState, useEffect } from 'react';
import { Star, ThumbsUp, Camera, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useUser } from '@/context/UserContext';
import { reviewService } from '@/services/reviewService';
import { Review, ProductRating } from '@/types/review';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface ProductReviewsProps {
  productId: string;
  productName: string;
}

const ProductReviews: React.FC<ProductReviewsProps> = ({ productId, productName }) => {
  const { user } = useUser();
  const { toast } = useToast();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [rating, setRating] = useState<ProductRating | null>(null);
  const [canReview, setCanReview] = useState(false);
  
  // Form state
  const [showForm, setShowForm] = useState(false);
  const [selectedRating, setSelectedRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [images, setImages] = useState<string[]>([]);

  useEffect(() => {
    loadReviews();
  }, [productId]);

  useEffect(() => {
    if (user) {
      setCanReview(reviewService.canUserReview(user.id, productId));
    }
  }, [user, productId, reviews]);

  const loadReviews = () => {
    const productReviews = reviewService.getProductReviews(productId);
    const productRating = reviewService.getProductRating(productId);
    setReviews(productReviews);
    setRating(productRating);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImages(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleSubmit = () => {
    if (!user) {
      toast({
        title: 'Erro',
        description: 'Faça login para avaliar',
        variant: 'destructive'
      });
      return;
    }

    if (selectedRating === 0) {
      toast({
        title: 'Erro',
        description: 'Selecione uma avaliação',
        variant: 'destructive'
      });
      return;
    }

    if (comment.trim().length < 10) {
      toast({
        title: 'Erro',
        description: 'Escreva pelo menos 10 caracteres',
        variant: 'destructive'
      });
      return;
    }

    reviewService.addReview({
      productId,
      userId: user.id,
      userName: user.name,
      rating: selectedRating,
      comment: comment.trim(),
      images: images.length > 0 ? images : undefined,
      verified: true
    });

    toast({
      title: 'Avaliação enviada!',
      description: 'Obrigado pelo seu feedback!'
    });

    // Reset form
    setShowForm(false);
    setSelectedRating(0);
    setComment('');
    setImages([]);
    loadReviews();
  };

  const renderStars = (rating: number, size: 'sm' | 'md' | 'lg' = 'md') => {
    const sizeClass = size === 'sm' ? 'w-4 h-4' : size === 'md' ? 'w-5 h-5' : 'w-6 h-6';
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={cn(
              sizeClass,
              star <= rating ? 'fill-gold text-gold' : 'text-gray-300'
            )}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Rating Summary */}
      {rating && rating.totalReviews > 0 && (
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-start gap-6">
            <div className="text-center">
              <div className="text-5xl font-bold text-foreground">{rating.averageRating.toFixed(1)}</div>
              {renderStars(Math.round(rating.averageRating), 'lg')}
              <p className="text-sm text-muted-foreground mt-2">{rating.totalReviews} avaliações</p>
            </div>
            
            <div className="flex-1 space-y-2">
              {[5, 4, 3, 2, 1].map((star) => (
                <div key={star} className="flex items-center gap-3">
                  <span className="text-sm font-medium w-12">{star} {renderStars(star, 'sm')}</span>
                  <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gold"
                      style={{ width: `${(rating.ratings[star as keyof typeof rating.ratings] / rating.totalReviews) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm text-muted-foreground w-8">{rating.ratings[star as keyof typeof rating.ratings]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Write Review Button */}
      {canReview && !showForm && (
        <Button onClick={() => setShowForm(true)} className="w-full">
          Escrever Avaliação
        </Button>
      )}

      {/* Review Form */}
      {showForm && (
        <div className="bg-card rounded-xl border border-border p-6 space-y-4">
          <h3 className="font-semibold text-lg">Avaliar {productName}</h3>
          
          {/* Star Rating */}
          <div>
            <label className="block text-sm font-medium mb-2">Sua Avaliação</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setSelectedRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                >
                  <Star
                    className={cn(
                      'w-8 h-8 transition-colors',
                      star <= (hoverRating || selectedRating)
                        ? 'fill-gold text-gold'
                        : 'text-gray-300 hover:text-gold'
                    )}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Comment */}
          <div>
            <label className="block text-sm font-medium mb-2">Seu Comentário</label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Compartilhe sua experiência com este produto..."
              rows={4}
            />
          </div>

          {/* Images */}
          <div>
            <label className="block text-sm font-medium mb-2">Adicionar Fotos (opcional)</label>
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {images.map((img, index) => (
                  <div key={index} className="relative">
                    <img src={img} alt="" className="w-20 h-20 object-cover rounded-lg" />
                    <button
                      onClick={() => setImages(prev => prev.filter((_, i) => i !== index))}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {images.length < 5 && (
                  <label className="w-20 h-20 border-2 border-dashed border-border rounded-lg flex items-center justify-center cursor-pointer hover:border-primary">
                    <Camera className="w-6 h-6 text-muted-foreground" />
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleImageUpload}
                    />
                  </label>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button onClick={handleSubmit} className="flex-1">Enviar Avaliação</Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
          </div>
        </div>
      )}

      {/* Reviews List */}
      <div className="space-y-4">
        {reviews.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            Seja o primeiro a avaliar este produto!
          </p>
        ) : (
          reviews.map((review) => (
            <div key={review.id} className="bg-card rounded-xl border border-border p-6">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold">{review.userName}</span>
                    {review.verified && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                        ✓ Compra Verificada
                      </span>
                    )}
                  </div>
                  {renderStars(review.rating)}
                </div>
                <span className="text-sm text-muted-foreground">
                  {new Date(review.date).toLocaleDateString('pt-BR')}
                </span>
              </div>
              
              <p className="text-foreground mb-3">{review.comment}</p>
              
              {review.images && review.images.length > 0 && (
                <div className="flex gap-2 mb-3">
                  {review.images.map((img, index) => (
                    <img
                      key={index}
                      src={img}
                      alt=""
                      className="w-24 h-24 object-cover rounded-lg cursor-pointer hover:opacity-80"
                      onClick={() => window.open(img, '_blank')}
                    />
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ProductReviews;
