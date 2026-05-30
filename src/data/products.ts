import { Product } from '@/types';

export const products: Product[] = [
  // ==========================================
  // COSMÉTICOS (10 produtos)
  // ==========================================
  {
    id: 'biore-uv',
    name: 'Bioré UV Aqua Rich Watery Essence SPF50+ (85g)',
    description: 'Protetor solar líder em vendas no Japão há mais de 10 anos! A tecnologia Micro Defense cria uma barreira invisível que penetra nas microfissuras da pele, oferecendo proteção UVA/UVB de altíssimo nível. A textura em gel aquoso é super leve, absorve em segundos sem deixar resíduos brancos ou pegajosidade. Resistente à água e ao suor, perfeito para o clima tropical do Brasil. Dermatologicamente testado e seguro para uso diário.',
    category: 'cosmeticos',
    prices: { small: 980, large: 2400 },
    image: 'https://m.media-amazon.com/images/I/71DpMf7DdVL._AC_UY327_QL65_.jpg',
    gallery: [
      'https://m.media-amazon.com/images/I/71DpMf7DdVL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/71t9gV-4-kL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/51HHvTSz8sL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/41DqOeGCbGL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/61JDVX4L4CL._AC_UY327_QL65_.jpg'
    ],
    flavor: 'Aqua Rich Essence'
  },
  {
    id: 'hada-labo',
    name: 'Hada Labo Gokujyun Premium Hyaluronic Acid Lotion (170ml)',
    description: 'A loção hidratante mais famosa do Japão, usada por milhões de pessoas. Contém 4 tipos de ácido hialurônico de diferentes pesos moleculares, que trabalham em conjunto para hidratar em diferentes camadas da pele. A fórmula premium Gokujyun oferece hidratação profunda e duradoura, deixando a pele macia, suave e radiante. Sem fragrância, corantes ou álcool. Ideal para peles secas, sensíveis e todas as idades. Deve ser aplicada após a limpeza, ainda com a pele úmida, para máxima absorção.',
    category: 'cosmeticos',
    prices: { small: 880, large: 2100 },
    image: 'https://m.media-amazon.com/images/I/61ZX0Xvr5SL._AC_UY327_QL65_.jpg',
    gallery: [
      'https://m.media-amazon.com/images/I/61ZX0Xvr5SL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/71-FkApzNZL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/51oHg6xnGxL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/41M5eqC7tRL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/31pPmPqAbkL._AC_UY327_QL65_.jpg'
    ],
    flavor: 'Gokujyun Premium'
  },
  {
    id: 'dhc-cleansing',
    name: 'DHC Deep Cleansing Oil Premium (150ml)',
    description: 'O lendário óleo removedor de maquiagem japonês que revolucionou a rotina de skincare em todo o mundo. Formulado com azeite de oliva extra virgem de qualidade premium, rico em antioxidantes e ácidos graxos essenciais. Dissolve instantaneamente toda a maquiagem, incluindo rímel à prova d\'água, protetor solar resistente e impurezas profundas, sem obstruir os poros ou deixar resíduos. A fórmula única de DHC transforma em emulsão quando em contato com água, limpando profundamente sem ressecamento. Dermatologicamente testado. Aroma suave e relaxante.',
    category: 'cosmeticos',
    prices: { small: 1650, large: 3800 },
    image: 'https://m.media-amazon.com/images/I/61K8h7OhjoL._AC_UY327_QL65_.jpg',
    gallery: [
      'https://m.media-amazon.com/images/I/61K8h7OhjoL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/51AhGJJKWVL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/41KdUnHHp7L._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/71VQDR2tqAL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/31pJ7Y-5JdL._AC_UY327_QL65_.jpg'
    ],
    flavor: 'Olive Premium'
  },
  {
    id: 'melano-cc',
    name: 'Melano CC Vitamin C Brightening Essence (20ml)',
    description: 'O sérum de Vitamina C mais potente e puro da linha Melano CC. Contém vitamina C estável em alta concentração (ácido ascórbico) que penetra profundamente na pele, estimulando a produção natural de colágeno e elastina. Excelente para tratar manchas escuras, hiperpigmentação, cicatrizes de acne e vermelhidão. A fórmula concentrada oferece resultados visíveis em 4-6 semanas de uso regular. Textura leve que absorve rapidamente. Deve ser usada à noite após limpeza, pois a vitamina C é sensível à luz. Ideal para peles manchadas e com falta de brilho.',
    category: 'cosmeticos',
    prices: { small: 1210, large: 2800 },
    image: 'https://m.media-amazon.com/images/I/61f9F8VNpPL._AC_UY327_QL65_.jpg',
    gallery: [
      'https://m.media-amazon.com/images/I/61f9F8VNpPL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/41KUXzPMneL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/51o7DGJV5dL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/71u5ZLp3dpL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/31iQZDXm97L._AC_UY327_QL65_.jpg'
    ],
    flavor: 'Vitamin C Essence'
  },
  {
    id: 'senka-whip',
    name: 'Senka Perfect Whip Cleansing Foam (120g)',
    description: 'O sabonete facial em espuma mais vendido no Japão por mais de 20 anos consecutivos! Quando em contato com água, cria uma espuma micro-densa extremamente rica e aveludada que envolve completamente cada poro, limpando profundamente sem agressão. Contém ácido hialurônico duplo que mantém a umidade natural da pele durante a limpeza. Após a aplicação, a pele fica macia, fresca e hidratada, não ressecada. Recomendado por dermatologistas para uso diário, especialmente para peles secas e sensíveis. Aroma floral suave.',
    category: 'cosmeticos',
    prices: { small: 480, large: 1100 },
    image: 'https://m.media-amazon.com/images/I/71nVGaFTEDL._AC_UY327_QL65_.jpg',
    gallery: [
      'https://m.media-amazon.com/images/I/71nVGaFTEDL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/51u6-a+XwRL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/41HWzGcFWAL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/61HrxXqLjDL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/31mgT+TvU7L._AC_UY327_QL65_.jpg'
    ],
    flavor: 'Perfect Whip'
  },
  {
    id: 'lululun-mask',
    name: 'Lululun Face Mask Pack Daily - Hidratante (7 folhas)',
    description: 'Kit de 7 máscaras faciais premium de hidratação diária intensiva. Cada folha contém 30ml de essência concentrada com ácido hialurônico e extrato de arroz de Mie (região famosa pela qualidade de seus ingredientes cosméticos). A máscara oferece hidratação profunda em apenas 10 minutos, deixando a pele radiante, suave e com brilho natural. Ideal para uso diário como parte da rotina noturna. A folha em microfibra adere perfeitamente ao rosto, permitindo máxima absorção. Adequada para todos os tipos de pele.',
    category: 'cosmeticos',
    prices: { small: 528, large: 1200 },
    image: 'https://m.media-amazon.com/images/I/71LdMDqEBHL._AC_UY327_QL65_.jpg',
    gallery: [
      'https://m.media-amazon.com/images/I/71LdMDqEBHL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/51GyCwH3YtL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/41V+ArmAzUL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/61m1zMC3cLL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/31RqH8BzqiL._AC_UY327_QL65_.jpg'
    ],
    flavor: 'Blue Hydrating'
  },
  {
    id: 'keana-mask',
    name: 'Keana Nadeshiko Rice Mask Premium (10 folhas)',
    description: 'Máscara facial premium japonesa formulada com 100% de soro de arroz puro produzido na região de Mie. O arroz é conhecido há séculos na beleza tradicional japonesa (geisha) por seus poderes de hidratação e iluminação. Esta máscara mineral hidrata profundamente enquanto minimiza visivelmente a aparência de poros dilatados. Ideal para pele áspera, ressecada ou cansada. Oferece efeito lifting suave e restaura o brilho natural. Após 10-15 minutos, a pele fica macia, luminosa e revitalizada. Nenhum ativo químico agressivo, apenas ingredientes naturais.',
    category: 'cosmeticos',
    prices: { small: 715, large: 1650 },
    image: 'https://m.media-amazon.com/images/I/71UgJt+KNWL._AC_UY327_QL65_.jpg',
    gallery: [
      'https://m.media-amazon.com/images/I/71UgJt+KNWL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/51m0gL6zLkL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/41mDbT2+YwL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/61x7RZWL5ZL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/31qNVDQMWfL._AC_UY327_QL65_.jpg'
    ],
    flavor: 'Rice Mask'
  },
  {
    id: 'curel-cream',
    name: 'Curel Intensive Moisture Cream - Ceramides (40g)',
    description: 'Creme hidratante facial intensivo especialmente formulado para pele seca e sensível. Contém 5 tipos de ceramidas (ingredientes essenciais da barreira cutânea natural) que fortalecem a proteção natural da pele enquanto acalmam irritações e inflamações. A textura é leve e não pegajosa, absorvendo rapidamente sem deixar resíduos. Testado dermatologicamente para pele sensível. Livre de fragrância, álcool e aditivos irritantes. Recomendado por dermatologistas para rotina diária de manhã e noite. Efeitos visíveis em 2-3 dias de uso regular.',
    category: 'cosmeticos',
    prices: { small: 2530, large: 5800 },
    image: 'https://m.media-amazon.com/images/I/61d+FkWGBRL._AC_UY327_QL65_.jpg',
    gallery: [
      'https://m.media-amazon.com/images/I/61d+FkWGBRL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/41sZLXlk0AL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/51DqT3nNb7L._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/71qfDqHKpJL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/31zcM3yKV0L._AC_UY327_QL65_.jpg'
    ],
    flavor: 'Ceramide Rich'
  },
  {
    id: 'softymo-oil',
    name: 'Kose Softymo Speedy Cleansing Oil Premium (230ml)',
    description: 'Óleo removedor de maquiagem ultra-rápido e eficiente da marca Kose, lider em cuidados com pele no Japão. Remove toda maquiagem pesada (incluindo eyeliner à prova d\'água) em apenas 30 segundos. O diferencial é que pode ser usado com as mãos e o rosto molhados durante o banho, economizando tempo na rotina. A fórmula é balanceada entre limpeza profunda e suavidade, deixando a pele macia e não ressecada. Aroma leve e agradável. Recomendado por makeup artists profissionais em Tóquio.',
    category: 'cosmeticos',
    prices: { small: 680, large: 1580 },
    image: 'https://m.media-amazon.com/images/I/71lKnRCNn7L._AC_UY327_QL65_.jpg',
    gallery: [
      'https://m.media-amazon.com/images/I/71lKnRCNn7L._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/41c8WZdB0vL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/51HXJc8YDBL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/61V9zT1JTwL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/31SAZ7MrKyL._AC_UY327_QL65_.jpg'
    ],
    flavor: 'Speedy Oil'
  },
  {
    id: 'anessa-sun',
    name: 'Shiseido Anessa Perfect UV Sunscreen Mild Milk (60ml)',
    description: 'Protetor solar premium ultra sensível formulado especialmente para bebês, crianças e peles muito sensíveis. A fórmula hipoalergênica foi desenvolvida por dermatologistas pediátricos de renome. Oferece proteção física UVA/UVB máxima (SPF50+ PA+++++) sem irritar. Resistente à água e ao suor, pode ser usada durante todo o dia, inclusive em esportes aquáticos. Não deixa resíduos brancos nem sensação pegajosa. Seguro para uso facial e corporal. Aprovado por pediatras e dermatologistas.',
    category: 'cosmeticos',
    prices: { small: 3280, large: 7600 },
    image: 'https://m.media-amazon.com/images/I/71xKvCFxXwL._AC_UY327_QL65_.jpg',
    gallery: [
      'https://m.media-amazon.com/images/I/71xKvCFxXwL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/51aQ0jZJC7L._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/41GH1tDwdIL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/61QW9yzjwKL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/31tqZNFX3JL._AC_UY327_QL65_.jpg'
    ],
    flavor: 'Mild Milk SPF50+'
  },

  // ==========================================
  // DOCES & CHÁS (10 produtos)
  // ==========================================
  {
    id: 'kitkat-matcha',
    name: 'Nestlé KitKat Matcha Green Tea Premium (12 mini)',
    description: 'O famoso wafer crocante em chocolate coberto com matcha premium de Uji, Kyoto - a região mais renomada para cultivo de chá verde no Japão. Esta edição especial combina o contraste perfeito entre o amargor sutil e delicado do matcha autêntico com a doçura cremosa do chocolate branco. Cada wafer é feito com técnica artesanal para garantir o equilíbrio perfeito de sabores. É o souvenir mais procurado no Japão e viciante para os amantes de matcha. Embalagem premium em caixa coletora.',
    category: 'doces',
    prices: { small: 398, large: 820 },
    image: 'https://m.media-amazon.com/images/I/71kFqV0sZUL._AC_UY327_QL65_.jpg',
    gallery: [
      'https://m.media-amazon.com/images/I/71kFqV0sZUL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/51NM8OJ9lKL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/41K3ZrGvHUL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/61qTvLZM1pL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/31A3T4nKlyL._AC_UY327_QL65_.jpg'
    ],
    flavor: 'Kyoto Matcha'
  },
  {
    id: 'sencha-tea',
    name: 'Chá Verde Japonês Sencha Premium de Uji (100g - Folhas Soltas)',
    description: 'Folhas soltas de chá verde Sencha de colheita primeira (shincha) selecionada na região de Uji, Kyoto. Cultivado em plantações sombreadas que intensificam o sabor umami (savoroso) e preservam a cor verde esmeralda brilhante. Cada folha é colhida à mão durante o período de pico de qualidade. Aroma herbal complexo e refrescante com notas florais suaves. Sabor levemente adocicado sem necessidade de açúcar. Rico em antioxidantes (catequinas) e L-teanina. Deve ser preparado com água entre 70-80°C para extrair o melhor aroma e sabor. Resultado de gerações de mestres do chá.',
    category: 'doces',
    prices: { small: 1080, large: 2500 },
    image: 'https://m.media-amazon.com/images/I/71P6B0JqMDL._AC_UY327_QL65_.jpg',
    gallery: [
      'https://m.media-amazon.com/images/I/71P6B0JqMDL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/51n7LPcKy2L._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/41wMH+KZUxL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/61JnZnHGcML._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/31X5r3nKy0L._AC_UY327_QL65_.jpg'
    ],
    flavor: 'Sencha Orgânico'
  },
  {
    id: 'pocky-chocolate',
    name: 'Glico Pocky Chocolate Stick Box Premium (2 pacotes)',
    description: 'Os biscoitos em formato de palito assados e crocantes mais famosos e amados do mundo, originários do Japão. Cada palito é revestido uniformemente com uma camada de chocolate ao leite premium, criando o equilíbrio perfeito entre a textura crocante do biscoito e a suavidade do chocolate. A caixa contém 2 pacotes individuais, perfeita para compartilhar com amigos ou manter um estoque. Criado em 1966 e desde então conquistou fãs em mais de 80 países. Ingredientes de qualidade premium, sem conservantes artificiais.',
    category: 'doces',
    prices: { small: 178, large: 380 },
    image: 'https://m.media-amazon.com/images/I/71fvPvVJlZL._AC_UY327_QL65_.jpg',
    gallery: [
      'https://m.media-amazon.com/images/I/71fvPvVJlZL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/51GYVxL7PpL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/41Y8TrZlhTL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/61ukJcPWNwL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/31KZjh9bqbL._AC_UY327_QL65_.jpg'
    ],
    flavor: 'Pocky Chocolate'
  },
  {
    id: 'jagariko-calbee',
    name: 'Calbee Jagariko Potato Sticks Salad Flavor (60g)',
    description: 'Snack crocante de batata frita em formato de palitos assados da marca Calbee. Sabor clássico de salada com tempero de cenoura e salsa desidratadas que dão um gostinho fresco e herbal. A textura é estaladiça e viciante, mantendo a crocância mesmo depois de aberto. Feito com batatas selecionadas de alta qualidade e frito em óleo premium. Muito popular no Japão e na Ásia como snack no intervalo ou durante estudos. Embalagem reutilizável que mantém o snack fresco por mais tempo.',
    category: 'doces',
    prices: { small: 148, large: 320 },
    image: 'https://m.media-amazon.com/images/I/71k8c7vn4XL._AC_UY327_QL65_.jpg',
    gallery: [
      'https://m.media-amazon.com/images/I/71k8c7vn4XL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/51JhZ3ek6gL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/41nXvKgKDgL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/61KZFT8hZEL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/31qJ7RZvyUL._AC_UY327_QL65_.jpg'
    ],
    flavor: 'Jagariko Salada'
  },
  {
    id: 'takenoko-meiji',
    name: 'Meiji Takenoko no Sato Chocolate Snacks Premium (70g)',
    description: 'Tradicional biscoito japonês em formato de broto de bambu (takenoko), criado há mais de 50 anos. Possui uma base de biscoito amanteigado extremamente crocante e macio, coberta com duas camadas harmonizadas de chocolate ao leite e chocolate meio amargo. O formato único em cone facilita a refeição sem sujar os dedos. A combinação de sabores é icônica no Japão - o contraste do biscoito amanteigado com os dois tipos de chocolate cria uma experiência gustativa única. Competidor tradicional do Pocky no mercado japonês.',
    category: 'doces',
    prices: { small: 218, large: 480 },
    image: 'https://m.media-amazon.com/images/I/71UjL8lPfqL._AC_UY327_QL65_.jpg',
    gallery: [
      'https://m.media-amazon.com/images/I/71UjL8lPfqL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/51rAKRfTWpL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/41TPNL8RmlL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/61X0p+F2nzL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/31EWVP+P3mL._AC_UY327_QL65_.jpg'
    ],
    flavor: 'Broto de Bambu'
  },
  {
    id: 'konjac-jelly',
    name: 'Orihiro Konjac Jelly Squeeze Mix Assorted (12 unidades)',
    description: 'Gelatinas saudáveis feitas de konjac (planta tradicional do Japão), embaladas em sachês individuais de apertar. Variedade de sabores (pêssego e uva) oferece versatilidade gustativa. Cada sachê contém apenas 25 calorias, sendo perfeito para dietas e lanches saudáveis. O konjac é rico em fibras solúveis (glucomanana) que auxiliam na digestão e saciedade prolongada. Livre de glúten, lactose e zero açúcar adicionado (adoçado com sorbitol). Textura gelatinosa macia que é agradável de comer. Recomendado por nutricionistas como alternativa saudável a sobremesas açucaradas.',
    category: 'doces',
    prices: { small: 320, large: 750 },
    image: 'https://m.media-amazon.com/images/I/71kK3ql3n4L._AC_UY327_QL65_.jpg',
    gallery: [
      'https://m.media-amazon.com/images/I/71kK3ql3n4L._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/51w8jLPQKTL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/41rVZcn7rnL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/61qRXvWZVVL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/31SVWK8XVUL._AC_UY327_QL65_.jpg'
    ],
    flavor: 'Pêssego & Uva'
  },
  {
    id: 'matcha-powder',
    name: 'Uji Matcha Chá Verde em Pó Ceremonial Grade A (30g)',
    description: 'Pó de chá verde integral premium moído em moinhos de pedra tradicionais da região de Uji, Kyoto. A qualidade Ceremonial Grade A é a mais alta classificação de matcha, colhida apenas uma vez ao ano no período de maior qualidade. A cor verde esmeralda brilhante e o sabor umami profundo são inconfundíveis. Pode ser preparado em cerimônia de chá tradicional (whisk de bambu) ou adicionado a lattes, smoothies e sobremesas. Uma colher de chá oferece todo o benefício antioxidante do chá verde concentrado. Produção artesanal por mestres do chá com experiência de gerações.',
    category: 'doces',
    prices: { small: 1780, large: 4100 },
    image: 'https://m.media-amazon.com/images/I/71M5VyRBbxL._AC_UY327_QL65_.jpg',
    gallery: [
      'https://m.media-amazon.com/images/I/71M5VyRBbxL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/51HYOV9ZOTL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/41T2wDyU5lL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/61T7ZhXXhnL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/31w8tYDRb2L._AC_UY327_QL65_.jpg'
    ],
    flavor: 'Ceremonial Matcha'
  },
  {
    id: 'hichew-candy',
    name: 'Morinaga Hi-Chew Fruit Candy Assorted (86g)',
    description: 'Balas mastigáveis japonesas com textura única e inconfundível da marca Morinaga. O saco sortido contém os sabores icônicos de Uva roxa, Maçã verde e Morango feito com suco de fruta real. A textura elástica e macia oferece uma experiência de mastigação satisfatória e prolongada. Cada bala oferece explosão de sabor natural de frutas. Sem ingredientes artificiais ou conservantes nocivos. Embalagem individual que facilita compartilhamento. Muito popular entre crianças e adultos no Japão, Hi-Chew é considerado a bala de frutas superior à concorrência.',
    category: 'doces',
    prices: { small: 228, large: 520 },
    image: 'https://m.media-amazon.com/images/I/71EJN-JqUXL._AC_UY327_QL65_.jpg',
    gallery: [
      'https://m.media-amazon.com/images/I/71EJN-JqUXL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/51XB8h2rFkL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/41mJpJvXLML._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/61rKwPvPaML._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/31n3XHKZ6eL._AC_UY327_QL65_.jpg'
    ],
    flavor: 'Hi-Chew Sortido'
  },
  {
    id: 'kakijack',
    name: 'Kameda Seika Kaki no Tane Rice Crackers Premium (6 pacotes)',
    description: 'Snack japonês tradicional que mistura biscoitos de arroz crocantes em formato de semente de caqui com amendoins selecionados, tudo temperado com tempero de alga nori (em variações de sabor). O nome "Kaki no Tane" significa literalmente "sementes de caqui" em referência ao formato único. A combinação do arroz crocante com o amendoim macio oferece contraste de texturas perfeito. Muito popular para aperitivo, especialmente acompanhado de cerveja ou saquê. Produção artesanal desde 1956, cada pacote é selado individualmente para manter a crocância.',
    category: 'doces',
    prices: { small: 298, large: 680 },
    image: 'https://m.media-amazon.com/images/I/71pqG3yTc4L._AC_UY327_QL65_.jpg',
    gallery: [
      'https://m.media-amazon.com/images/I/71pqG3yTc4L._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/51bXz6rZr1L._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/41KGJqQNcGL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/61t4P0DqFmL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/31B8z0EK1pL._AC_UY327_QL65_.jpg'
    ],
    flavor: 'Kaki no Tane'
  },
  {
    id: 'royce-matcha',
    name: 'Royce\' Nama Chocolate Matcha Premium (20 pedaços)',
    description: 'Famoso chocolate fresco ("nama" = fresco em japonês) da marca de luxo Royce\', feito com chocolate branco blendado com matcha premium de Uji e creme de leite fresco de Hokkaido. Cada pedaço tem textura incrivelmente aveludada que derrete na boca, oferecendo experiência gustativa indulgente. O matcha adiciona amargor sutil que equilibra a doçura do chocolate branco e a riqueza do creme. Deve ser mantido refrigerado. Embalagem premium em caixa coletora de luxo. Uma das marcas mais respeitadas de chocolate do Japão, Royce\' é presente preferido de executivos e viajantes.',
    category: 'doces',
    prices: { small: 864, large: 1980 },
    image: 'https://m.media-amazon.com/images/I/71jZqGVHc3L._AC_UY327_QL65_.jpg',
    gallery: [
      'https://m.media-amazon.com/images/I/71jZqGVHc3L._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/51uKx0DvqcL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/41Z1HJ6KP5L._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/61DzKt8wDQL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/31Zf7XqEhuL._AC_UY327_QL65_.jpg'
    ],
    flavor: 'Nama Trufa Matcha'
  },

  // ==========================================
  // ACESSÓRIOS (10 produtos)
  // ==========================================
  {
    id: 'luffy-figure',
    name: 'Bandai One Piece Luffy Gear 5 Action Figure Oficial (16cm)',
    description: 'Estatueta colecionável oficial da Bandai Ichibansho que retrata a icônica transformação Gear 5 (Deus do Sol Nika) de Monkey D. Luffy, o protagonista de One Piece. A figura captura perfeitamente o momento épico com cabelos brancos flutuantes texturizados, expressão de determinação intensa e pose dinâmica. Acabamento em PVC reforçado com pintura detalhada hand-painted que não desbota. Articulações móveis nas principais junções. Embalagem de luxo adequada para presente ou coleção. Altura de 16cm oferece tamanho perfeito para display em prateleira. Feito no Japão com qualidade premium.',
    category: 'acessorios',
    prices: { small: 4800, large: 4800 },
    image: 'https://m.media-amazon.com/images/I/71U+PrCfqJL._AC_UY327_QL65_.jpg',
    gallery: [
      'https://m.media-amazon.com/images/I/71U+PrCfqJL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/51VZ8KMqswL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/41lQV8IlqyL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/61Yf8HlqBwL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/31K2z6YB3nL._AC_UY327_QL65_.jpg'
    ],
    flavor: 'Luffy Gear 5'
  },
  {
    id: 'kirby-plush',
    name: 'Sanrio Kirby Plush Keychain Doll Ultra Fofo (12cm)',
    description: 'Boneco de pelúcia ultra fofo do Kirby, a icônica bola rosa do Nintendo. Importado diretamente da Sanrio no Japão. Segura uma estrela amarela brilhante que é a marca registrada de Kirby. Confeccionado em pelúcia premium macia e agradável ao toque, resistente ao uso frequente. Acompanha corrente metálica durável e segura para pendurar em mochilas, bolsas, estojos escolares ou chaveiros de porta. Tamanho compacto (12cm) ideal para transportação. Perfeito para fãs de Kirby de todas as idades, jovens ou adultos. Embalagem original Sanrio.',
    category: 'acessorios',
    prices: { small: 1200, large: 1200 },
    image: 'https://m.media-amazon.com/images/I/71VfG-0+0eL._AC_UY327_QL65_.jpg',
    gallery: [
      'https://m.media-amazon.com/images/I/71VfG-0+0eL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/51OZ3f-vhgL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/41T5bQOzSqL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/61d5KZ6AGOL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/31WBaYUVGeL._AC_UY327_QL65_.jpg'
    ],
    flavor: 'Kirby Estrela'
  },
  {
    id: 'muji-organizer',
    name: 'Muji Acrylic Makeup Organizer Modular (3 gavetas)',
    description: 'Organizador modular minimalista fabricado em acrílico cristalino de alta transparência óptica e resistência mecânica da famosa marca de design minimalista japonesa Muji. A estrutura com 3 gavetas independentes oferece versatilidade - pode ser empilhado com outros módulos para expandir a capacidade. Ideal para organização de maquiagem, cosméticos, joias, botões, parafusos ou qualquer item pequeno. Design elegante que combina com qualquer decoração. Cantos e bordas polidas para segurança. Deslizamento suave das gavetas. Tamanho compacto mas funcional.',
    category: 'acessorios',
    prices: { small: 2400, large: 2400 },
    image: 'https://m.media-amazon.com/images/I/71C3aVYV7eL._AC_UY327_QL65_.jpg',
    gallery: [
      'https://m.media-amazon.com/images/I/71C3aVYV7eL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/51tMJ0vKhSL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/41YMxLoW6nL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/61wh-A3H9wL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/31O5gLTr9BL._AC_UY327_QL65_.jpg'
    ],
    flavor: 'Organizador Acrílico'
  },
  {
    id: 'tiger-bottle',
    name: 'Tiger Vacuum Insulated Water Bottle Ultra Leve (480ml)',
    description: 'Garrafa térmica de viagem ultra leve e compacta da marca premium Tiger, lider em produtos térmicos no Japão por 60+ anos. A tecnologia de parede dupla de aço inoxidável a vácuo mantém bebidas geladas por 15+ horas ou quentes por 12+ horas. Peso reduzido (apenas 250g) facilita o transporte em mochilas e bolsas. Revestimento interno antiaderente evita manchas e facilita limpeza. Vedação hermética impede vazamentos mesmo inclinada. Desempenho testado em condições extremas. Design minimalista e acabamento mate sofisticado. Garantia de 5 anos contra defeitos de fabricação.',
    category: 'acessorios',
    prices: { small: 2800, large: 2800 },
    image: 'https://m.media-amazon.com/images/I/71HKmKJL9BL._AC_UY327_QL65_.jpg',
    gallery: [
      'https://m.media-amazon.com/images/I/71HKmKJL9BL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/51Qvz0eIYqL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/41U9QqNbzNL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/61sV3M5OzVL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/31NKzH8VDRL._AC_UY327_QL65_.jpg'
    ],
    flavor: 'Tiger Preta'
  },
  {
    id: 'nerv-totebag',
    name: 'Evangelion NERV Cotton Canvas Tote Bag Oficial (50x40cm)',
    description: 'Bolsa sacola ecológica e durável feita de lona de algodão puro de alta gramatura (14oz), com a clássica marca NERV (organização militar fictícia) em estampa nítida e duradoura da franquia de anime clássico Neon Genesis Evangelion. Alças resistentes de 60cm permitem carregar confortavelmente na mão ou ombro. Estrutura rígida mantém a forma mesmo com peso. Eco-friendly e biodegradável. Perfeita como bolsa de compras, para ir à escola ou trabalho, ou como item colecionável para fãs de Evangelion. Embalagem de presente inclusa.',
    category: 'acessorios',
    prices: { small: 1800, large: 1800 },
    image: 'https://m.media-amazon.com/images/I/71XqvF3NQQL._AC_UY327_QL65_.jpg',
    gallery: [
      'https://m.media-amazon.com/images/I/71XqvF3NQQL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/51bKZj-JDNL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/41WrCnJ8zaL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/61n-nHq9A0L._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/31QZ5mzX8WL._AC_UY327_QL65_.jpg'
    ],
    flavor: 'Tote Bag NERV'
  },
  {
    id: 'demon-slayer-pad',
    name: 'Demon Slayer Tanjiro Extended Mousepad Gamer (80x30cm)',
    description: 'Mousepad gamer profissional estendido especialmente projetado para gamers e usuários de computador que desejam espaço amplo para movimento rápido de mouse e teclado. Dimensões generosas (80x30cm) cobrem a área inteira do teclado. Base de borracha natural antiderrapante garante estabilidade mesmo durante movimentos rápidos e agressivos. Costura reforçada nas bordas previne desfio e aumenta durabilidade. Estampa vibrante em alta resolução de Tanjiro Kamado, protagonista de Demon Slayer, em pose épica usando a Respiração da Água. Tinta resistente à água não borra com suor. Lavável em água morna.',
    category: 'acessorios',
    prices: { small: 1500, large: 1500 },
    image: 'https://m.media-amazon.com/images/I/71vAzCq1vgL._AC_UY327_QL65_.jpg',
    gallery: [
      'https://m.media-amazon.com/images/I/71vAzCq1vgL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/51KZfZ3Ue7L._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/41pGMqJPR4L._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/61l0pRxT0wL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/31x8M3yJ7YL._AC_UY327_QL65_.jpg'
    ],
    flavor: 'Demon Slayer Pad'
  },
  {
    id: 'naruto-nendo',
    name: 'Nendoroid Naruto Uzumaki #682 Action Figure Premium',
    description: 'Figura colecionável oficial Good Smile Company Nendoroid #682 de Naruto Uzumaki, o protagonista do anime/manga Naruto. Nendoroids são famosas por seu design chibi fofo mas detalhado. Este modelo acompanha três rostos intercambiáveis (feliz, sério, choro) que permitem recriar diferentes expressões e cenas do anime. Peças destacáveis para recriar o golpe Rasengan (esfera de energia giratória) que é o técnica de assinatura de Naruto. Articulações móveis nas principais junções. Altura aproximada de 10cm. Embalagem de luxo original Good Smile Company. Item essencial para colecionadores de Naruto e Nendoroids.',
    category: 'acessorios',
    prices: { small: 5500, large: 5500 },
    image: 'https://m.media-amazon.com/images/I/71yDSRrEUqL._AC_UY327_QL65_.jpg',
    gallery: [
      'https://m.media-amazon.com/images/I/71yDSRrEUqL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/51qBN+kBZVL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/41LbpY1+GlL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/61X5E-N9eRL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/31mKp1yHKuL._AC_UY327_QL65_.jpg'
    ],
    flavor: 'Nendoroid Naruto'
  },
  {
    id: 'divoom-speaker',
    name: 'Divoom Ditoo Retro Speaker & Pixel Art (Verde Jade)',
    description: 'Caixa de som Bluetooth retrô inovadora com personalidade própria. Possui teclado mecânico funcional integrado que permite programar e exibir arte pixel personalizada. A tela inteligente de 16x16 LEDs RGB é programável via app mobile e permite criar animações, exibir padrões geométricos ou mensagens de boas-vindas personalizadas. Qualidade de som Bluetooth estéreo surpreendentemente boa para o tamanho compacto. Bateria integrada oferece até 8 horas de reprodução contínua. Cor verde jade vintage agrada estéticamente em qualquer espaço. Perfeito para gamers retro, artistas pixel e nostálgicos dos anos 80/90.',
    category: 'acessorios',
    prices: { small: 9800, large: 9800 },
    image: 'https://m.media-amazon.com/images/I/71GF8qNR3gL._AC_UY327_QL65_.jpg',
    gallery: [
      'https://m.media-amazon.com/images/I/71GF8qNR3gL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/51jZN7jVBpL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/41qZ8svjc0L._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/61K8G0P8jqL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/31x8N3vBjkL._AC_UY327_QL65_.jpg'
    ],
    flavor: 'Ditoo Verde'
  },
  {
    id: 'zojirushi-mug',
    name: 'Zojirushi Stainless Steel Travel Mug Premium (480ml)',
    description: 'Copo térmico de viagem inoxidável premium da Zojirushi, marca lider em produtos térmicos no Japão. Parede dupla de aço inoxidável mantém bebidas quentes/frias por horas. Revestimento antiaderente interno evita manchas e facilita limpeza. Tampa com trava de segurança integrada garante que não vaze mesmo em mochilas ou bolsas inclinadas. Isolamento a vácuo superior mantém bebidas na temperatura ideal. Leve e compacto (480ml) ideal para viajantes, estudantes e profissionais. Design elegante em cores neutras que combina com qualquer estilo. Garantia de 3 anos.',
    category: 'acessorios',
    prices: { small: 3200, large: 3200 },
    image: 'https://m.media-amazon.com/images/I/71WdM9TQLOL._AC_UY327_QL65_.jpg',
    gallery: [
      'https://m.media-amazon.com/images/I/71WdM9TQLOL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/51kEZPzPY3L._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/41Z3x+SMJKL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/61J2yW5bZqL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/31T7Z3hK9VL._AC_UY327_QL65_.jpg'
    ],
    flavor: 'Copo Zojirushi'
  },
  {
    id: 'moon-cushion',
    name: 'Sailor Moon Luna Black Cat Plush Cushion Deluxe (40x30cm)',
    description: 'Almofada de pelúcia ultra macia e aconchegante da gata Luna, mascote iconic da série de anime clássico Sailor Moon. Luna é adorada por fãs por sua personalidade doce e suas orelhinhas pontiagudas características. A almofada é confeccionada em pelúcia premium macia ao toque, resistente a centenas de lavadinhas. A clássica marca de lua crescente é bordada com linha dourada na testa. Dimensão generosa (40x30cm) oferece conforto ao abraçar ou repousar a cabeça. Ideal para decoração de quarto, escritório ou sala de estar geek. Perfeito para fãs de Sailor Moon de todas as idades.',
    category: 'acessorios',
    prices: { small: 2000, large: 2000 },
    image: 'https://m.media-amazon.com/images/I/71XJ8Y4h2-L._AC_UY327_QL65_.jpg',
    gallery: [
      'https://m.media-amazon.com/images/I/71XJ8Y4h2-L._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/51Z8SyYM6YL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/41K5m8cN7GL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/61M9nK5V4QL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/31TnV6B3loL._AC_UY327_QL65_.jpg'
    ],
    flavor: 'Almofada Luna'
  },

  // ==========================================
  // PAPELARIA (10 produtos)
  // ==========================================
  {
    id: 'sakura-pens',
    name: 'Sakura Gelly Roll Metallic Gel Pens Premium (10 pack)',
    description: 'Conjunto de 10 canetas em gel Sakura Gelly Roll originais e genuínas fabricadas no Japão. A tinta em gel de pigmento oferece fluxo constante e suave, proporcionando escrita fluida e precisa. A tinta é resistente à água e ao desbotamento, mantendo a cor vibrante por anos. O acabamento brilhante das cores metalizadas (ouro, prata, rosa, verde etc) torna cada traço especial. Ideal para artistas, ilustradores, calígrafos e amantes de papelaria. As cores variadas permite projetos criativos. Embalagem de apresentação adequada para presente.',
    category: 'papelaria',
    prices: { small: 1200, large: 2700 },
    image: 'https://m.media-amazon.com/images/I/71G9r2L5gvL._AC_UY327_QL65_.jpg',
    gallery: [
      'https://m.media-amazon.com/images/I/71G9r2L5gvL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/51nN3K8FUWL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/41qT7KdNbBL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/61K7NVp6T1L._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/31E5Z8hcJHL._AC_UY327_QL65_.jpg'
    ],
    flavor: 'Gelly Roll 10 Cores'
  },
  {
    id: 'kokuyo-notebooks',
    name: 'Kokuyo Campus Notebooks Premium B5 (5 pack)',
    description: 'Os famosos cadernos Kokuyo Campus B5 com linhas pontilhadas (dot-ruled). Encadernação colada durável resiste a anos de uso intenso. Folhas de papel acetinado de alta gramatura e bom peso oferecem excelente receptividade para canetas tinteiro, sem sangramento de tinta ou enrugamento. O design de pontos em vez de linhas contínuas oferece flexibilidade para escrever em qualquer direção ou criar diagramas. Muito usado por escritores, designers e estudantes no Japão. Pack contém 5 cadernos variados de cores. Papel premium feito no Japão.',
    category: 'papelaria',
    prices: { small: 600, large: 1350 },
    image: 'https://m.media-amazon.com/images/I/71CJZqBTBbL._AC_UY327_QL65_.jpg',
    gallery: [
      'https://m.media-amazon.com/images/I/71CJZqBTBbL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/51T7BVIqMmL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/41mcKHsDR4L._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/61K2NdX3pXL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/31z9V4KcKzL._AC_UY327_QL65_.jpg'
    ],
    flavor: 'Campus B5 Set'
  },
  {
    id: 'tombow-eraser',
    name: 'Tombow Mono Zero Precision Eraser Ultra Fino (2.3mm)',
    description: 'Caneta-borracha retrátil de precisão cirúrgica da marca Tombow. A borracha ultrafina de apenas 2.3mm de diâmetro permite apagar detalhes milimétricos em desenhos técnicos, esboços artísticos, manuscritos preciosos e caligrafia sem danificar o papel. Sistema retrátil mantém a borracha protegida quando não em uso. Textura macia e aderente remove grafite completamente sem raspar o papel. Ideal para arquitetos, engenheiros, ilustradores e profissionais que trabalham com detalhes. Capa de transporte inclusa.',
    category: 'papelaria',
    prices: { small: 350, large: 800 },
    image: 'https://m.media-amazon.com/images/I/71F0TLI0WYL._AC_UY327_QL65_.jpg',
    gallery: [
      'https://m.media-amazon.com/images/I/71F0TLI0WYL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/51WC8jKKTGL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/41K7Y3xXP5L._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/61E9gH5V8OL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/31N5Z8V2KsL._AC_UY327_QL65_.jpg'
    ],
    flavor: 'Mono Zero'
  },
  {
    id: 'washi-tape',
    name: 'Washi Tape Floral Cerejeira Sakura Set Deluxe (4 rolls)',
    description: 'Fitas adesivas decorativas de papel washi tradicional japonês com padrões florais de pétalas de cerejeira e detalhes em ouro. Washi é papel artesanal feito a partir de fibras de plantas japonesas, oferecendo textura natural e beleza única. Ideal para scrapbooking, decoração de bujos (bullet journals), embrulho de presentes artesanal, reparação decorativa de objetos antigos, e qualquer projeto criativo. Cola suave e reposicionável não danifica papel ou superfícies delicadas. Pack contém 4 rolls de cores/padrões variados. Embalagem de presente inclusa.',
    category: 'papelaria',
    prices: { small: 450, large: 1050 },
    image: 'https://m.media-amazon.com/images/I/71LdX3sZLQL._AC_UY327_QL65_.jpg',
    gallery: [
      'https://m.media-amazon.com/images/I/71LdX3sZLQL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/51U2vXpKi9L._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/41K8N1mV7iL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/61L7NV9W5ZL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/31Q2Z8h7K4L._AC_UY327_QL65_.jpg'
    ],
    flavor: 'Washi Tape Sakura'
  },
  {
    id: 'lihit-case',
    name: 'Lihit Lab Smart Fit Double Pen Case Premium',
    description: 'Estojo organizador de canetas e pincéis premium de lona de nylon impermeável resistente. Design japonês inteligente apresenta dois bolsos independentes que permitem separar canetas por tipo ou cor. Divisórias internas elásticas mantém cada caneta em seu lugar, prevenindo danos e evitando embaralho. Material impermeável protege conteúdo de chuva ou respingos. Zíper de qualidade garante fechamento seguro. Dimensões generosas acomodam até 50 canetas. Ideal para artistas, ilustradores, estudantes e profissionais que trabalham com múltiplos instrumenots de escrita. Cores coordenadas sofisticadas.',
    category: 'papelaria',
    prices: { small: 1400, large: 3200 },
    image: 'https://m.media-amazon.com/images/I/71HpT4p0IdL._AC_UY327_QL65_.jpg',
    gallery: [
      'https://m.media-amazon.com/images/I/71HpT4p0IdL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/51X7NZ7ZkQL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/41K9N1p8R2L._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/61M8pW6V7zL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/31T6Z9jL4kL._AC_UY327_QL65_.jpg'
    ],
    flavor: 'Estojo Lihit Navy'
  },
  {
    id: 'pilot-kakuno',
    name: 'Pilot Kakuno Fountain Pen Deluxe (Fine Nib - 0.3mm)',
    description: 'Caneta tinteiro (fountain pen) Pilot Kakuno importada diretamente do Japão. Design inovador e acessível que introduz iniciantes ao mundo de canetas tinteiro. Corpo triangular ergonômico oferece conforto natural de preensão, reduzindo fadiga em escrita prolongada. Tampa sextavada oferece segurança contra rolamento e é distintiva de Kakuno. Ponta de aço fino (0.3mm) oferece traço preciso e fino ideal para manuscritos delicados. Compatível com cartuchos padrão de tinta. Especialmente popular entre estudantes de caligrafia, roteiristas e amantes de papelaria. Vem com cartucho de tinta azul.',
    category: 'papelaria',
    prices: { small: 1100, large: 2500 },
    image: 'https://m.media-amazon.com/images/I/71qvGnU5gKL._AC_UY327_QL65_.jpg',
    gallery: [
      'https://m.media-amazon.com/images/I/71qvGnU5gKL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/51K2N8xY3WL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/41L9N5p7Z3L._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/61N7NV8W4bL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/31T8Z7h6KvL._AC_UY327_QL65_.jpg'
    ],
    flavor: 'Kakuno Fina'
  },
  {
    id: 'tombow-pencil',
    name: 'Tombow Mono Graph Shaker Mechanical Pencil (0.5mm)',
    description: 'Lapiseira profissional 0.5mm da marca Tombow com mecanismo Shaker revolucionário. Ao agitar a lapiseira verticalmente, o mecanismo interno automáticamente avança a grafite quando necessário, eliminando o clique repetitivo tradicional. Oferece uma escrita mais fluida e natural. Possui clip de segurança trava que evita avanço acidental da grafite. Borracha Mono giratória embutida no topo permite correção conveniente sem tirar a lapiseira. Corpo metálico durável e minimalista. Ideal para escritores, designers, estudantes que escrevem constantemente. Compatível com grafites padrão 0.5mm.',
    category: 'papelaria',
    prices: { small: 380, large: 880 },
    image: 'https://m.media-amazon.com/images/I/71U0N3vXjKL._AC_UY327_QL65_.jpg',
    gallery: [
      'https://m.media-amazon.com/images/I/71U0N3vXjKL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/51M1N7x8LzL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/41L8N4p6K2L._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/61N6NV7V3aL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/31T9Z8iL5uL._AC_UY327_QL65_.jpg'
    ],
    flavor: 'Mono Graph 0.5'
  },
  {
    id: 'midori-notebook',
    name: 'Midori Traveler\'s Notebook Passport Size Refill',
    description: 'Caderno de recarga tamanho passaporte (10 x 13.5cm) para o sistema modular Traveler\'s Notebook de Midori. Papel MD premium de alta qualidade fabricado especialmente para Midori, liso e adequado para escrita fluida com caneta tinteiro, grafite ou caneta gel sem sangramento excessivo. Cada folha é numerada e datada para organização cronológica. Oferece 64 páginas de espaço para notas, desenhos, colagens e lembretes. Encadernação em caderno tradicional. Ideal como diário de viagem, sketchbook portátil ou caderno executivo compacto. Capa de couro genuíno recomendada (vendida separadamente).',
    category: 'papelaria',
    prices: { small: 660, large: 1520 },
    image: 'https://m.media-amazon.com/images/I/71AO8E6yMaL._AC_UY327_QL65_.jpg',
    gallery: [
      'https://m.media-amazon.com/images/I/71AO8E6yMaL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/51N2N8y9MyL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/41M9N5q7L3L._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/61N7NV9W6bL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/31T8Z7j8LvL._AC_UY327_QL65_.jpg'
    ],
    flavor: 'Refill Quadriculado'
  },
  {
    id: 'pentel-pens',
    name: 'Pentel Sign Pen Fibre-Tip Marker Professional (12 colors)',
    description: 'Conjunto de 12 marcadores de ponta acrílica resistente Pentel originais e genuínos, a famosa caneta de assinatura clássica do Japão. A ponta em fibra acrílica oferece controle superior de linha, ideal para caligrafia, desenho técnico, e assinatura profissional. A tinta é à base de água com fluxo suave e consistente. Cores vibrantes e não tóxicas. Resistente ao desbotamento quando exposto a luz UV moderada. Muito usada por profissionais em Tóquio para assinatura executiva. As 12 cores permitem projetos artísticos variados. Embalagem apresentável.',
    category: 'papelaria',
    prices: { small: 1320, large: 3050 },
    image: 'https://m.media-amazon.com/images/I/71eV9dZE+LL._AC_UY327_QL65_.jpg',
    gallery: [
      'https://m.media-amazon.com/images/I/71eV9dZE+LL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/51O3N9z0PyL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/41N0N6r8M4L._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/61O8OW0X7cL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/31U9Z9kL6wL._AC_UY327_QL65_.jpg'
    ],
    flavor: 'Pentel Sign Set'
  },
  {
    id: 'signo-dx',
    name: 'Uni-ball Signo DX Gel Pen Set Deluxe (8 colors - 0.38mm)',
    description: 'Estojo de canetas em gel Uni-ball Signo DX ponta ultrafina 0.38mm. Famosas pela tinta em gel pigmentada à prova de água e fluxo contínuo ultra preciso. Ideal para escrita miúda, anotações detalhadas, manuscritos legíveis em espaço reduzido. A tinta seca rapidamente prevenindo manchas. Cores variadas nas 8 canetas do set oferecem versatilidade para código de cores em notas e estudos. Capa retrátil lisa facilita preensão confortável. Muito usada por estudantes no Japão para anotações de aulas. Embalagem de presente inclusa.',
    category: 'papelaria',
    prices: { small: 1500, large: 3450 },
    image: 'https://m.media-amazon.com/images/I/71T2OzV3y+L._AC_UY327_QL65_.jpg',
    gallery: [
      'https://m.media-amazon.com/images/I/71T2OzV3y+L._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/51P4OAw1QxL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/41O1OBx2RyL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/61P9PV1Z8dL._AC_UY327_QL65_.jpg',
      'https://m.media-amazon.com/images/I/31V0Z0mL7xL._AC_UY327_QL65_.jpg'
    ],
    flavor: 'Signo 0.38 Set'
  }
];
