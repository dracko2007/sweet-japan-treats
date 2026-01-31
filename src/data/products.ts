import { Product } from '@/types';

export const products: Product[] = [
  // Artesanal - 280g: ¥1200, 800g: ¥2000
  {
    id: 'art-cremoso',
    name: 'Doce de Leite Cremoso',
    description: 'O clássico doce de leite brasileiro, cremoso e irresistível. Feito com leite fresco e açúcar, cozido lentamente até atingir a textura perfeita.',
    category: 'artesanal',
    prices: { small: 1200, large: 2000 },
    image: '/products/cremoso.jpg',
    flavor: 'Tradicional'
  },
  {
    id: 'art-cafe',
    name: 'Doce de Leite de Café',
    description: 'Uma combinação perfeita do doce de leite tradicional com o sabor marcante do café brasileiro. Ideal para os amantes de café.',
    category: 'artesanal',
    prices: { small: 1200, large: 2000 },
    image: '/products/cafe.jpg',
    flavor: 'Café'
  },
  {
    id: 'art-coco',
    name: 'Doce de Leite de Coco',
    description: 'A doçura tropical do coco combinada com a cremosidade do doce de leite. Uma experiência única e refrescante.',
    category: 'artesanal',
    prices: { small: 1200, large: 2000 },
    image: '/products/coco.jpg',
    flavor: 'Coco'
  },
  {
    id: 'art-amendoim',
    name: 'Doce de Leite de Amendoim',
    description: 'O sabor irresistível do amendoim torrado misturado ao doce de leite cremoso. Perfeito para paladares exigentes.',
    category: 'artesanal',
    prices: { small: 1200, large: 2000 },
    image: '/products/amendoim.jpg',
    flavor: 'Amendoim'
  },
  // Premium - 280g: ¥1400, 800g: ¥2400
  {
    id: 'prem-amendoas',
    name: 'Doce de Leite de Amêndoas',
    description: 'Uma versão sofisticada com amêndoas selecionadas. O toque crocante das amêndoas eleva esta experiência a outro nível.',
    category: 'premium',
    prices: { small: 1400, large: 2400 },
    image: '/products/amendoas.jpg',
    flavor: 'Amêndoas'
  },
  {
    id: 'prem-matcha',
    name: 'Doce de Leite de Matcha',
    description: 'A fusão perfeita entre o Brasil e o Japão. Matcha de alta qualidade de Uji combinado com nosso doce de leite artesanal.',
    category: 'premium',
    prices: { small: 1400, large: 2400 },
    image: '/products/matcha.jpg',
    flavor: 'Matcha'
  },
  {
    id: 'prem-chocolate',
    name: 'Doce de Leite de Chocolate',
    description: 'Chocolate belga premium encontra o doce de leite brasileiro. Uma indulgência irresistível para os chocólatras.',
    category: 'premium',
    prices: { small: 1400, large: 2400 },
    image: '/products/chocolate.jpg',
    flavor: 'Chocolate'
  }
];

export const getProductsByCategory = (category: 'artesanal' | 'premium') => {
  return products.filter(p => p.category === category);
};
