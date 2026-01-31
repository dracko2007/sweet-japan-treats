import { Product } from '@/types';

export const products: Product[] = [
  // Artesanal - 280g: ¥1200, 800g: ¥2000
  {
    id: 'art-cremoso',
    name: 'Doce de Leite Tradicional',
    description: 'Doce de leite artesanal, textura cremosa e sabor intenso. Feito apenas com leite e açúcar, sem leite condensado e sem conservantes.',
    category: 'artesanal',
    prices: { small: 1200, large: 2000 },
    image: '/products/tradicional.jpg',
    flavor: 'Tradicional'
  },
  {
    id: 'art-cafe',
    name: 'Doce de Leite de Café',
    description: 'Doce de leite com café selecionado. Combinação perfeita do doce com o sabor marcante do café.',
    category: 'artesanal',
    prices: { small: 1200, large: 2000 },
    image: '/products/cafe.jpg',
    flavor: 'Café'
  },
  {
    id: 'art-coco',
    name: 'Doce de Leite de Coco',
    description: 'Doce de leite com coco selecionado, equilibrado e aromático. Textura cremosa e sabor tropical.',
    category: 'artesanal',
    prices: { small: 1200, large: 2000 },
    image: '/products/coco.jpg',
    flavor: 'Coco'
  },
  {
    id: 'art-amendoim',
    name: 'Doce de Leite de Amendoim',
    description: 'Com amendoim torrado como creme de amendoim e toque de sal. Sabor intenso e irresistível.',
    category: 'artesanal',
    prices: { small: 1200, large: 2000 },
    image: '/products/amendoim.jpg',
    flavor: 'Amendoim'
  },
  // Premium - 280g: ¥1400, 800g: ¥2400
  {
    id: 'prem-amendoas',
    name: 'Doce de Leite de Amêndoas',
    description: 'Doce de leite artesanal com amêndoas torradas. Versão premium sofisticada e crocante.',
    category: 'premium',
    prices: { small: 1400, large: 2400 },
    image: '/products/amendoas.jpg',
    flavor: 'Amêndoas'
  },
  {
    id: 'prem-matcha',
    name: 'Doce de Leite de Matcha Japonês',
    description: 'Finalizado com matcha culinário, trazendo o aroma delicado e o doce e o amargo do chá-verde. Fusão Brasil-Japão.',
    category: 'premium',
    prices: { small: 1400, large: 2400 },
    image: '/products/matcha.jpg',
    flavor: 'Matcha'
  },
  {
    id: 'prem-chocolate',
    name: 'Doce de Leite de Chocolate Meio Amargo',
    description: 'Com chocolate selecionado, equilibrando com notas intensas de cacau. Premium e irresistível.',
    category: 'premium',
    prices: { small: 1400, large: 2400 },
    image: '/products/chocolate.jpg',
    flavor: 'Chocolate'
  }
];

export const getProductsByCategory = (category: 'artesanal' | 'premium') => {
  return products.filter(p => p.category === category);
};
