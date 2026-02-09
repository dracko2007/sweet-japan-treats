export type Language = 'pt' | 'en' | 'ja';

export const translations: Record<Language, Record<string, string>> = {
  pt: {
    // Navigation
    'nav.products': 'Produtos',
    'nav.products.all': 'Todos os Produtos',
    'nav.products.artesanal': 'Artesanal',
    'nav.products.premium': 'Premium',
    'nav.vlog': 'Vlog',
    'nav.shipping': 'Frete',
    'nav.about': 'Quem Somos',
    'nav.register': 'Cadastro',
    'nav.profile': 'Perfil',
    'nav.favorites': 'Favoritos',
    'nav.cart': 'Carrinho',
    'nav.admin': '🔐 Painel Admin',

    // Hero Section
    'hero.badge': 'Feito artesanalmente no Japão',
    'hero.title.1': 'O verdadeiro sabor do',
    'hero.title.highlight': 'doce de leite',
    'hero.title.2': 'brasileiro',
    'hero.description': 'Produzido com ingredientes selecionados e técnicas tradicionais, nosso doce de leite traz toda a cremosidade e sabor que você conhece e ama, direto de Mie para todo o Japão.',
    'hero.cta.products': 'Ver Produtos',
    'hero.cta.story': 'Nossa História',
    'hero.stat.artesanal': 'Artesanal',
    'hero.stat.flavors': 'Sabores',
    'hero.stat.provinces': 'Províncias',
    'hero.badge.recipe': 'Receita Brasileira',
    'hero.badge.tradition': 'Tradição desde sempre',

    // Featured Products
    'featured.badge': 'Nossos Produtos',
    'featured.title': 'Descubra nossos sabores',
    'featured.description': 'Cada pote é preparado com carinho, seguindo receitas tradicionais brasileiras adaptadas com ingredientes locais japoneses de alta qualidade.',
    'featured.from': 'A partir de',
    'featured.viewAll': 'Ver todos os produtos',

    // Video Gallery
    'videos.badge': 'Nossos Vídeos',
    'videos.title': 'Veja como é feito',
    'videos.description': 'Acompanhe o processo artesanal de produção do nosso doce de leite, desde a seleção dos ingredientes até o resultado final.',

    // About Section
    'about.badge': 'Nossa História',
    'about.title': 'Do Brasil para o Japão, com amor',
    'about.p1': 'Nascemos da saudade do sabor brasileiro. Em Mie, no coração do Japão, criamos um doce de leite que une o melhor das duas culturas: a tradição brasileira e a excelência japonesa.',
    'about.p2': 'Cada pote é preparado artesanalmente, com ingredientes cuidadosamente selecionados e muito carinho. Nosso objetivo é levar esse pedacinho do Brasil para a sua mesa, onde quer que você esteja no Japão.',
    'about.founded': 'Fundação',
    'about.customers': 'Clientes',
    'about.rating': 'Avaliação',

    // Shipping Banner
    'shipping.title': 'Enviamos para todo o Japão',
    'shipping.subtitle': 'Entrega rápida e segura via Japan Post, Yamato e Sagawa',

    // Product Details
    'product.category.artesanal': 'Artesanal',
    'product.category.premium': '★ Premium',
    'product.size.small': '280g',
    'product.size.large': '800g',
    'product.addToCart': 'Adicionar ao Carrinho',
    'product.gallery': 'Galeria de Fotos',

    // Auth
    'auth.login': 'Fazer Login',
    'auth.login.subtitle': 'Entre na sua conta para acompanhar seus pedidos',
    'auth.login.title': 'Entrar na Conta',
    'auth.login.email': 'Email *',
    'auth.login.password': 'Senha *',
    'auth.login.forgot': 'Esqueceu a senha?',
    'auth.login.submit': 'Entrar',
    'auth.login.loading': 'Entrando...',
    'auth.login.noAccount': 'Não tem uma conta?',
    'auth.login.register': 'Cadastre-se',
    'auth.register': 'Criar Conta',
    'auth.register.subtitle': 'Cadastre-se para acompanhar seus pedidos e receber ofertas exclusivas',
    'auth.register.title': 'Seus Dados',
    'auth.register.name': 'Nome Completo *',
    'auth.register.phone': 'Telefone *',
    'auth.register.password': 'Senha *',
    'auth.register.confirmPassword': 'Confirmar Senha *',
    'auth.register.submit': 'Criar Conta',
    'auth.register.loading': 'Criando conta...',
    'auth.register.hasAccount': 'Já tem uma conta?',
    'auth.register.loginLink': 'Fazer login',
    'auth.register.complete.title': 'Cadastro Realizado!',
    'auth.register.complete.subtitle': 'Verifique seu email para confirmar sua conta',
    'auth.register.complete.confirm': 'Confirme seu Email',
    'auth.register.complete.sentTo': 'Enviamos um link de confirmação para:',
    'auth.register.complete.goLogin': 'Ir para Login',

    // Footer
    'footer.description': 'Doce de leite artesanal brasileiro feito com amor no Japão.',
    'footer.links': 'Links Rápidos',
    'footer.contact': 'Contato',
    'footer.rights': 'Todos os direitos reservados.',

    // Products
    'product.cremoso.name': 'Doce de Leite Cremoso',
    'product.cremoso.desc': 'O clássico doce de leite brasileiro, cremoso e irresistível. Feito com leite fresco e açúcar, cozido lentamente até atingir a textura perfeita.',
    'product.coco.name': 'Doce de Leite de Coco',
    'product.coco.desc': 'A doçura tropical do coco combinada com a cremosidade do doce de leite. Uma experiência única e refrescante.',
    'product.amendoim.name': 'Doce de Leite de Amendoim',
    'product.amendoim.desc': 'O sabor irresistível do amendoim torrado misturado ao doce de leite cremoso. Perfeito para paladares exigentes.',
    'product.cafe.name': 'Doce de Leite de Café',
    'product.cafe.desc': 'Uma combinação perfeita do doce de leite tradicional com o sabor marcante do café brasileiro. Ideal para os amantes de café.',
    'product.amendoas.name': 'Doce de Leite de Amêndoas',
    'product.amendoas.desc': 'Uma versão sofisticada com amêndoas selecionadas. O toque crocante das amêndoas eleva esta experiência a outro nível.',
    'product.matcha.name': 'Doce de Leite de Matcha',
    'product.matcha.desc': 'A fusão perfeita entre o Brasil e o Japão. Matcha de alta qualidade de Uji combinado com nosso doce de leite artesanal.',
    'product.chocolate.name': 'Doce de Leite de Chocolate',
    'product.chocolate.desc': 'Chocolate belga premium encontra o doce de leite brasileiro. Uma indulgência irresistível para os chocólatras.',
  },

  en: {
    // Navigation
    'nav.products': 'Products',
    'nav.products.all': 'All Products',
    'nav.products.artesanal': 'Artisan',
    'nav.products.premium': 'Premium',
    'nav.vlog': 'Vlog',
    'nav.shipping': 'Shipping',
    'nav.about': 'About Us',
    'nav.register': 'Sign Up',
    'nav.profile': 'Profile',
    'nav.favorites': 'Favorites',
    'nav.cart': 'Cart',
    'nav.admin': '🔐 Admin Panel',

    // Hero Section
    'hero.badge': 'Handcrafted in Japan',
    'hero.title.1': 'The authentic taste of',
    'hero.title.highlight': 'dulce de leche',
    'hero.title.2': 'from Brazil',
    'hero.description': 'Made with carefully selected ingredients and traditional techniques, our dulce de leche brings all the creaminess and flavor you know and love, straight from Mie to all of Japan.',
    'hero.cta.products': 'View Products',
    'hero.cta.story': 'Our Story',
    'hero.stat.artesanal': 'Handmade',
    'hero.stat.flavors': 'Flavors',
    'hero.stat.provinces': 'Provinces',
    'hero.badge.recipe': 'Brazilian Recipe',
    'hero.badge.tradition': 'Tradition since forever',

    // Featured Products
    'featured.badge': 'Our Products',
    'featured.title': 'Discover our flavors',
    'featured.description': 'Each jar is lovingly prepared, following traditional Brazilian recipes adapted with high-quality local Japanese ingredients.',
    'featured.from': 'From',
    'featured.viewAll': 'View all products',

    // Video Gallery
    'videos.badge': 'Our Videos',
    'videos.title': 'See how it\'s made',
    'videos.description': 'Follow the artisanal production process of our dulce de leche, from ingredient selection to the final result.',

    // About Section
    'about.badge': 'Our Story',
    'about.title': 'From Brazil to Japan, with love',
    'about.p1': 'Born from the longing for Brazilian flavor. In Mie, in the heart of Japan, we created a dulce de leche that combines the best of both cultures: Brazilian tradition and Japanese excellence.',
    'about.p2': 'Each jar is handcrafted with carefully selected ingredients and lots of love. Our goal is to bring this little piece of Brazil to your table, wherever you are in Japan.',
    'about.founded': 'Founded',
    'about.customers': 'Customers',
    'about.rating': 'Rating',

    // Shipping Banner
    'shipping.title': 'We ship all over Japan',
    'shipping.subtitle': 'Fast and secure delivery via Japan Post, Yamato and Sagawa',

    // Product Details
    'product.category.artesanal': 'Artisan',
    'product.category.premium': '★ Premium',
    'product.size.small': '280g',
    'product.size.large': '800g',
    'product.addToCart': 'Add to Cart',
    'product.gallery': 'Photo Gallery',

    // Auth
    'auth.login': 'Login',
    'auth.login.subtitle': 'Sign in to track your orders',
    'auth.login.title': 'Sign In',
    'auth.login.email': 'Email *',
    'auth.login.password': 'Password *',
    'auth.login.forgot': 'Forgot password?',
    'auth.login.submit': 'Sign In',
    'auth.login.loading': 'Signing in...',
    'auth.login.noAccount': "Don't have an account?",
    'auth.login.register': 'Sign Up',
    'auth.register': 'Create Account',
    'auth.register.subtitle': 'Sign up to track your orders and receive exclusive offers',
    'auth.register.title': 'Your Details',
    'auth.register.name': 'Full Name *',
    'auth.register.phone': 'Phone *',
    'auth.register.password': 'Password *',
    'auth.register.confirmPassword': 'Confirm Password *',
    'auth.register.submit': 'Create Account',
    'auth.register.loading': 'Creating account...',
    'auth.register.hasAccount': 'Already have an account?',
    'auth.register.loginLink': 'Sign in',
    'auth.register.complete.title': 'Registration Complete!',
    'auth.register.complete.subtitle': 'Check your email to confirm your account',
    'auth.register.complete.confirm': 'Confirm Your Email',
    'auth.register.complete.sentTo': 'We sent a confirmation link to:',
    'auth.register.complete.goLogin': 'Go to Login',

    // Footer
    'footer.description': 'Artisanal Brazilian dulce de leche made with love in Japan.',
    'footer.links': 'Quick Links',
    'footer.contact': 'Contact',
    'footer.rights': 'All rights reserved.',

    // Products
    'product.cremoso.name': 'Creamy Dulce de Leche',
    'product.cremoso.desc': 'The classic Brazilian dulce de leche, creamy and irresistible. Made with fresh milk and sugar, slowly cooked to achieve the perfect texture.',
    'product.coco.name': 'Coconut Dulce de Leche',
    'product.coco.desc': 'The tropical sweetness of coconut combined with the creaminess of dulce de leche. A unique and refreshing experience.',
    'product.amendoim.name': 'Peanut Dulce de Leche',
    'product.amendoim.desc': 'The irresistible flavor of roasted peanuts mixed with creamy dulce de leche. Perfect for discerning palates.',
    'product.cafe.name': 'Coffee Dulce de Leche',
    'product.cafe.desc': 'A perfect combination of traditional dulce de leche with the bold flavor of Brazilian coffee. Ideal for coffee lovers.',
    'product.amendoas.name': 'Almond Dulce de Leche',
    'product.amendoas.desc': 'A sophisticated version with selected almonds. The crunchy touch of almonds elevates this experience to another level.',
    'product.matcha.name': 'Matcha Dulce de Leche',
    'product.matcha.desc': 'The perfect fusion between Brazil and Japan. High-quality Uji matcha combined with our artisanal dulce de leche.',
    'product.chocolate.name': 'Chocolate Dulce de Leche',
    'product.chocolate.desc': 'Premium Belgian chocolate meets Brazilian dulce de leche. An irresistible indulgence for chocolate lovers.',
  },

  ja: {
    // Navigation
    'nav.products': '商品',
    'nav.products.all': '全商品',
    'nav.products.artesanal': '手作り',
    'nav.products.premium': 'プレミアム',
    'nav.vlog': 'ブログ',
    'nav.shipping': '配送',
    'nav.about': '私たちについて',
    'nav.register': '会員登録',
    'nav.profile': 'プロフィール',
    'nav.favorites': 'お気に入り',
    'nav.cart': 'カート',
    'nav.admin': '🔐 管理パネル',

    // Hero Section
    'hero.badge': '日本で手作り',
    'hero.title.1': '本場ブラジルの',
    'hero.title.highlight': 'ドーセ・デ・レイチ',
    'hero.title.2': 'の味わい',
    'hero.description': '厳選された素材と伝統的な技法で作られた、クリーミーで本格的なドーセ・デ・レイチを三重からお届けします。',
    'hero.cta.products': '商品を見る',
    'hero.cta.story': '私たちの物語',
    'hero.stat.artesanal': '手作り',
    'hero.stat.flavors': 'フレーバー',
    'hero.stat.provinces': '都道府県',
    'hero.badge.recipe': 'ブラジルレシピ',
    'hero.badge.tradition': '伝統の味',

    // Featured Products
    'featured.badge': '当店の商品',
    'featured.title': 'フレーバーを見つけよう',
    'featured.description': '一つ一つ心を込めて、日本の高品質な素材を取り入れたブラジルの伝統レシピで作っています。',
    'featured.from': '〜から',
    'featured.viewAll': '全商品を見る',

    // Video Gallery
    'videos.badge': '動画ギャラリー',
    'videos.title': '作り方をご覧ください',
    'videos.description': '素材の選定から完成まで、ドーセ・デ・レイチの手作り生産工程をご覧いただけます。',

    // About Section
    'about.badge': '私たちの物語',
    'about.title': 'ブラジルから日本へ、愛を込めて',
    'about.p1': 'ブラジルの味を懐かしむ気持ちから生まれました。日本の三重県で、ブラジルの伝統と日本の卓越さを融合したドーセ・デ・レイチを作っています。',
    'about.p2': '一つ一つ丁寧に、厳選された素材と真心を込めて手作りしています。日本全国どこにいても、ブラジルの味をお届けすることが私たちの目標です。',
    'about.founded': '設立',
    'about.customers': 'お客様',
    'about.rating': '評価',

    // Shipping Banner
    'shipping.title': '日本全国配送',
    'shipping.subtitle': '日本郵便・ヤマト・佐川で安心・迅速配送',

    // Product Details
    'product.category.artesanal': '手作り',
    'product.category.premium': '★ プレミアム',
    'product.size.small': '280g',
    'product.size.large': '800g',
    'product.addToCart': 'カートに追加',
    'product.gallery': 'フォトギャラリー',

    // Auth
    'auth.login': 'ログイン',
    'auth.login.subtitle': 'ご注文の状況を確認するにはログインしてください',
    'auth.login.title': 'ログイン',
    'auth.login.email': 'メール *',
    'auth.login.password': 'パスワード *',
    'auth.login.forgot': 'パスワードを忘れた？',
    'auth.login.submit': 'ログイン',
    'auth.login.loading': 'ログイン中...',
    'auth.login.noAccount': 'アカウントをお持ちでないですか？',
    'auth.login.register': '会員登録',
    'auth.register': 'アカウント作成',
    'auth.register.subtitle': '会員登録して注文追跡や限定オファーを受け取りましょう',
    'auth.register.title': 'お客様情報',
    'auth.register.name': '氏名 *',
    'auth.register.phone': '電話番号 *',
    'auth.register.password': 'パスワード *',
    'auth.register.confirmPassword': 'パスワード確認 *',
    'auth.register.submit': 'アカウント作成',
    'auth.register.loading': '作成中...',
    'auth.register.hasAccount': 'すでにアカウントをお持ちですか？',
    'auth.register.loginLink': 'ログイン',
    'auth.register.complete.title': '登録完了！',
    'auth.register.complete.subtitle': 'メールを確認してアカウントを有効にしてください',
    'auth.register.complete.confirm': 'メールを確認してください',
    'auth.register.complete.sentTo': '確認リンクを送信しました：',
    'auth.register.complete.goLogin': 'ログインへ',

    // Footer
    'footer.description': '日本で愛を込めて作るブラジルの手作りドーセ・デ・レイチ。',
    'footer.links': 'クイックリンク',
    'footer.contact': 'お問い合わせ',
    'footer.rights': '全著作権所有。',

    // Products
    'product.cremoso.name': 'クリーミー・ドーセ・デ・レイチ',
    'product.cremoso.desc': 'クラシックなブラジルのドーセ・デ・レイチ。新鮮な牛乳と砂糖でじっくりと煮込み、完璧な食感に仕上げました。',
    'product.coco.name': 'ココナッツ・ドーセ・デ・レイチ',
    'product.coco.desc': 'ココナッツのトロピカルな甘さとドーセ・デ・レイチのクリーミーさが融合。爽やかなユニークな体験。',
    'product.amendoim.name': 'ピーナッツ・ドーセ・デ・レイチ',
    'product.amendoim.desc': 'ローストピーナッツの風味とクリーミーなドーセ・デ・レイチのコラボレーション。こだわりの味わい。',
    'product.cafe.name': 'コーヒー・ドーセ・デ・レイチ',
    'product.cafe.desc': 'ブラジルコーヒーの力強い風味と伝統的なドーセ・デ・レイチの完璧な組み合わせ。コーヒー好きにおすすめ。',
    'product.amendoas.name': 'アーモンド・ドーセ・デ・レイチ',
    'product.amendoas.desc': '厳選アーモンドを使った洗練されたバージョン。カリッとしたアーモンドが味わいを格上げします。',
    'product.matcha.name': '抹茶・ドーセ・デ・レイチ',
    'product.matcha.desc': 'ブラジルと日本の完璧なフュージョン。宇治の高品質抹茶と手作りドーセ・デ・レイチの出会い。',
    'product.chocolate.name': 'チョコレート・ドーセ・デ・レイチ',
    'product.chocolate.desc': 'プレミアムベルギーチョコレートとブラジルのドーセ・デ・レイチが出会う、チョコレート好きにたまらない一品。',
  },
};

export const languageNames: Record<Language, string> = {
  pt: 'Português',
  en: 'English',
  ja: '日本語',
};

export const languageFlags: Record<Language, string> = {
  pt: '🇧🇷',
  en: '🇺🇸',
  ja: '🇯🇵',
};
