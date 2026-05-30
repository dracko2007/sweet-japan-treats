import { Product } from '@/types';

export const products: Product[] = [
  // Doce de Leite Sabor do Campo (Local Japan Only) - Prices in ¥
  {
    id: 'art-cremoso',
    name: 'Doce de Leite Cremoso',
    description: 'O clássico doce de leite brasileiro, cremoso e irresistível. Feito com leite fresco e açúcar, cozido lentamente até atingir a textura perfeita.',
    category: 'artesanal',
    prices: { small: 1200, large: 2000 },
    image: '/products/cremoso.jpg',
    gallery: [
      '/products/cremoso.jpg',
      '/products/gallery/cremoso-1.jpg',
      '/products/gallery/cremoso-2.jpg',
      '/products/gallery/cremoso-3.jpg',
      '/products/gallery/cremoso-4.jpg',
    ],
    video: '/video/tradicional.mp4',
    flavor: 'Tradicional',
    deliveryRestrict: 'Japão'
  },
  {
    id: 'art-coco',
    name: 'Doce de Leite de Coco',
    description: 'A doçura tropical do coco combinada com a cremosidade do doce de leite. Uma experiência única e refrescante.',
    category: 'artesanal',
    prices: { small: 1200, large: 2000 },
    image: '/products/coco.jpg',
    gallery: [
      '/products/coco.jpg',
      '/products/gallery/coco-1.jpg',
      '/products/gallery/coco-2.jpg',
      '/products/gallery/coco-3.jpg',
      '/products/gallery/coco-4.jpg',
    ],
    video: '/video/coco.mp4',
    flavor: 'Coco',
    deliveryRestrict: 'Japão'
  },
  {
    id: 'art-amendoim',
    name: 'Doce de Leite de Amendoim',
    description: 'O sabor irresistível do amendoim torrado misturado ao doce de leite cremoso. Perfeito para paladares exigentes.',
    category: 'artesanal',
    prices: { small: 1200, large: 2000 },
    image: '/products/amendoim.jpg',
    gallery: [
      '/products/amendoim.jpg',
      '/products/gallery/amendoim-1.jpg',
      '/products/gallery/amendoim-2.jpg',
      '/products/gallery/amendoim-3.jpg',
      '/products/gallery/amendoim-4.jpg',
    ],
    video: '/video/amendoim.mp4',
    flavor: 'Amendoim',
    deliveryRestrict: 'Japão'
  },
  {
    id: 'prem-cafe',
    name: 'Doce de Leite de Café',
    description: 'Uma combinação perfeita do doce de leite tradicional com o sabor marcante do café brasileiro. Ideal para os amantes de café.',
    category: 'premium',
    prices: { small: 1400, large: 2400 },
    image: '/products/cafe.jpg',
    gallery: [
      '/products/cafe.jpg',
      '/products/gallery/cafe-1.jpg',
      '/products/gallery/cafe-2.jpg',
      '/products/gallery/cafe-3.jpg',
      '/products/gallery/cafe-4.jpg',
    ],
    video: '/video/cafe.mp4',
    flavor: 'Café',
    deliveryRestrict: 'Japão'
  },
  {
    id: 'prem-amendoas',
    name: 'Doce de Leite de Amêndoas',
    description: 'Uma versão sofisticada com amêndoas selecionadas. O toque crocante das amêndoas eleva esta experiência a outro nível.',
    category: 'premium',
    prices: { small: 1400, large: 2400 },
    image: '/products/amendoas.jpg',
    gallery: [
      '/products/amendoas.jpg',
      '/products/gallery/amendoas-1.jpg',
      '/products/gallery/amendoas-2.jpg',
      '/products/gallery/amendoas-3.jpg',
      '/products/gallery/amendoas-4.jpg',
    ],
    video: '/video/amendoas.mp4',
    flavor: 'Amêndoas',
    deliveryRestrict: 'Japão'
  },
  {
    id: 'prem-matcha',
    name: 'Doce de Leite de Matcha',
    description: 'A fusão perfeita entre o Brasil e o Japão. Matcha de alta qualidade de Uji combinado com nosso doce de leite artesanal.',
    category: 'premium',
    prices: { small: 1400, large: 2400 },
    image: '/products/matcha.jpg',
    gallery: [
      '/products/matcha.jpg',
      '/products/gallery/matcha-1.jpg',
      '/products/gallery/matcha-2.jpg',
      '/products/gallery/matcha-3.jpg',
      '/products/gallery/matcha-4.jpg',
    ],
    video: '/video/cha.mp4',
    flavor: 'Matcha',
    deliveryRestrict: 'Japão'
  },
  {
    id: 'prem-chocolate',
    name: 'Doce de Leite de Chocolate',
    description: 'Chocolate belga premium encontra o doce de leite brasileiro. Uma indulgência irresistível para os chocólatras.',
    category: 'premium',
    prices: { small: 1400, large: 2400 },
    image: '/products/chocolate.jpg',
    gallery: [
      '/products/chocolate.jpg',
      '/products/gallery/chocolate-1.jpg',
      '/products/gallery/chocolate-2.jpg',
      '/products/gallery/chocolate-3.jpg',
      '/products/gallery/chocolate-4.jpg',
    ],
    video: '/video/chocolate.mp4',
    flavor: 'Chocolate',
    deliveryRestrict: 'Japão'
  },

  // SakuraExpress Imports (To Brazil) - Prices in R$
  {
    id: 'biore-uv',
    name: 'Protetor Solar Bioré UV Aqua Rich SPF 50+',
    description: 'Líder absoluto de vendas no Japão! Sua fórmula revolucionária com tecnologia Micro Defense garante altíssima proteção UVA/UVB invisível, penetrando nas menores frestas da pele. Textura gel à base de água super leve, de rápida absorção e com toque refrescante. Resistente à água e ao suor, ideal para o clima diário do Brasil.',
    category: 'cosmeticos',
    prices: { small: 39.90, large: 69.90 }, // small: Versão 50g, large: Pack Duplo (50g x 2)
    image: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?q=80&w=600&auto=format&fit=crop',
    gallery: [
      'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?q=80&w=600&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1556228720-195a672e8a03?q=80&w=600&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1608248597481-496100c8c836?q=80&w=600&auto=format&fit=crop'
    ],
    flavor: 'Aqua Rich Gel'
  },
  {
    id: 'kitkat-matcha',
    name: 'KitKat Matcha Green Tea (Edição Japão)',
    description: 'O autêntico e inconfundível wafer coberto com chocolate branco blendado com chá verde Matcha premium de Uji, Kyoto. Perfeitamente equilibrado entre o amargor sutil do chá verde e a doçura do chocolate. Edição exclusiva importada diretamente das fábricas do Japão.',
    category: 'doces',
    prices: { small: 24.90, large: 44.90 }, // small: Pacote de 10 unidades, large: Super Pack de 20 unidades
    image: 'https://images.unsplash.com/photo-1587132137056-bfbf0166836e?q=80&w=600&auto=format&fit=crop',
    gallery: [
      'https://images.unsplash.com/photo-1587132137056-bfbf0166836e?q=80&w=600&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1618220179428-22790b461013?q=80&w=600&auto=format&fit=crop'
    ],
    flavor: 'Matcha de Uji'
  },
  {
    id: 'luffy-figure',
    name: 'Action Figure Monkey D. Luffy - Gear 5 (Sun God)',
    description: 'Estátua colecionável de altíssima fidelidade e acabamento. Captura a transformação lendária Gear 5 (Deus do Sol Nika) de Luffy com sua pose cômica e cabelos brancos flutuantes. Pintura detalhada anti-desbotamento e PVC reforçado. Versão Deluxe acompanha base detalhada e iluminação LED integrada.',
    category: 'acessorios',
    prices: { small: 89.90, large: 149.90 }, // small: Versão Standard (15cm), large: Versão Deluxe com Base e LED (22cm)
    image: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=600&auto=format&fit=crop',
    gallery: [
      'https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=600&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?q=80&w=600&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1560169897-fc0cdbdfa4d5?q=80&w=600&auto=format&fit=crop'
    ],
    flavor: 'Luffy Deus do Sol Nika'
  },
  {
    id: 'kawaii-lamp',
    name: 'Luminária Kawaii Gatinho LED de Silicone Touch',
    description: 'Luminária de cabeceira em silicone premium ultra macio e flexível, totalmente livre de BPA. Sensor de toque integrado para alternar facilmente entre 7 cores de iluminação ou modo transição suave. Recarregável via USB com bateria de alta capacidade, garantindo até 15 horas de luz aconchegante.',
    category: 'acessorios',
    prices: { small: 29.90, large: 49.90 }, // small: Modelo mini (sem controle), large: Modelo grande (com controle remoto)
    image: 'https://images.unsplash.com/photo-1540959733332-eab4deceeaf7?q=80&w=600&auto=format&fit=crop',
    gallery: [
      'https://images.unsplash.com/photo-1540959733332-eab4deceeaf7?q=80&w=600&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1517999144091-3d9dca6d1e43?q=80&w=600&auto=format&fit=crop'
    ],
    flavor: 'Gatinho Dormindo'
  },
  {
    id: 'sakura-pens',
    name: 'Canetas Gel Sakura Gelly Roll - Set de 10 Cores',
    description: 'As canetas em gel originais fabricadas no Japão. Tecnologia pioneira de tinta em gel pigmentada de fluxo ultra suave, resistente à água e ao desbotamento. Ponta esferográfica de alta precisão que desliza no papel. Estojo exclusivo contendo cores clássicas e metálicas vibrantes.',
    category: 'papelaria',
    prices: { small: 34.90, large: 59.90 }, // small: Estojo Clássico (10 canetas), large: Super Estojo Glaze/Metallic (20 canetas)
    image: 'https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?q=80&w=600&auto=format&fit=crop',
    gallery: [
      'https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?q=80&w=600&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?q=80&w=600&auto=format&fit=crop'
    ],
    flavor: 'Edição Gel Clássica'
  },
  {
    id: 'muji-organizer',
    name: 'Organizador Modular Acrílico Cristalino (Estilo Muji)',
    description: 'Organizador com divisórias e gavetas modulares fabricado em acrílico de alta densidade com transparência óptica perfeita. Cantos polidos e estrutura robusta de design japonês minimalista. A solução elegante e durável para arrumar cosméticos, joias ou itens de escritório.',
    category: 'acessorios',
    prices: { small: 49.90, large: 89.90 }, // small: Kit com 3 gaveteiros, large: Kit com 5 gaveteiros amplos
    image: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?q=80&w=600&auto=format&fit=crop',
    gallery: [
      'https://images.unsplash.com/photo-1596462502278-27bfdc403348?q=80&w=600&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?q=80&w=600&auto=format&fit=crop'
    ],
    flavor: 'Acrílico Minimalista'
  },
  {
    id: 'sencha-tea',
    name: 'Chá Verde Japonês Sencha de Uji - Folhas Soltas',
    description: 'Chá verde Sencha de colheita premium colhido na famosa província de Uji, Kyoto. Cultivado à sombra para realçar o sabor umami e manter a cor verde brilhante. Notas herbais complexas, aroma refrescante e rico em L-teanina e antioxidantes naturais para sua saúde.',
    category: 'doces',
    prices: { small: 45.00, large: 79.90 }, // small: Pacote 100g, large: Lata de Luxo Metálica 200g
    image: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?q=80&w=600&auto=format&fit=crop',
    gallery: [
      'https://images.unsplash.com/photo-1576092768241-dec231879fc3?q=80&w=600&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1597481499750-3e6b22637e12?q=80&w=600&auto=format&fit=crop'
    ],
    flavor: 'Sencha Orgânico'
  }
];

export const getProductsByCategory = (category: string) => {
  if (category === 'doce-de-leite') {
    return products.filter(p => p.deliveryRestrict === 'Japão');
  }
  return products.filter(p => p.category === category);
};
