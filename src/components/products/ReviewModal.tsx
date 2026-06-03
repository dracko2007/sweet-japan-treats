import React, { useEffect, useState } from 'react';
import { Star, Camera, X, Video, Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useUser } from '@/context/UserContext';
import { reviewService } from '@/services/reviewService';
import { pointsService, POINTS } from '@/services/pointsService';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface ReviewModalProps {
  productId: string;
  productName: string;
  onClose: () => void;
  onDone?: () => void;
}

// Modal de avaliação — usado a partir do HISTÓRICO de pedidos (só quem comprou avalia).
const ReviewModal: React.FC<ReviewModalProps> = ({ productId, productName, onClose, onDone }) => {
  const { user, addPoints } = useUser();
  const { toast } = useToast();
  const [selectedRating, setSelectedRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState('');
  const [alreadyHasVideo, setAlreadyHasVideo] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) pointsService.hasVideoForProduct(user.id, productId).then(setAlreadyHasVideo);
  }, [user, productId]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => setImages((prev) => [...prev, reader.result as string]);
      reader.readAsDataURL(file);
    });
  };

  const submit = () => {
    if (!user) return;
    if (selectedRating === 0) { toast({ title: 'Selecione uma nota (estrelas)', variant: 'destructive' }); return; }
    if (comment.trim().length < 10) { toast({ title: 'Escreva pelo menos 10 caracteres', variant: 'destructive' }); return; }

    setSaving(true);
    const trimmedVideo = videoUrl.trim();
    reviewService.addReview({
      productId,
      userId: user.id,
      userName: user.name,
      rating: selectedRating,
      comment: comment.trim(),
      images: images.length > 0 ? images : undefined,
      videoUrl: trimmedVideo || undefined,
      pointsAwarded: POINTS.perReview,
      verified: true, // veio do histórico → compra garantida
    });
    addPoints(POINTS.perReview);

    let videoMsg = '';
    if (trimmedVideo && !alreadyHasVideo) {
      pointsService.submitVideo({
        userId: user.id, userName: user.name, userEmail: user.email,
        productId, productName, videoUrl: trimmedVideo,
      });
      videoMsg = ' Seu vídeo foi enviado para validação — os pontos do vídeo entram após a aprovação do time.';
    }

    toast({
      title: `🎉 Avaliação enviada! +${POINTS.perReview} ponto`,
      description: `Você agora tem ${(user.points || 0) + POINTS.perReview} pontos.` + videoMsg,
    });
    setSaving(false);
    onDone?.();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-card rounded-2xl w-full max-w-lg my-8 shadow-elevated border border-border">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h3 className="font-display text-lg font-bold flex items-center gap-2"><Star className="w-5 h-5 text-gold" /> Avaliar produto</h3>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-secondary"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-muted-foreground">{productName}</p>

          {/* Banner de pontos */}
          <div className="flex items-start gap-3 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-3">
            <Gift className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 leading-relaxed">
              Avaliar = <b>+{POINTS.perReview} ponto</b> · vídeo de review = <b>+{POINTS.perVideoMinute} pts/min</b> (após validação do time).
            </div>
          </div>

          {/* Estrelas */}
          <div>
            <label className="block text-sm font-medium mb-2">Sua nota</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button key={star} type="button" onClick={() => setSelectedRating(star)}
                  onMouseEnter={() => setHoverRating(star)} onMouseLeave={() => setHoverRating(0)}>
                  <Star className={cn('w-8 h-8 transition-colors',
                    star <= (hoverRating || selectedRating) ? 'fill-gold text-gold' : 'text-gray-300 hover:text-gold')} />
                </button>
              ))}
            </div>
          </div>

          {/* Comentário */}
          <div>
            <label className="block text-sm font-medium mb-2">Seu comentário</label>
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={4}
              placeholder="Compartilhe sua experiência com este produto..." />
          </div>

          {/* Fotos */}
          <div>
            <label className="block text-sm font-medium mb-2">Fotos (opcional)</label>
            <div className="flex flex-wrap gap-2">
              {images.map((img, index) => (
                <div key={index} className="relative">
                  <img src={img} alt="" className="w-16 h-16 object-cover rounded-lg" />
                  <button onClick={() => setImages((prev) => prev.filter((_, i) => i !== index))}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"><X className="w-3 h-3" /></button>
                </div>
              ))}
              {images.length < 5 && (
                <label className="w-16 h-16 border-2 border-dashed border-border rounded-lg flex items-center justify-center cursor-pointer hover:border-primary">
                  <Camera className="w-5 h-5 text-muted-foreground" />
                  <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
                </label>
              )}
            </div>
          </div>

          {/* Vídeo */}
          <div>
            <label className="block text-sm font-medium mb-2 flex items-center gap-1.5">
              <Video className="w-4 h-4" /> Vídeo de review <span className="text-amber-600 font-bold">(+{POINTS.perVideoMinute} pts/min, após validação)</span>
            </label>
            <input type="url" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} disabled={alreadyHasVideo}
              placeholder={alreadyHasVideo ? 'Você já enviou um vídeo deste produto' : 'Cole o link (YouTube, Instagram, TikTok)'}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm disabled:opacity-60" />
          </div>
        </div>

        <div className="p-5 border-t border-border flex gap-3">
          <Button onClick={submit} disabled={saving} className="flex-1">Enviar avaliação</Button>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
        </div>
      </div>
    </div>
  );
};

export default ReviewModal;
