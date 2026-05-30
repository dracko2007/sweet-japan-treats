import { Product } from '@/types';

export const products: Product[] = [
  // ==========================================
  // COSMÉTICOS
  // ==========================================
  {
    id: 'biore-uv',
    name: 'Bioré UV Aqua Rich Watery Essence SPF50+ (85g)',
    description: 'Protetor solar líder em vendas no Japão há mais de 10 anos! A tecnologia Micro Defense cria uma barreira invisível que penetra nas microfissuras da pele, oferecendo proteção UVA/UVB de altíssimo nível. A textura em gel aquoso é super leve, absorve em segundos sem deixar resíduos brancos ou pegajosidade. Resistente à água e ao suor, perfeito para o clima tropical do Brasil. Dermatologicamente testado e seguro para uso diário.',
    category: 'cosmeticos',
    prices: { small: 980, large: 2400 },
    image: '/images/cosmeticos/biore-uv-1.jpg',
    gallery: [
      '/images/cosmeticos/biore-uv-1.jpg',
      '/images/cosmeticos/biore-uv-2.jpg',
      '/images/cosmeticos/biore-uv-3.jpg',
      '/images/cosmeticos/biore-uv-4.jpg',
      '/images/cosmeticos/biore-uv-5.jpg'
    ],
    flavor: 'Aqua Rich Essence'
  },
  {
    id: 'hada-labo',
    name: 'Hada Labo Gokujyun Premium Hyaluronic Acid Lotion (170ml)',
    description: 'A loção hidratante mais famosa do Japão, usada por milhões de pessoas. Contém 4 tipos de ácido hialurônico de diferentes pesos moleculares, que trabalham em conjunto para hidratar em diferentes camadas da pele. A fórmula premium Gokujyun oferece hidratação profunda e duradoura, deixando a pele macia, suave e radiante. Sem fragrância, corantes ou álcool. Ideal para peles secas, sensíveis e todas as idades. Deve ser aplicada após a limpeza, ainda com a pele úmida, para máxima absorção.',
    category: 'cosmeticos',
    prices: { small: 880, large: 2100 },
    image: '/images/cosmeticos/hada-labo-1.jpg',
    gallery: [
      '/images/cosmeticos/hada-labo-1.jpg',
      '/images/cosmeticos/hada-labo-2.jpg',
      '/images/cosmeticos/hada-labo-3.jpg',
      '/images/cosmeticos/hada-labo-4.jpg',
      '/images/cosmeticos/hada-labo-5.jpg'
    ],
    flavor: 'Gokujyun Premium'
  },
  {
    id: 'dhc-cleansing',
    name: 'DHC Deep Cleansing Oil Premium (150ml)',
    description: 'O lendário óleo removedor de maquiagem japonês que revolucionou a rotina de skincare em todo o mundo. Formulado com azeite de oliva extra virgem de qualidade premium, rico em antioxidantes e ácidos graxos essenciais. Dissolve instantaneamente toda a maquiagem, incluindo rímel à prova d\'água, protetor solar resistente e impurezas profundas, sem obstruir os poros ou deixar resíduos. A fórmula única de DHC transforma em emulsão quando em contato com água, limpando profundamente sem ressecamento. Dermatologicamente testado. Aroma suave e relaxante.',
    category: 'cosmeticos',
    prices: { small: 1650, large: 3800 },
    image: '/images/cosmeticos/dhc-cleansing-1.jpg',
    gallery: [
      '/images/cosmeticos/dhc-cleansing-1.jpg',
      '/images/cosmeticos/dhc-cleansing-2.jpg',
      '/images/cosmeticos/dhc-cleansing-3.jpg',
      '/images/cosmeticos/dhc-cleansing-4.jpg',
      '/images/cosmeticos/dhc-cleansing-5.jpg'
    ],
    flavor: 'Olive Premium'
  },
  {
    id: 'melano-cc',
    name: 'Melano CC Vitamin C Brightening Essence (20ml)',
    description: 'O sérum de Vitamina C mais potente e puro da linha Melano CC. Contém vitamina C estável em alta concentração (ácido ascórbico) que penetra profundamente na pele, estimulando a produção natural de colágeno e elastina. Excelente para tratar manchas escuras, hiperpigmentação, cicatrizes de acne e vermelhidão. A fórmula concentrada oferece resultados visíveis em 4-6 semanas de uso regular. Textura leve que absorve rapidamente. Deve ser usada à noite após limpeza, pois a vitamina C é sensível à luz. Ideal para peles manchadas e com falta de brilho.',
    category: 'cosmeticos',
    prices: { small: 1210, large: 2800 },
    image: '/images/cosmeticos/melano-cc-1.jpg',
    gallery: [
      '/images/cosmeticos/melano-cc-1.jpg',
      '/images/cosmeticos/melano-cc-2.jpg',
      '/images/cosmeticos/melano-cc-3.jpg',
      '/images/cosmeticos/melano-cc-4.jpg',
      '/images/cosmeticos/melano-cc-5.jpg'
    ],
    flavor: 'Vitamin C Essence'
  },
  {
    id: 'softymo-oil',
    name: 'Kose Softymo Speedy Cleansing Oil Premium (230ml)',
    description: 'Óleo removedor de maquiagem ultra-rápido e eficiente da marca Kose, lider em cuidados com pele no Japão. Remove toda maquiagem pesada (incluindo eyeliner à prova d\'água) em apenas 30 segundos. O diferencial é que pode ser usado com as mãos e o rosto molhados durante o banho, economizando tempo na rotina. A fórmula é balanceada entre limpeza profunda e suavidade, deixando a pele macia e não ressecada. Aroma leve e agradável. Recomendado por makeup artists profissionais em Tóquio.',
    category: 'cosmeticos',
    prices: { small: 680, large: 1580 },
    image: '/images/cosmeticos/softymo-oil-1.jpg',
    gallery: [
      '/images/cosmeticos/softymo-oil-1.jpg',
      '/images/cosmeticos/softymo-oil-2.jpg',
      '/images/cosmeticos/softymo-oil-3.jpg',
      '/images/cosmeticos/softymo-oil-4.jpg',
      '/images/cosmeticos/softymo-oil-5.jpg'
    ],
    flavor: 'Speedy Oil'
  },

  // ==========================================
  // DOCES & CHÁS
  // ==========================================
  {
    id: 'kitkat-matcha',
    name: 'Nestlé KitKat Matcha Green Tea Premium (12 mini)',
    description: 'O famoso wafer crocante em chocolate coberto com matcha premium de Uji, Kyoto - a região mais renomada para cultivo de chá verde no Japão. Esta edição especial combina o contraste perfeito entre o amargor sutil e delicado do matcha autêntico com a doçura cremosa do chocolate branco. Cada wafer é feito com técnica artesanal para garantir o equilíbrio perfeito de sabores. É o souvenir mais procurado no Japão e viciante para os amantes de matcha. Embalagem premium em caixa coletora.',
    category: 'doces',
    prices: { small: 398, large: 820 },
    image: '/images/doces/kitkat-matcha-1.jpg',
    gallery: [
      '/images/doces/kitkat-matcha-1.jpg',
      '/images/doces/kitkat-matcha-2.jpg',
      '/images/doces/kitkat-matcha-3.jpg',
      '/images/doces/kitkat-matcha-4.jpg',
      '/images/doces/kitkat-matcha-5.jpg'
    ],
    flavor: 'Kyoto Matcha'
  },
  {
    id: 'jagariko-calbee',
    name: 'Calbee Jagariko Potato Sticks Salad Flavor (60g)',
    description: 'Snack crocante de batata frita em formato de palitos assados da marca Calbee. Sabor clássico de salada com tempero de cenoura e salsa desidratadas que dão um gostinho fresco e herbal. A textura é estaladiça e viciante, mantendo a crocância mesmo depois de aberto. Feito com batatas selecionadas de alta qualidade e frito em óleo premium. Muito popular no Japão e na Ásia como snack no intervalo ou durante estudos. Embalagem reutilizável que mantém o snack fresco por mais tempo.',
    category: 'doces',
    prices: { small: 148, large: 320 },
    image: '/images/doces/jagariko-calbee-1.jpg',
    gallery: [
      '/images/doces/jagariko-calbee-1.jpg',
      '/images/doces/jagariko-calbee-2.jpg',
      '/images/doces/jagariko-calbee-3.jpg',
      '/images/doces/jagariko-calbee-4.jpg',
      '/images/doces/jagariko-calbee-5.jpg'
    ],
    flavor: 'Jagariko Salada'
  },
  {
    id: 'takenoko-meiji',
    name: 'Meiji Takenoko no Sato Chocolate Snacks Premium (70g)',
    description: 'Tradicional biscoito japonês em formato de broto de bambu (takenoko), criado há mais de 50 anos. Possui uma base de biscoito amanteigado extremamente crocante e macio, coberta com duas camadas harmonizadas de chocolate ao leite e chocolate meio amargo. O formato único em cone facilita a refeição sem sujar os dedos. A combinação de sabores é icônica no Japão - o contraste do biscoito amanteigado com os dois tipos de chocolate cria uma experiência gustativa única. Competidor tradicional do Pocky no mercado japonês.',
    category: 'doces',
    prices: { small: 218, large: 480 },
    image: '/images/doces/takenoko-meiji-1.jpg',
    gallery: [
      '/images/doces/takenoko-meiji-1.jpg',
      '/images/doces/takenoko-meiji-2.jpg',
      '/images/doces/takenoko-meiji-3.jpg',
      '/images/doces/takenoko-meiji-4.jpg',
      '/images/doces/takenoko-meiji-5.jpg'
    ],
    flavor: 'Broto de Bambu'
  }
];

export const getProductsByCategory = (category: string): Product[] => {
  return products.filter(product => product.category === category);
};
