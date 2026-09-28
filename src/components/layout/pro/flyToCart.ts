/**
 * SANDBOX — animação "voar até o carrinho". Não depende de quem chamou o
 * addToCart: usa o último toque/clique (capturado globalmente) para achar a
 * foto do produto na tela e a lança em arco até o ícone do carrinho visível.
 */

const RECENT_MS = 1500;
const CLONE_MAX = 160;
const LANDED_SIZE = 28;

/** Balanço do ícone do carrinho quando um produto "pousa" nele. */
export const CART_KICK = { rotate: [0, -16, 12, -8, 4, 0], scale: [1, 1.25, 1, 1.08, 1] };

let lastPointer: { x: number; y: number; target: Element | null; at: number } | null = null;

/** Registra o último pointerdown (fase de captura). Retorna o cleanup. */
export const trackPointer = () => {
  const onDown = (e: PointerEvent) => {
    lastPointer = { x: e.clientX, y: e.clientY, target: e.target instanceof Element ? e.target : null, at: performance.now() };
  };
  document.addEventListener('pointerdown', onDown, true);
  return () => document.removeEventListener('pointerdown', onDown, true);
};

const onScreen = (el: Element) => {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth;
};

/**
 * Foto de origem: dentro do card/diálogo/seção onde o cliente clicou, a imagem
 * do produto adicionado (por `src`) ou, sem correspondência, a mais próxima do
 * clique. Sem clique recente (ex.: adicionado pelo assistente) → null.
 */
export const findSourceImage = (srcs: string[]): HTMLImageElement | null => {
  if (!lastPointer || performance.now() - lastPointer.at > RECENT_MS) return null;
  const { x, y, target } = lastPointer;
  const scope = target?.closest('article, [role="dialog"], section');
  const wanted = srcs.filter(Boolean);

  const pool = [...(scope ?? document).querySelectorAll('img')].filter((img) => img.naturalWidth > 0 && onScreen(img));
  const matching = pool.filter((img) => wanted.some((s) => img.src === s || img.src.endsWith(s) || img.currentSrc === s));
  const candidates = matching.length ? matching : scope ? pool : [];
  let best: HTMLImageElement | null = null;
  let bestDist = Infinity;
  for (const img of candidates) {
    const r = img.getBoundingClientRect();
    const dist = Math.hypot(r.left + r.width / 2 - x, r.top + r.height / 2 - y);
    if (dist < bestDist) {
      best = img;
      bestDist = dist;
    }
  }
  return best;
};

/** Alvo: ícone do carrinho marcado com `data-cart-target`; a barra inferior (mobile) tem prioridade. */
export const findCartTarget = (): Element | null => {
  const targets = [...document.querySelectorAll('[data-cart-target]')].filter(onScreen);
  return targets.find((el) => el.getAttribute('data-cart-target') === 'bottom') ?? targets[0] ?? null;
};

/** Lança uma cópia da foto em arco até `target`. Resolve quando pousa. */
export const flyToCart = (img: HTMLImageElement, target: Element): Promise<void> => {
  const from = img.getBoundingClientRect();
  const to = target.getBoundingClientRect();
  const size = Math.min(from.width, from.height, CLONE_MAX);
  const startX = from.left + from.width / 2;
  const startY = from.top + from.height / 2;

  const clone = new Image();
  clone.src = img.currentSrc || img.src;
  clone.alt = '';
  clone.setAttribute('aria-hidden', 'true');
  Object.assign(clone.style, {
    position: 'fixed',
    zIndex: '10001',
    left: `${startX - size / 2}px`,
    top: `${startY - size / 2}px`,
    width: `${size}px`,
    height: `${size}px`,
    objectFit: 'contain',
    background: '#fff',
    borderRadius: '16px',
    boxShadow: '0 18px 40px -12px rgba(157,23,77,0.55)',
    pointerEvents: 'none',
    willChange: 'transform, opacity',
  });
  document.body.appendChild(clone);

  const dx = to.left + to.width / 2 - startX;
  const dy = to.top + to.height / 2 - startY;
  const scale = LANDED_SIZE / size;
  // Ponto alto do arco, sem sair pelo topo da tela.
  const midY = Math.max(dy * 0.5 - 90, 12 - startY);

  const anim = clone.animate(
    [
      { transform: 'translate(0, 0) scale(1) rotate(0deg)', opacity: 1, borderRadius: '16px' },
      { transform: `translate(${dx * 0.5}px, ${midY}px) scale(${(1 + scale) / 2}) rotate(-10deg)`, opacity: 1, offset: 0.5 },
      { transform: `translate(${dx}px, ${dy}px) scale(${scale}) rotate(0deg)`, opacity: 0.35, borderRadius: '50%' },
    ],
    { duration: 750, easing: 'cubic-bezier(.5,0,.3,1)' },
  );
  return anim.finished.then(
    () => clone.remove(),
    () => clone.remove(),
  );
};
