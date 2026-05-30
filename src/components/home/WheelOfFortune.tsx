import { safeStorage } from '@/utils/storage';
import React, { useState, useEffect } from 'react';
import { Gift, X, Sparkles, AlertCircle } from 'lucide-react';
import { couponService } from '@/services/couponService';

interface WheelOfFortuneProps {
  onClose?: () => void;
}

const SECTORS = [
  { label: '90% OFF', color: '#FF5722', text: '#FFFFFF', value: 90, type: 'percent', code: 'SAKURA90' },
  { label: '15% OFF', color: '#FF9800', text: '#FFFFFF', value: 15, type: 'percent', code: 'SAKURA15' },
  { label: 'Frete Grátis', color: '#4CAF50', text: '#FFFFFF', value: 0, type: 'free', code: 'FRETEGRATIS' },
  { label: 'Tente De Novo', color: '#9E9E9E', text: '#FFFFFF', value: 0, type: 'retry', code: '' },
  { label: 'R$ 50 OFF', color: '#E91E63', text: '#FFFFFF', value: 50, type: 'fixed', code: 'SAKURA50' },
  { label: 'R$ 100 OFF', color: '#9C27B0', text: '#FFFFFF', value: 100, type: 'fixed', code: 'SAKURA100' },
];

export const WheelOfFortune: React.FC<WheelOfFortuneProps> = ({ onClose }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const [hasSpun, setHasSpun] = useState(false);
  const [rotationDegrees, setRotationDegrees] = useState(0);
  const [prize, setPrize] = useState<typeof SECTORS[0] | null>(null);
  const [showPrizeModal, setShowPrizeModal] = useState(false);
  const [particles, setParticles] = useState<{ id: number; char: string; left: number; top: number; delay: number }[]>([]);

  useEffect(() => {
    // Check if user already spun in the last 24h
    const spunTime = safeStorage.getItem('sakura_wheel_spun_time');
    const now = Date.now();
    const recentlySpun = spunTime && now - parseInt(spunTime) <= 24 * 60 * 60 * 1000;
    if (recentlySpun) return;

    // Exit-intent: show the wheel only when the user moves to leave the page
    // (mouse exits through the top of the viewport, e.g. toward the tab bar / close button).
    let triggered = false;
    const handleMouseOut = (e: MouseEvent) => {
      if (triggered) return;
      if (e.clientY <= 0 && !e.relatedTarget) {
        triggered = true;
        setIsOpen(true);
        document.removeEventListener('mouseout', handleMouseOut);
      }
    };
    document.addEventListener('mouseout', handleMouseOut);
    return () => document.removeEventListener('mouseout', handleMouseOut);
  }, []);

  const spinWheel = () => {
    if (isSpinning || hasSpun) return;

    setIsSpinning(true);
    
    // Rig the wheel to land on '15% OFF' (index 1)
    // Slices (clockwise from top):
    // 0: 90% OFF (0 to 60 deg)
    // 1: 15% OFF (60 to 120 deg)
    // 2: Frete Grátis (120 to 180 deg)
    // 3: Tente De Novo (180 to 240 deg)
    // 4: R$ 50 OFF (240 to 300 deg)
    // 5: R$ 100 OFF (300 to 360 deg)

    const targetSectorIndex = 1; // 15% OFF
    const sectorAngle = 360 / SECTORS.length;
    // Calculate degree to center the 90% OFF slice under the pointer
    const targetAngle = 360 - (targetSectorIndex * sectorAngle) - (sectorAngle / 2);
    
    // 5 full rotations + offset
    const totalRotation = 3600 + targetAngle;
    setRotationDegrees(totalRotation);

    setTimeout(() => {
      setIsSpinning(false);
      setHasSpun(true);
      const wonPrize = SECTORS[targetSectorIndex];
      setPrize(wonPrize);
      
      // Save spin time in safeStorage
      safeStorage.setItem('sakura_wheel_spun_time', Date.now().toString());

      // Create the won coupon in our system database so it's valid at checkout
      try {
        couponService.create({
          code: wonPrize.code,
          discount: wonPrize.type === 'fixed' ? wonPrize.value : 0,
          discountPercent: wonPrize.type === 'percent' ? wonPrize.value : undefined,
          type: wonPrize.type === 'percent' ? 'percent' : 'fixed',
          expiryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days validity
          isActive: true,
          freeShipping: wonPrize.type === 'free',
          description: `Cupom especial da Roda da Fortuna de ${wonPrize.label}!`,
        });
      } catch (err) {
        console.warn('Coupon already exists or could not be created:', err);
      }

      // Auto-set the coupon code in clipboard & active coupon storage for auto-apply
      safeStorage.setItem('sakura_active_coupon', wonPrize.code);

      // Generate particles for confetti
      const emojis = ['🎉', '🇯🇵', '🌸', '✨', '🎫', '🍊', '💵'];
      const newParticles = Array.from({ length: 40 }).map((_, i) => ({
        id: i,
        char: emojis[Math.floor(Math.random() * emojis.length)],
        left: Math.random() * 100,
        top: Math.random() * -20 - 5,
        delay: Math.random() * 2,
      }));
      setParticles(newParticles);
      setShowPrizeModal(true);
    }, 5000); // 5s spinning animation
  };

  const handleClose = () => {
    setIsOpen(false);
    if (onClose) onClose();
  };

  const handleAcceptPrize = () => {
    setShowPrizeModal(false);
    setIsOpen(false);
    if (prize) {
      // Auto-fill checkout/cart input with coupon code
      safeStorage.setItem('sakura_promo_applied', prize.code);
    }
    if (onClose) onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
      {/* Confetti overlay */}
      {showPrizeModal && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-50">
          {particles.map((p) => (
            <div
              key={p.id}
              className="absolute text-2xl animate-bounce"
              style={{
                left: `${p.left}%`,
                top: `${p.top}%`,
                animationDelay: `${p.delay}s`,
                animationDuration: '3s',
                transform: 'translateY(110vh)',
                transition: 'transform 3s linear',
              }}
            >
              {p.char}
            </div>
          ))}
        </div>
      )}

      {/* Main Wheel Modal */}
      {!showPrizeModal ? (
        <div className="relative bg-gradient-to-b from-red-600 via-orange-500 to-yellow-500 rounded-3xl w-full max-w-md p-6 text-white text-center shadow-elevated border-4 border-yellow-400 overflow-hidden animate-fade-up">
          {/* Close button */}
          <button 
            onClick={handleClose} 
            className="absolute top-4 right-4 bg-black/30 hover:bg-black/50 text-white rounded-full p-2 transition-all z-10"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Decorative Sakura Blossoms */}
          <div className="absolute top-0 left-0 w-12 h-12 text-pink-300 opacity-20 pointer-events-none text-2xl p-2">🌸</div>
          <div className="absolute bottom-4 right-4 w-12 h-12 text-pink-300 opacity-20 pointer-events-none text-2xl p-2">🌸</div>

          <div className="mt-4 mb-2 flex justify-center">
            <span className="bg-yellow-400 text-red-700 font-extrabold text-xs px-3 py-1 rounded-full uppercase tracking-wider shadow-sm animate-pulse flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> Exclusivo do Japão
            </span>
          </div>

          <h2 className="font-display text-3xl font-extrabold tracking-tight mb-1 text-yellow-300">
            RODA DA FORTUNA!
          </h2>
          <p className="text-sm font-semibold text-white/90 mb-6 px-4">
            Gire e ganhe 15% de desconto em cosméticos, figures de anime e doces japoneses!
          </p>

          {/* The Spinning Wheel Visual */}
          <div className="relative w-72 h-72 mx-auto mb-6 flex items-center justify-center">
            {/* Pointer indicator */}
            <div className="absolute -top-3 w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-t-[20px] border-t-yellow-300 drop-shadow-md z-30 animate-bounce" />

            {/* Glowing border */}
            <div className="absolute inset-0 rounded-full border-8 border-yellow-300 shadow-lg bg-yellow-400/20 z-10 pointer-events-none" />

            {/* Light bulbs along the wheel border */}
            <div className="absolute inset-[-4px] rounded-full border-2 border-dotted border-white/50 animate-spin z-20 pointer-events-none" style={{ animationDuration: '20s' }} />

            {/* The actual rotating wheel */}
            <div 
              className="w-full h-full rounded-full overflow-hidden shadow-inner relative flex items-center justify-center"
              style={{
                backgroundImage: `conic-gradient(
                  #FF5722 0deg 60deg, 
                  #FF9800 60deg 120deg, 
                  #4CAF50 120deg 180deg, 
                  #9E9E9E 180deg 240deg, 
                  #E91E63 240deg 300deg, 
                  #9C27B0 300deg 360deg
                )`,
                transform: `rotate(${rotationDegrees}deg)`,
                transition: isSpinning ? 'transform 5s cubic-bezier(0.1, 0.8, 0.1, 1)' : 'none',
              }}
            >
              {/* Text labels inside slices */}
              {SECTORS.map((sector, index) => {
                const angle = -90 + (360 / SECTORS.length) * index + (360 / SECTORS.length) / 2;
                return (
                  <div
                    key={index}
                    className="absolute font-extrabold text-xs pointer-events-none"
                    style={{
                      top: '50%',
                      left: '50%',
                      width: '50%',
                      height: '40px',
                      marginTop: '-20px',
                      transformOrigin: 'left center',
                      transform: `rotate(${angle}deg)`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      paddingRight: '25px',
                      color: sector.text,
                    }}
                  >
                    <span 
                      className="inline-block whitespace-nowrap" 
                      style={{ 
                        textShadow: '0 2px 4px rgba(0,0,0,0.6)' 
                      }}
                    >
                      {sector.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Spinning Wheel Center Pin (Interactive Spin Button) */}
            <button
              onClick={spinWheel}
              disabled={isSpinning || hasSpun}
              className={`absolute w-16 h-16 rounded-full border-4 border-yellow-300 font-extrabold text-sm tracking-wider uppercase flex items-center justify-center z-30 transition-all duration-300 shadow-md ${
                isSpinning || hasSpun
                  ? 'bg-gray-400 text-gray-200 cursor-not-allowed border-gray-300'
                  : 'bg-red-600 text-yellow-300 hover:scale-105 hover:bg-red-700 active:scale-95'
              }`}
            >
              {isSpinning ? '...' : 'GIRAR'}
            </button>
          </div>

          <div className="text-xs text-white/80 bg-black/25 py-2 px-4 rounded-xl flex items-center justify-center gap-1.5 max-w-xs mx-auto">
            <AlertCircle className="w-4 h-4 shrink-0 text-yellow-300" />
            Válido apenas hoje para 1 giro por cliente.
          </div>
        </div>
      ) : (
        /* Winner Announcement Popup */
        <div className="relative bg-white rounded-3xl w-full max-w-md p-8 text-foreground text-center shadow-elevated border-4 border-orange-500 overflow-hidden animate-fade-in">
          {/* Decorative top header color bar */}
          <div className="absolute top-0 inset-x-0 h-4 bg-gradient-to-r from-orange-500 via-yellow-400 to-red-500" />
          
          <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-6 mt-2 border border-orange-200 animate-bounce">
            <Gift className="w-10 h-10 text-orange-500" />
          </div>

          <span className="text-sm font-bold text-orange-500 uppercase tracking-widest">Parabéns!</span>
          
          <h2 className="font-display text-4xl font-extrabold text-gray-900 mt-2 mb-3">
            Você Ganhou!
          </h2>
          
          <div className="bg-orange-50 rounded-2xl p-6 border-2 border-dashed border-orange-300 my-6">
            <p className="text-xs text-muted-foreground uppercase font-semibold">Seu Prêmio Exclusivo</p>
            <p className="text-4xl font-extrabold text-orange-600 my-1">{prize?.label}</p>
            <p className="text-xs text-muted-foreground">Aplicável a todos os produtos de importação japonesa</p>

            <div className="mt-4 pt-4 border-t border-orange-200/50">
              <span className="text-xs text-gray-500 block mb-1">CÓDIGO DO CUPOM:</span>
              <span className="inline-block bg-white border border-gray-300 text-gray-800 font-mono font-bold text-xl px-4 py-1.5 rounded-lg select-all">
                {prize?.code}
              </span>
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-xs text-muted-foreground px-4">
              🔥 O cupom foi copiado e **será aplicado automaticamente** na finalização do seu carrinho.
            </p>

            <button
              onClick={handleAcceptPrize}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 px-6 rounded-xl transition-all shadow-md hover:shadow-lg active:scale-95 text-lg"
            >
              Aproveitar Desconto!
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
