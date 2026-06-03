import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Send, X, Bot, Sparkles, Loader2, MessageSquare, Trash, CornerDownLeft, Command, HelpCircle, Smartphone, ShoppingCart } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useLanguage } from '@/context/LanguageContext';
import { useUser } from '@/context/UserContext';
import { useProducts } from '@/context/ProductsContext';
import { Product } from '@/types';
import { safeStorage } from '@/utils/storage';
import { formatPrice, getCurrencyByCountry } from '@/utils/currency';
import { askQwen, qwenEnabled, QwenMsg } from '@/services/qwenService';
import { toast } from 'sonner';

interface ShippingOption {
  carrier: string;
  basePrice: number;
  ratePerKg: number;
  currency: 'BRL' | 'JPY' | 'EUR';
  daysEstimate?: string;
}

interface Message {
  id: string;
  sender: 'user' | 'kimi';
  text: string;
  timestamp: Date;
  agentSteps?: string[];
  isConsentPrompt?: boolean;
  orderToShare?: any;
  products?: Product[];
  shippingResults?: ShippingOption[];
  shippingCountry?: string;
  shippingWeight?: number;
}

const ClawIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <line x1="12" y1="2" x2="12" y2="7" />
    <rect x="9" y="7" width="6" height="3" rx="1" className="fill-primary/20 stroke-primary" />
    <path d="M9 9c-2.2 0.8-3.5 2.5-2.5 5.5c0.4 1.2 1.2 2 2.5 2" />
    <path d="M15 9c2.2 0.8 3.5 2.5 3 5.5c-0.4 1.2-1.2 2-2.5 2" />
    <circle cx="12" cy="9" r="0.8" className="fill-primary" />
  </svg>
);

