import { useEffect, useRef, useState } from 'react';

/** Retorna um ref e se o elemento já entrou na viewport (uma vez só, não reverte). */
export function useScrollReveal<T extends HTMLElement = HTMLDivElement>(rootMargin = '0px 0px -80px 0px') {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') { setVisible(true); return; }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin, threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);

  return { ref, visible };
}