const KimiClawAssistant: React.FC = () => {
  const { addToCart, clearCart } = useCart();
  const { language, setLanguage, t, selectedCountry } = useLanguage();
  const { products } = useProducts();
  const { user, updateProfile } = useUser();
  const navigate = useNavigate();
  const location = useLocation();

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [currentSteps, setCurrentSteps] = useState<string[]>([]);
  const [showAttentionBadge, setShowAttentionBadge] = useState(true);
  // Pedidos cujo consentimento já foi respondido (esconde os botões Sim/Não)
  const [respondedOrders, setRespondedOrders] = useState<string[]>([]);


  // Shipping flow states
  type ShippingStep = 'idle' | 'ask_country' | 'ask_weight';
  const [shippingFlow, setShippingFlow] = useState<ShippingStep>('idle');
  const [shippingData, setShippingData] = useState<{ country?: string; weight?: number }>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  // Garante que a mensagem de confirmação do pedido é mostrada só UMA vez por pedido
  const promptedOrderRef = useRef<string | null>(null);

  // Auto-scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, currentSteps]);

  // Initial welcome message
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: 'welcome',
          sender: 'kimi',
          text: t('kimiclaw.welcome'),
          timestamp: new Date(),
        },
      ]);
    }
  }, [language, t]);

  // Hide attention badge when chat is opened
  useEffect(() => {
    if (isOpen) {
      setShowAttentionBadge(false);
    }
  }, [isOpen]);

  // Listen to order confirmation page lands (mostra a mensagem só uma vez por pedido)
  useEffect(() => {
    if (location.pathname !== '/order-confirmation') return;
    const order = location.state?.order;
    const orderNum = order?.orderNumber || order?.id || '';
    if (!order || !orderNum) return;
    if (promptedOrderRef.current === orderNum) return; // já mostrou para este pedido
    promptedOrderRef.current = orderNum;

    setIsOpen(true);
    const timer = setTimeout(() => {
      const clientName = order.name || (user ? user.name : 'Cliente');

      let confirmationText = '';
      if (language === 'pt') {
        confirmationText = `Parabéns pela sua compra, **${clientName}**! 🎉 Seu pedido **${orderNum}** foi recebido. \n\nQuer receber **novidades e cupons exclusivos**? É só confirmar que eu marco no seu perfil. 🎁`;
      } else if (language === 'ja') {
        confirmationText = `ご購入ありがとうございます、**${clientName}** 様！🎉 ご注文 **${orderNum}** を承りました。\n\n**新着情報と限定クーポン**を受け取りますか？確認するとマイページに登録します。🎁`;
      } else {
        confirmationText = `Thank you for your purchase, **${clientName}**! 🎉 Your order **${orderNum}** has been received.\n\nWant to receive **news and exclusive coupons**? Just confirm and I'll enable it on your profile. 🎁`;
      }

      setMessages(prev => [
        ...prev,
        {
          id: `order-prompt-${orderNum}`,
          sender: 'kimi',
          text: confirmationText,
          timestamp: new Date(),
          isConsentPrompt: true,
          orderToShare: order
        }
      ]);
    }, 1200);
    return () => clearTimeout(timer);
  }, [location]);

  // Normalize text for search - remove accents and lowercase
  const normalizeText = (text: string): string => {
    return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  };

  // Palavras de ligação/comando ignoradas na busca (pt/en)
  const STOP_WORDS = new Set([
    'por', 'pro', 'pra', 'para', 'o', 'a', 'os', 'as', 'um', 'uma', 'uns', 'umas',
    'de', 'do', 'da', 'dos', 'das', 'e', 'em', 'no', 'na', 'com', 'me', 'meu', 'minha',
    'tem', 'ter', 'tinha', 'algum', 'alguma', 'algo', 'quero', 'queria', 'gostaria',
    'mostrar', 'mostra', 'ver', 'buscar', 'procurar', 'pesquisar', 'achar', 'encontrar',
    'voce', 'vc', 'ai', 'existe', 'vende', 'vendem', 'possui', 'teria', 'produto', 'produtos',
    'search', 'find', 'show', 'want', 'the', 'for', 'of', 'an', 'is', 'do', 'you', 'have',
  ]);

  // Quebra a busca em palavras úteis (ignora ligação e palavras curtas)
  const tokenize = (query: string): string[] =>
    normalizeText(query)
      .split(/[\s,.;:!?'"()/_\-]+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 2 && !STOP_WORDS.has(t));

  // Search for products based on query (pontua por palavra → bem mais tolerante)
  const searchProducts = (query: string): Product[] => {
    const tokens = tokenize(query);
    if (tokens.length === 0) return [];

    const categoryAliases: Record<string, string[]> = {
      'doces': ['doce', 'snack', 'chocolate', 'candy', 'sweet', 'お菓子', 'okashi', 'kitkat', 'kit kat', 'pocky', 'jagariko', 'calbee', 'nestle', 'meiji', 'glico'],
      'cosmeticos': ['cosmetico', 'skincare', 'protetor', 'creme', 'mascara', 'skin', 'lotion', 'コスメ', '化粧品', 'biore', 'hada', 'dhc', 'shiseido'],
      'acessorios': ['acessorio', 'figura', 'boneco', 'figure', 'anime', 'plush', 'アクセサリー', 'グッズ', 'luffy', 'naruto', 'demon', 'pokemon'],
      'papelaria': ['caneta', 'caderno', 'pen', 'notebook', 'paper', 'notepad', '文房具', 'sakura', 'tombow', 'kokuyo', 'pilot', 'zebra'],
    };

    const scored = products.map((product) => {
      let score = 0;
      const nId = normalizeText(product.id);
      const nName = normalizeText(product.name);
      const nDesc = normalizeText(product.description);
      const nFlavor = normalizeText(product.flavor);
      const nCat = normalizeText(product.category);
      const aliases = (categoryAliases[product.category] || []).map((a) => normalizeText(a).replace(/\s+/g, ''));

      tokens.forEach((tok) => {
        const t = tok.replace(/\s+/g, '');
        if (nName.includes(tok)) score += 5;
        if (nId.includes(tok)) score += 5;
        if (nFlavor.includes(tok)) score += 3;
        if (nCat.includes(tok)) score += 4;
        if (nDesc.includes(tok)) score += 2;
        if (aliases.some((a) => a.includes(t) || t.includes(a))) score += 4;
      });

      return { product, score };
    });

    return scored
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((item) => item.product);
  };

  // Detecta intenção de navegar por CATEGORIA ("quais doces tem", "me mostra cosméticos")
  const CATEGORY_WORDS: Record<string, string[]> = {
    doces: ['doce', 'doces', 'snack', 'snacks', 'chocolate', 'chocolates', 'guloseima', 'salgadinho', 'candy', 'sweets', 'okashi'],
    cosmeticos: ['cosmetico', 'cosmeticos', 'cosmetic', 'skincare', 'beleza', 'maquiagem', 'creme', 'cremes', 'protetor'],
    acessorios: ['acessorio', 'acessorios', 'figura', 'figuras', 'colecionavel', 'colecionaveis', 'anime', 'figure', 'goods'],
    papelaria: ['papelaria', 'caneta', 'canetas', 'caderno', 'cadernos', 'escritorio', 'stationery'],
  };
  const CATEGORY_LABEL: Record<string, string> = {
    doces: 'doces', cosmeticos: 'cosméticos', acessorios: 'acessórios', papelaria: 'papelaria',
  };
  const detectCategory = (query: string): string | null => {
    const toks = tokenize(query);
    for (const [cat, words] of Object.entries(CATEGORY_WORDS)) {
      if (words.some((w) => toks.includes(normalizeText(w)))) return cat;
    }
    return null;
  };
  // Mostra todos os produtos de uma categoria. Retorna true se mostrou algo.
  const showCategory = (cat: string): boolean => {
    const list = products.filter((p) => p.category === cat).slice(0, 8);
    if (list.length === 0) return false;
    setMessages((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(7),
        sender: 'kimi',
        text: language === 'pt'
          ? `Aqui estão nossos **${CATEGORY_LABEL[cat]}** (${list.length}):`
          : `Here are our **${cat}** (${list.length}):`,
        timestamp: new Date(),
        products: list,
      },
    ]);
    return true;
  };

  // Calculate shipping options for a given country and weight
  const calculateShipping = (country: string, weightKg: number): ShippingOption[] => {
    const normalizedCountry = normalizeText(country);

    // Detect country from aliases
    let detectedCountry = country;
    if (normalizedCountry.includes('brasil') || normalizedCountry.includes('brazil') || normalizedCountry.includes('br')) detectedCountry = 'Brasil';
    else if (normalizedCountry.includes('japao') || normalizedCountry.includes('japan') || normalizedCountry.includes('ja')) detectedCountry = 'Japão';
    else if (normalizedCountry.includes('portugal') || normalizedCountry.includes('pt')) detectedCountry = 'Portugal';
    else if (normalizedCountry.includes('franca') || normalizedCountry.includes('france') || normalizedCountry.includes('fr')) detectedCountry = 'França';
    else if (normalizedCountry.includes('italia') || normalizedCountry.includes('italy') || normalizedCountry.includes('it')) detectedCountry = 'Itália';
    else if (normalizedCountry.includes('espanha') || normalizedCountry.includes('spain') || normalizedCountry.includes('es')) detectedCountry = 'Espanha';

    const options: ShippingOption[] = [];

    if (detectedCountry === 'Brasil') {
      options.push(
        { carrier: 'PAC', basePrice: 120, ratePerKg: 35, currency: 'BRL', daysEstimate: '5-7' },
        { carrier: 'EMS (Express)', basePrice: 220, ratePerKg: 60, currency: 'BRL', daysEstimate: '2-4' },
        { carrier: 'Prioritário', basePrice: 350, ratePerKg: 85, currency: 'BRL', daysEstimate: '1-3' }
      );
    } else if (detectedCountry === 'Japão') {
      options.push(
        { carrier: 'Japan Post (ゆうパック)', basePrice: 700, ratePerKg: 150, currency: 'JPY', daysEstimate: '1-2' },
        { carrier: 'Yamato (ヤマト)', basePrice: 800, ratePerKg: 180, currency: 'JPY', daysEstimate: '1-3' }
      );
    } else {
      // Europe
      options.push(
        { carrier: 'Local Post', basePrice: 20, ratePerKg: 6, currency: 'EUR', daysEstimate: '5-7' },
        { carrier: 'Express EMS', basePrice: 35, ratePerKg: 10, currency: 'EUR', daysEstimate: '2-4' }
      );
    }

    return options.map(opt => ({
      ...opt,
      basePrice: Math.round(opt.basePrice + opt.ratePerKg * weightKg)
    }));
  };

  const addKimiMessageWithTyping = async (text: string, agentSteps?: string[], delayMs = 1500) => {
    setIsTyping(true);
    if (agentSteps) {
      // Step-by-step animation for agent execution
      for (let i = 0; i < agentSteps.length; i++) {
        setCurrentSteps(prev => [...prev, agentSteps[i]]);
        await new Promise(resolve => setTimeout(resolve, 800));
      }
    }
    await new Promise(resolve => setTimeout(resolve, delayMs));
    setIsTyping(false);
    setCurrentSteps([]);
    setMessages(prev => [
      ...prev,
      {
        id: Math.random().toString(36).substring(7),
        sender: 'kimi',
        text,
        timestamp: new Date(),
      },
    ]);
  };

  const handleCommandExecution = async (text: string) => {
    const query = text.toLowerCase().trim();


    // If in shipping flow, handle weight/country input
    if (shippingFlow === 'ask_country') {
      setShippingFlow('ask_weight');
      setShippingData(prev => ({ ...prev, country: query }));
      await addKimiMessageWithTyping(t('kimiclaw.shipping.ask_weight'));
      return;
    }

    if (shippingFlow === 'ask_weight') {
      setShippingFlow('idle');
      const weight = parseFloat(query);
      if (isNaN(weight) || weight <= 0) {
        await addKimiMessageWithTyping(
          language === 'pt' ? 'Por favor, digite um peso válido (Ex: 1.5)' : 'Please enter a valid weight (Ex: 1.5)'
        );
        setShippingFlow('ask_weight');
        return;
      }

      const country = shippingData.country || selectedCountry || 'Brasil';
      const results = calculateShipping(country, weight);

      setMessages(prev => [
        ...prev,
        {
          id: Math.random().toString(36).substring(7),
          sender: 'kimi',
          text: t('kimiclaw.shipping.result_header').replace('{country}', country).replace('{weight}', weight.toFixed(1)),
          timestamp: new Date(),
          shippingResults: results,
          shippingCountry: country,
          shippingWeight: weight
        }
      ]);
      setShippingData({});
      return;
    }

    // 0.A NAVEGAR POR CATEGORIA (prioridade alta: "quais doces tem", "me mostra cosméticos")
    const detectedCat = detectCategory(query);
    if (detectedCat) {
      if (showCategory(detectedCat)) return;
    }

    // 0. SEARCH PRODUCTS SKILL
    if (query.includes('buscar') || query.includes('procurar') || query.includes('pesquisar') || query.includes('search') || query.includes('find') || query.includes('tem ') || query.includes('quero ') || query.includes('mostrar') || query.includes('achar') || query.includes('encontrar')) {
      // O searchProducts já ignora palavras de ligação/comando ("procurar por kitkat" → kitkat)
      const results = searchProducts(query);

      if (results.length === 0) {
        await addKimiMessageWithTyping(
          t('kimiclaw.search.no_results').replace('{query}', text.trim())
        );
        return;
      }

      const headerMsg = t('kimiclaw.search.found').replace('{count}', results.length.toString());
      setMessages(prev => [
        ...prev,
        {
          id: Math.random().toString(36).substring(7),
          sender: 'kimi',
          text: headerMsg,
          timestamp: new Date(),
          products: results
        }
      ]);
      return;
    }

    // 1. ADD PRODUCT SKILL — só com intenção explícita de adicionar ao carrinho
    if ((query.includes('adicionar') || query.includes('add') || query.includes('coloca')) && query.includes('carrinho')) {
      const targetProduct = products[0];
      const steps = [
        language === 'pt' ? '🔍 Buscando produto no banco de dados...' : '🔍 Searching database...',
        language === 'pt' ? `📦 Selecionando "${targetProduct.name}" (Tamanho: Pequeno)...` : `📦 Selecting "${targetProduct.name}"...`,
        language === 'pt' ? '⚡ Executando comando addToCart na aplicação...' : '⚡ Executing addToCart...',
      ];
      
      addToCart(targetProduct, 'small', 1);
      toast.success(
        language === 'pt' ? `Adicionado: 1x ${targetProduct.name}` : `Added: 1x ${targetProduct.name}`
      );

      const responseText = language === 'pt'
        ? `Feito! Adicionei o **${targetProduct.name}** (Tamanho Pequeno) ao seu carrinho. O preço exibido é de **${formatPrice(targetProduct.prices.small, selectedCountry === 'Japão' ? 'JPY' : 'BRL')}**.`
        : `Success! Added **${targetProduct.name}** (Small Size) to your cart.`;

      await addKimiMessageWithTyping(responseText, steps);
      return;
    }

    // 2. INFORMA O CUPOM DE BOAS-VINDAS (validação real é feita no carrinho)
    if (query.includes('cupom') || query.includes('desconto') || query.includes('coupon')) {
      const steps = [
        language === 'pt' ? '🎟️ Buscando cupons disponíveis...' : '🎟️ Looking up coupons...',
      ];

      const responseText = language === 'pt'
        ? `Use o cupom de boas-vindas **BEMVINDO10** (10% de desconto) digitando-o no campo "Cupom de Desconto" do seu carrinho. Cupons são validados na hora — só funcionam se estiverem ativos e disponíveis para a sua conta.`
        : `Use the welcome coupon **BEMVINDO10** (10% off) by typing it in the "Coupon" field in your cart. Coupons are validated on the spot — they only work if active and available for your account.`;

      await addKimiMessageWithTyping(responseText, steps);
      return;
    }

    // 3. INSCRIÇÃO EM NOVIDADES (apenas marca a flag — NÃO envia/abre WhatsApp Web)
    if (query.includes('whatsapp') || query.includes('whatsappweb') || query.includes('enviar') || query.includes('notificac') || query.includes('novidades')) {
      updateProfile({ whatsappMarketing: true });
      await addKimiMessageWithTyping(
        language === 'pt'
          ? 'Pronto! ✅ Você foi inscrito para receber **novidades e promoções exclusivas**. Pode gerenciar isso em **Meu Perfil** quando quiser.'
          : language === 'ja'
            ? '完了しました！✅ 新着情報と限定プロモーションの受信に登録されました。**マイページ**で管理できます。'
            : 'Done! ✅ You are subscribed to **news and exclusive promotions**. Manage it anytime in **My Profile**.'
      );
      return;
    }

    // Detecção de idioma só com INTENÇÃO explícita (evita 'brasil'/'frete' trocarem idioma)
    const nquery = normalizeText(query);
    const langIntent = /(idioma|lingua|language|mudar|trocar|alterar|falar|switch)/.test(nquery);

    // 4. LANGUAGE TO JAPANESE
    if (/\b(japones|nihongo)\b/.test(nquery) || query.includes('日本語') ||
        (langIntent && /(japao|japan|\bjp\b|\bja\b)/.test(nquery))) {
      setLanguage('ja');
      toast.success('Idioma alterado para 日本語');
      await addKimiMessageWithTyping('言語を日本語に切り替えました！', ['🌐 Mudar idioma...']);
      return;
    }

    // 5. LANGUAGE TO PORTUGUESE
    if (/\bportugues\b/.test(nquery) ||
        (langIntent && /(portug|brasil|\bbr\b|\bpt\b)/.test(nquery))) {
      setLanguage('pt');
      toast.success('Idioma alterado para Português');
      await addKimiMessageWithTyping('Idioma alterado de volta para Português com sucesso!', ['🌐 Mudar idioma...']);
      return;
    }

    // 6. CLEAR CART
    if (query.includes('limpar') || query.includes('esvaziar') || query.includes('clear')) {
      clearCart();
      toast.success('Carrinho limpo!');
      await addKimiMessageWithTyping('Pronto! Seu carrinho foi esvaziado.', ['🗑️ Limpando carrinho...']);
      return;
    }

    // 7. CALCULATE SHIPPING INLINE
    if (query.includes('calcular') || query.includes('frete') || query.includes('shipping') || query.includes('estimativa') || query.includes('quanto custa')) {
      // Try to extract country from query
      let detectedCountry = '';
      if (query.includes('brasil') || query.includes('br')) detectedCountry = 'Brasil';
      else if (query.includes('japao') || query.includes('japan')) detectedCountry = 'Japão';
      else if (query.includes('portugal') || query.includes('pt')) detectedCountry = 'Portugal';
      else if (query.includes('franca') || query.includes('france')) detectedCountry = 'França';
      else if (query.includes('italia') || query.includes('italy')) detectedCountry = 'Itália';
      else if (query.includes('espanha') || query.includes('spain')) detectedCountry = 'Espanha';

      // Try to extract weight from query (e.g., "2kg", "2.5 kg")
      const weightMatch = query.match(/(\d+(?:\.\d+)?)\s*kg/i);
      const weight = weightMatch ? parseFloat(weightMatch[1]) : 0;

      // If both country and weight are detected, show result immediately
      if (detectedCountry && weight > 0) {
        const results = calculateShipping(detectedCountry, weight);
        setMessages(prev => [
          ...prev,
          {
            id: Math.random().toString(36).substring(7),
            sender: 'kimi',
            text: t('kimiclaw.shipping.result_header').replace('{country}', detectedCountry).replace('{weight}', weight.toFixed(1)),
            timestamp: new Date(),
            shippingResults: results,
            shippingCountry: detectedCountry,
            shippingWeight: weight
          }
        ]);
        return;
      }

      // If only country is detected, ask for weight
      if (detectedCountry) {
        setShippingFlow('ask_weight');
        setShippingData({ country: detectedCountry });
        await addKimiMessageWithTyping(t('kimiclaw.shipping.ask_weight'));
        return;
      }

      // Otherwise, ask for country
      setShippingFlow('ask_country');
      await addKimiMessageWithTyping(t('kimiclaw.shipping.ask_country'));
      return;
    }

    // 8. NAVIGATE TO VLOG
    if (query.includes('vlog') || query.includes('video') || query.includes('depoimento') || query.includes('unboxing')) {
      navigate('/vlog');
      await addKimiMessageWithTyping('Abre a página do **Vlog**! Assista aos reviews reais dos envios do Japão.', ['🎥 Navegando...']);
      return;
    }

    // 8.5 BUSCA AUTOMÁTICA — se o texto bate com algum produto, mostra (ex: "kitkat", "calbee")
    if (!query.includes('oi') && !query.includes('ola') && !query.includes('hello')) {
      const autoResults = searchProducts(query);
      if (autoResults.length > 0) {
        setMessages(prev => [
          ...prev,
          {
            id: Math.random().toString(36).substring(7),
            sender: 'kimi',
            text: t('kimiclaw.search.found').replace('{count}', autoResults.length.toString()),
            timestamp: new Date(),
            products: autoResults,
          }
        ]);
        return;
      }
    }

    // 9. GENERAL RESPONSE
    let responseText = '';
    if (query.includes('oi') || query.includes('ola') || query.includes('hello')) {
      responseText = 'Olá! Sou o KimiClaw AI. Posso buscar produtos, adicionar itens ao carrinho, mudar o idioma, calcular o frete ou inscrever você em novidades. O que deseja?';
      await addKimiMessageWithTyping(responseText);
      return;
    }

    // 9.5 IA (Qwen) — se houver chave configurada, responde de forma conversacional
    if (qwenEnabled()) {
      setIsTyping(true);
      const history: QwenMsg[] = messages
        .slice(-6)
        .map((m) => ({ role: m.sender === 'kimi' ? 'assistant' : 'user', content: m.text } as QwenMsg));
      history.push({ role: 'user', content: text });
      const ai = await askQwen(history);
      setIsTyping(false);
      if (ai) {
        await addKimiMessageWithTyping(ai);
        return;
      }
    }

    // Fallback por regras
    const suggestions = language === 'pt'
      ? 'Não encontrei isso. Minhas habilidades: 🔍 **buscar** produtos (ex: "kitkat", "calbee") | 📦 **calcular** frete | 🎟️ **cupom** | 📱 **novidades** | 🗑️ **limpar carrinho**'
      : language === 'ja'
        ? '機能: 🔍 商品検索 | 📦 送料計算 | 🎟️ クーポン | 📱 お知らせ | 🗑️ カート削除'
        : "Didn't find that. My skills: 🔍 **search** products | 📦 **calculate** shipping | 🎟️ **coupon** | 📱 **news** | 🗑️ **clear cart**";
    responseText = suggestions;
    await addKimiMessageWithTyping(responseText);
  };

  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputValue.trim() || isTyping) return;

    const userText = inputValue;
    setMessages(prev => [
      ...prev,
      {
        id: Math.random().toString(36).substring(7),
        sender: 'user',
        text: userText,
        timestamp: new Date(),
      },
    ]);
    setInputValue('');
    handleCommandExecution(userText);
  };

  const handleSuggestionClick = (skillText: string, searchKey: string) => {
    if (isTyping) return;
    setMessages(prev => [
      ...prev,
      {
        id: Math.random().toString(36).substring(7),
        sender: 'user',
        text: skillText,
        timestamp: new Date(),
      },
    ]);
    handleCommandExecution(searchKey);
  };

  const handleConsentAction = async (accept: boolean, order?: any) => {
    // Marca este pedido como respondido → esconde os botões e evita repetição
    const orderKey = order?.orderNumber || order?.id;
    if (orderKey) {
      if (respondedOrders.includes(orderKey)) return; // já respondeu, ignora cliques extras
      setRespondedOrders(prev => [...prev, orderKey]);
    }

    if (!accept) {
      setMessages(prev => [
        ...prev,
        {
          id: Math.random().toString(36).substring(7),
          sender: 'kimi',
          text: language === 'pt' ? 'Tudo bem! Se mudar de ideia, é só ativar no seu perfil.' : 'No problem! You can enable it anytime in your profile.',
          timestamp: new Date()
        }
      ]);
      return;
    }

    // Apenas MARCA o cliente para receber novidades/promoções (NÃO envia nada,
    // não abre WhatsApp Web). O telefone do pedido fica salvo para uso futuro.
    const phone = order?.phone || user?.phone;
    updateProfile({ whatsappMarketing: true, ...(phone ? { phone } : {}) });

    const confirmText = language === 'pt'
      ? 'Pronto! ✅ Você foi inscrito para receber **novidades e promoções exclusivas**. Pode ativar ou desativar isso quando quiser em **Meu Perfil**.'
      : language === 'ja'
        ? '完了しました！✅ 新着情報と限定プロモーションの受信に登録されました。**マイページ**でいつでも変更できます。'
        : 'Done! ✅ You are now subscribed to **news and exclusive promotions**. You can turn this on/off anytime in **My Profile**.';

    setMessages(prev => [
      ...prev,
      {
        id: Math.random().toString(36).substring(7),
        sender: 'kimi',
        text: confirmText,
        timestamp: new Date()
      }
    ]);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 font-sans">
      {/* ATTENTION BADGE */}
      {showAttentionBadge && !isOpen && (
        <div className="absolute bottom-16 right-2 bg-gradient-to-r from-primary to-accent text-white text-xs px-3 py-1.5 rounded-full shadow-elevated whitespace-nowrap animate-float border border-white/20 select-none">
          <span className="flex items-center gap-1.5 font-medium">
            <Sparkles className="w-3.5 h-3.5 text-yellow-300 animate-pulse" />
            {language === 'pt' ? 'Experimente o KimiClaw!' : 'Try KimiClaw AI!'}
          </span>
          <div className="absolute -bottom-1 right-5 w-2 h-2 bg-accent rotate-45 border-r border-b border-white/10" />
        </div>
      )}

      {/* FLOATING ACTION BUTTON */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="w-14 h-14 rounded-full bg-gradient-to-tr from-primary via-accent to-primary text-white flex items-center justify-center shadow-elevated hover:shadow-[0_8px_30px_rgb(249,115,22,0.4)] transition-all duration-300 transform hover:scale-105 border border-white/20 group relative overflow-hidden"
        >
          <ClawIcon className="w-7 h-7 text-white transform group-hover:rotate-12 transition-transform duration-300" />
          <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-green-500 rounded-full border border-white animate-ping" />
          <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-green-500 rounded-full border border-white" />
        </button>
      )}

      {/* CHAT WINDOW CONTAINER */}
      {isOpen && (
        <div className="w-[360px] sm:w-[390px] h-[550px] max-h-[85vh] rounded-2xl border border-white/20 shadow-elevated bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl flex flex-col overflow-hidden animate-fade-up">
          {/* HEADER */}
          <div className="p-4 bg-gradient-to-r from-primary/10 via-accent/5 to-transparent border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-primary to-accent flex items-center justify-center text-white shadow-soft relative">
                <ClawIcon className="w-5.5 h-5.5 text-white" />
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border border-white" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-foreground flex items-center gap-1.5">
                  {t('kimiclaw.title')}
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary-dark dark:text-primary font-mono font-medium">
                    v1.4
                  </span>
                </h3>
                <p className="text-[11px] text-muted-foreground">{t('kimiclaw.subtitle')}</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* MESSAGES FEED */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}
              >
                {msg.sender === 'kimi' && (
                  <div className="w-8 h-8 rounded-full bg-muted border border-border flex items-center justify-center text-primary shrink-0 self-end shadow-soft">
                    <Bot className="w-4 h-4" />
                  </div>
                )}
                <div className="max-w-[78%] flex flex-col gap-2">
                  <div
                    className={`rounded-2xl px-3.5 py-2.5 text-xs shadow-soft leading-relaxed ${
                      msg.sender === 'user'
                        ? 'bg-primary text-white rounded-br-none'
                        : 'bg-card text-card-foreground border border-border rounded-bl-none'
                    }`}
                  >
                    {msg.text.split('**').map((chunk, idx) => 
                      idx % 2 === 1 ? <strong key={idx} className="font-semibold">{chunk}</strong> : chunk
                    )}
                  </div>
                  
                  {/* CONSENT PROMPT ACTION BUTTONS (somem após responder) */}
                  {msg.isConsentPrompt &&
                    !respondedOrders.includes(msg.orderToShare?.orderNumber || msg.orderToShare?.id) && (
                    <div className="flex gap-2 mt-1">
                      <button
                        onClick={() => handleConsentAction(true, msg.orderToShare)}
                        className="text-[11px] font-bold bg-primary hover:bg-primary/95 text-white px-3 py-1.5 rounded-lg shadow-soft transition-all"
                      >
                        ✅ {language === 'pt' ? 'Sim, quero receber!' : 'Yes, subscribe me!'}
                      </button>
                      <button
                        onClick={() => handleConsentAction(false, msg.orderToShare)}
                        className="text-[11px] font-semibold bg-secondary hover:bg-secondary/80 text-foreground px-3 py-1.5 rounded-lg transition-all"
                      >
                        ❌ {language === 'pt' ? 'Não, obrigado' : 'No, thanks'}
                      </button>
                    </div>
                  )}

                  {/* PRODUCT SEARCH RESULTS */}
                  {msg.products && msg.products.length > 0 && (
                    <div className="flex flex-col gap-2 mt-2">
                      {msg.products.map((product) => (
                        <div key={product.id} className="bg-muted/40 border border-border rounded-lg p-2.5 hover:bg-muted/60 transition-colors">
                          <div className="flex gap-2 items-start">
                            <img src={product.image} alt={product.name} className="w-12 h-12 rounded object-cover" />
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] font-semibold text-foreground truncate">{product.name}</p>
                              <p className="text-[10px] text-muted-foreground">{product.category}</p>
                              <p className="text-[11px] font-bold text-primary mt-1">
                                {formatPrice(product.prices.small, getCurrencyByCountry(selectedCountry))}
                              </p>
                            </div>
                            <button
                              onClick={() => {
                                addToCart(product, 'small', 1);
                                toast.success(language === 'pt' ? `Adicionado: ${product.name}` : `Added: ${product.name}`);
                              }}
                              className="flex-shrink-0 bg-primary hover:bg-primary/95 text-white p-1.5 rounded-lg transition-colors"
                              title={t('kimiclaw.search.add_to_cart')}
                            >
                              <ShoppingCart className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* SHIPPING CALCULATION RESULTS */}
                  {msg.shippingResults && msg.shippingResults.length > 0 && (
                    <div className="flex flex-col gap-1.5 mt-2 text-[11px]">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left py-1 px-2 font-bold text-foreground text-[10px]">{t('kimiclaw.shipping.carrier')}</th>
                            <th className="text-right py-1 px-2 font-bold text-foreground text-[10px]">{t('kimiclaw.shipping.price')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {msg.shippingResults.map((option, idx) => (
                            <tr key={idx} className="border-b border-border/50 hover:bg-muted/40 transition-colors">
                              <td className="py-2 px-2 text-left text-foreground">
                                <div className="font-semibold">{option.carrier}</div>
                                {option.daysEstimate && (
                                  <div className="text-[10px] text-muted-foreground">~{option.daysEstimate} dias</div>
                                )}
                              </td>
                              <td className="py-2 px-2 text-right">
                                <div className="font-bold text-primary">
                                  {formatPrice(option.basePrice, option.currency)}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* STEP BY STEP OR TYPING STATE */}
            {isTyping && (
              <div className="flex gap-2.5">
                <div className="w-8 h-8 rounded-full bg-muted border border-border flex items-center justify-center text-primary shrink-0 self-end shadow-soft">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="max-w-[80%] space-y-2">
                  {currentSteps.map((step, idx) => (
                    <div
                      key={idx}
                      className="text-[11px] text-muted-foreground font-mono bg-muted/60 dark:bg-zinc-900/60 px-2.5 py-1 rounded border border-border/50 animate-pulse flex items-center gap-1.5"
                    >
                      <Loader2 className="w-3 h-3 animate-spin text-primary" />
                      {step}
                    </div>
                  ))}
                  <div className="bg-card text-card-foreground border border-border rounded-2xl rounded-bl-none px-3.5 py-2.5 text-xs inline-flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* SKILL SUGGESTIONS */}
          {!isTyping && (
            <div className="px-4 py-2 border-t border-border bg-muted/30">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Command className="w-3 h-3" />
                {language === 'pt' ? 'Habilidades Rápidas' : 'Quick Agent Skills'}
              </p>
              <div className="flex flex-wrap gap-1.5 max-h-[85px] overflow-y-auto scrollbar-hide py-0.5">
                <button
                  onClick={() => handleSuggestionClick(t('kimiclaw.skill.search_products'), 'buscar produtos')}
                  className="text-[11px] bg-primary/10 hover:bg-primary/20 border border-primary/20 rounded-full px-2.5 py-1 text-primary-dark dark:text-primary font-bold flex items-center gap-1 transition-all duration-200"
                >
                  🔍 {language === 'pt' ? 'Buscar Produtos' : 'Search Products'}
                </button>
                <button
                  onClick={() => handleSuggestionClick(t('kimiclaw.skill.calc_shipping'), 'calcular frete')}
                  className="text-[11px] bg-primary/10 hover:bg-primary/20 border border-primary/20 rounded-full px-2.5 py-1 text-primary-dark dark:text-primary font-bold flex items-center gap-1 transition-all duration-200"
                >
                  📦 {language === 'pt' ? 'Calcular Frete' : 'Calc. Shipping'}
                </button>
                <button
                  onClick={() => handleSuggestionClick(t('kimiclaw.skill.apply_coupon'), 'cupom')}
                  className="text-[11px] bg-card hover:bg-primary/10 border border-border hover:border-primary/30 rounded-full px-2.5 py-1 text-foreground transition-all duration-200"
                >
                  {t('kimiclaw.skill.apply_coupon')}
                </button>
                <button
                  onClick={() => handleSuggestionClick('📱 Receber novidades no WhatsApp', 'enviar whatsapp')}
                  className="text-[11px] bg-card hover:bg-primary/10 border border-border hover:border-primary/30 rounded-full px-2.5 py-1 text-foreground flex items-center gap-1 transition-all duration-200"
                >
                  <Smartphone className="w-3 h-3" />
                  {language === 'pt' ? 'WhatsApp' : 'WhatsApp'}
                </button>
                <button
                  onClick={() => handleSuggestionClick(t('kimiclaw.skill.clear_cart'), 'limpar carrinho')}
                  className="text-[11px] bg-card hover:bg-destructive/10 border border-border hover:border-destructive/30 rounded-full px-2.5 py-1 text-destructive font-medium transition-all duration-200"
                >
                  {t('kimiclaw.skill.clear_cart')}
                </button>
              </div>
            </div>
          )}

          {/* INPUT FORM */}
          <form onSubmit={handleSendMessage} className="p-3 bg-card border-t border-border flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={t('kimiclaw.input_placeholder')}
                disabled={isTyping}
                className="w-full text-xs rounded-lg border border-input bg-background px-3 py-2.5 pr-8 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-50"
              />
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground flex items-center gap-1 select-none pointer-events-none">
                <CornerDownLeft className="w-3.5 h-3.5 opacity-50" />
              </div>
            </div>
            <button
              type="submit"
              disabled={isTyping || !inputValue.trim()}
              className="p-2.5 rounded-lg bg-primary hover:bg-primary/95 text-white disabled:bg-muted disabled:text-muted-foreground transition-colors shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default KimiClawAssistant;
