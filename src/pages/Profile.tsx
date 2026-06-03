import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User, Mail, Phone, MapPin, Calendar, Gift, ShoppingBag, Edit2, LogOut, Package, RotateCcw, Cloud, Truck, Tag, Megaphone, ArrowRight } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useUser, UserProfile } from '@/context/UserContext';
import { useCart } from '@/context/CartContext';
import { useToast } from '@/hooks/use-toast';
import { prefectures } from '@/data/prefectures';
import { addAddressHints } from '@/utils/romanize';
import { useProducts } from '@/context/ProductsContext';
import { isValidEmail, isValidPhone, isNonEmpty, maskPhone } from '@/utils/validation';
import { affiliateService } from '@/services/affiliateService';
import { reviewService } from '@/services/reviewService';
import ReviewModal from '@/components/products/ReviewModal';
import { Star } from 'lucide-react';

const Profile: React.FC = () => {
  const { user, isAuthenticated, coupons, orders, updateProfile, logout } = useUser();
  const { products } = useProducts();
  const { addToCart, clearCart } = useCart();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editedUser, setEditedUser] = useState<Partial<UserProfile>>(user || {});

  // Avaliação a partir do histórico de pedidos
  const [reviewTarget, setReviewTarget] = useState<{ id: string; name: string } | null>(null);
  const [reviewBump, setReviewBump] = useState(0); // força recálculo de "já avaliou"
  const findProductId = (name: string) => products.find((p) => p.name === name)?.id;

  // Mostra o atalho do painel de afiliado só se a conta for de um influencer
  const [isAffiliate, setIsAffiliate] = useState(false);
  useEffect(() => {
    if (user?.email) {
      affiliateService.getByOwnerEmail(user.email).then((list) => setIsAffiliate(list.length > 0));
    }
  }, [user?.email]);

  // Função para recomprar um pedido
  const handleReorder = (order: any) => {
    clearCart();
    
    let itemsAdded = 0;
    
    // Adiciona todos os itens do pedido ao carrinho
    order.items.forEach((item: any) => {
      // Busca o produto original pelo nome
      const product = products.find(p => p.name === item.productName);
      
      if (product) {
        addToCart(product, item.size as 'small' | 'large', item.quantity);
        itemsAdded++;
      }
    });
    
    if (itemsAdded > 0) {
      toast({
        title: "Itens adicionados ao carrinho!",
        description: `${itemsAdded} produto(s) do pedido #${order.orderNumber}`,
      });
      
      // Navega para o carrinho
      navigate('/carrinho');
    } else {
      toast({
        title: "Erro ao adicionar itens",
        description: "Alguns produtos podem não estar mais disponíveis",
        variant: "destructive",
      });
    }
  };



  // Redirect if not authenticated
  React.useEffect(() => {
    if (!isAuthenticated) {
      navigate('/cadastro');
    }
  }, [isAuthenticated, navigate]);

  if (!user) {
    return null;
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setEditedUser(prev => ({
        ...prev,
        [parent]: {
          ...((prev as UserProfile)[parent as keyof UserProfile] as Record<string, unknown>),
          [child]: value
        }
      }));
    } else {
      const nextValue = name === 'phone' ? maskPhone(value) : value;
      setEditedUser(prev => ({ ...prev, [name]: nextValue }));
    }
  };

  // Busca automática de endereço por CEP
  const handlePostalCodeChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    
    // Formata CEP (XXX-XXXX)
    let formatted = value;
    if (value.length > 3) {
      formatted = `${value.slice(0, 3)}-${value.slice(3, 7)}`;
    }
    
    // Atualiza o campo CEP
    setEditedUser(prev => ({
      ...prev,
      address: {
        ...prev.address,
        postalCode: formatted
      }
    }));

    // Busca endereço quando CEP está completo (7 dígitos)
    if (value.length === 7) {
      try {
        const response = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${value}`);
        const data = await response.json();
        
        if (data.status === 200 && data.results && data.results.length > 0) {
          const result = data.results[0];
          const prefecture = prefectures.find(p => p.nameJa === result.address1);
          
          // Adiciona hints de leitura para cidade e bairro separadamente
          const city = addAddressHints(result.address2);
          const neighborhood = result.address3 ? addAddressHints(result.address3) : '';
          const cityDisplay = neighborhood ? `${city} ${neighborhood}` : city;
          
          setEditedUser(prev => ({
            ...prev,
            address: {
              ...prev.address,
              postalCode: formatted,
              prefecture: prefecture?.name || '', // Usa apenas o nome em português
              city: cityDisplay,
            }
          }));
          
          toast({
            title: "Endereço encontrado!",
            description: "Província e cidade preenchidos automaticamente.",
          });
        }
      } catch (error) {
        console.error('Erro ao buscar CEP:', error);
      }
    }
  };

  const handleSaveProfile = () => {
    // Valida antes de salvar
    if (editedUser.name !== undefined && !isNonEmpty(editedUser.name, 2)) {
      toast({ title: 'Nome inválido', description: 'Informe seu nome completo.', variant: 'destructive' });
      return;
    }
    if (editedUser.email !== undefined && !isValidEmail(editedUser.email)) {
      toast({ title: 'E-mail inválido', description: 'Verifique o endereço de e-mail.', variant: 'destructive' });
      return;
    }
    if (editedUser.phone !== undefined && editedUser.phone !== '' && !isValidPhone(editedUser.phone)) {
      toast({ title: 'Telefone inválido', description: 'Use 10 a 11 dígitos.', variant: 'destructive' });
      return;
    }

    const turnedOnMarketing = editedUser.whatsappMarketing && !user.whatsappMarketing;
    // Apenas salva a preferência — NÃO envia/abre WhatsApp Web.
    updateProfile(editedUser);
    setIsEditing(false);
    toast({
      title: "Perfil atualizado!",
      description: turnedOnMarketing
        ? "✅ Você foi inscrito para receber novidades e promoções."
        : "Suas informações foram salvas com sucesso.",
    });
  };

  const handleLogout = () => {
    logout();
    navigate('/');
    toast({
      title: "Logout realizado",
      description: "Você foi desconectado com sucesso.",
    });
  };

  const activeCoupons = coupons.filter(c => !c.isUsed && new Date(c.expiresAt) > new Date());
  const usedCoupons = coupons.filter(c => c.isUsed);
  const expiredCoupons = coupons.filter(c => !c.isUsed && new Date(c.expiresAt) <= new Date());

  return (
    <Layout>
      <div className="gradient-hero py-16">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <h1 className="font-display text-4xl lg:text-5xl font-bold text-foreground mb-4">
              Meu Perfil
            </h1>
            <p className="text-muted-foreground text-lg">
              Gerencie suas informações e acompanhe seus pedidos
            </p>
          </div>
        </div>
      </div>

      <section className="py-12 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto space-y-6">

            {/* Pontos de Fidelidade */}
            <div className="bg-gradient-to-r from-amber-400 to-orange-500 rounded-2xl p-6 lg:p-8 text-white shadow-elevated flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-white/90">Pontos de Fidelidade</p>
                <p className="font-display text-5xl font-extrabold mt-1">{user?.points || 0} <span className="text-2xl font-bold">pts</span></p>
                <p className="text-sm text-white/90 mt-1">Avaliação +1 · vídeo de review +5/min (após validação) · 1 ponto a cada ¥100 em compras · 1000 no aniversário. Use como desconto (1 pt = ¥1)!</p>
              </div>
              <div className="text-7xl opacity-80">🎁</div>
            </div>

            {/* Personal Information */}
            <div className="bg-card rounded-2xl border border-border p-6 lg:p-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  <h2 className="font-display text-2xl font-semibold text-foreground">
                    Informações Pessoais
                  </h2>
                </div>
                <div className="flex gap-2">
                  {isEditing ? (
                    <>
                      <Button variant="outline" onClick={() => setIsEditing(false)}>
                        Cancelar
                      </Button>
                      <Button onClick={handleSaveProfile} className="btn-primary">
                        Salvar
                      </Button>
                    </>
                  ) : (
                    <Button variant="outline" onClick={() => setIsEditing(true)}>
                      <Edit2 className="w-4 h-4 mr-2" />
                      Editar
                    </Button>
                  )}
                </div>
              </div>

              {isEditing ? (
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome Completo</Label>
                    <Input
                      id="name"
                      name="name"
                      value={editedUser.name || ''}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={editedUser.email || ''}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefone</Label>
                    <Input
                      id="phone"
                      name="phone"
                      type="tel"
                      value={editedUser.phone || ''}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-2 md:col-span-2">
                    <input
                      id="whatsappMarketing"
                      name="whatsappMarketing"
                      type="checkbox"
                      checked={!!editedUser.whatsappMarketing}
                      onChange={(e) => setEditedUser(prev => ({ ...prev, whatsappMarketing: e.target.checked }))}
                      className="w-4 h-4 rounded border-input text-primary focus:ring-primary cursor-pointer"
                    />
                    <Label htmlFor="whatsappMarketing" className="text-sm font-semibold cursor-pointer select-none leading-none">
                      Receber novidades e cupons diretamente no meu WhatsApp (Cupom BEMVINDO10)
                    </Label>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="birthdate">Data de Nascimento</Label>
                    <Input
                      id="birthdate"
                      name="birthdate"
                      type="date"
                      value={editedUser.birthdate || ''}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="postalCode">CEP (郵便番号)</Label>
                    <Input
                      id="postalCode"
                      name="address.postalCode"
                      type="text"
                      placeholder="100-0001"
                      value={editedUser.address?.postalCode || ''}
                      onChange={handlePostalCodeChange}
                      maxLength={8}
                    />
                    <p className="text-xs text-muted-foreground">
                      Digite o CEP - Província e cidade preenchem automaticamente
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="prefecture">Província (都道府県)</Label>
                    <select
                      id="prefecture"
                      name="address.prefecture"
                      value={editedUser.address?.prefecture || ''}
                      onChange={(e) => {
                        setEditedUser(prev => ({
                          ...prev,
                          address: {
                            ...prev.address,
                            prefecture: e.target.value
                          }
                        }));
                      }}
                      className="w-full p-3 rounded-lg border border-border bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                    >
                      <option value="">Escolha uma província...</option>
                      {prefectures.map((pref) => (
                        <option key={pref.name} value={pref.name}>
                          {pref.nameJa} ({pref.name})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="city">Cidade (市区町村)</Label>
                    <Input
                      id="city"
                      name="address.city"
                      value={editedUser.address?.city || ''}
                      onChange={handleInputChange}
                      readOnly
                      className="bg-secondary/50"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="address">Endereço</Label>
                    <Input
                      id="address"
                      name="address.address"
                      value={editedUser.address?.address || ''}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="building">Edifício / Apartamento</Label>
                    <Input
                      id="building"
                      name="address.building"
                      value={editedUser.address?.building || ''}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground flex items-center gap-2">
                      <User className="w-4 h-4" />
                      Nome
                    </Label>
                    <p className="font-medium text-foreground">{user.name}</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      Email
                    </Label>
                    <p className="font-medium text-foreground">{user.email}</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      Telefone
                    </Label>
                    <p className="font-medium text-foreground">{user.phone}</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground flex items-center gap-2">
                      <Cloud className="w-4 h-4" />
                      Receber novidades e promoções
                    </Label>
                    <div className="flex items-center gap-3 flex-wrap">
                      <p className="font-medium text-foreground">
                        {user.whatsappMarketing ? '✅ Ativado' : '❌ Desativado'}
                      </p>
                      <button
                        onClick={() => {
                          const novo = !user.whatsappMarketing;
                          updateProfile({ whatsappMarketing: novo });
                          toast({
                            title: novo ? '✅ Inscrição ativada' : 'Inscrição cancelada',
                            description: novo
                              ? 'Você vai receber novidades e promoções.'
                              : 'Você não vai mais receber novidades.',
                          });
                        }}
                        className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
                          user.whatsappMarketing
                            ? 'border-red-300 text-red-600 hover:bg-red-50'
                            : 'border-green-300 text-green-600 hover:bg-green-50'
                        }`}
                      >
                        {user.whatsappMarketing ? 'Desativar' : 'Ativar'}
                      </button>
                    </div>
                  </div>
                  {user.birthdate && (
                    <div className="space-y-2">
                      <Label className="text-muted-foreground flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Data de Nascimento
                      </Label>
                      <p className="font-medium text-foreground">
                        {new Date(user.birthdate).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  )}
                  <div className="space-y-2 md:col-span-2">
                    <Label className="text-muted-foreground flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      Endereço
                    </Label>
                    <p className="font-medium text-foreground">
                      〒{user.address.postalCode}<br />
                      {(() => {
                        const pref = prefectures.find(p => p.name === user.address.prefecture);
                        return pref ? `${pref.nameJa} (${pref.name})` : user.address.prefecture;
                      })()} {user.address.city}<br />
                      {user.address.address}
                      {user.address.building && <><br />{user.address.building}</>}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Painel de Afiliado (só para influencers) */}
            {isAffiliate && (
              <Link
                to="/afiliado"
                className="block bg-gradient-to-r from-primary/10 to-primary/5 rounded-2xl border border-primary/30 p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center">
                      <Megaphone className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h2 className="font-display text-lg font-bold text-foreground">Painel de Afiliado</h2>
                      <p className="text-sm text-muted-foreground">Veja suas indicações, vendas e comissões</p>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-primary flex-shrink-0" />
                </div>
              </Link>
            )}

            {/* Coupons */}
            <div className="bg-card rounded-2xl border border-border p-6 lg:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Gift className="w-5 h-5 text-primary" />
                </div>
                <h2 className="font-display text-2xl font-semibold text-foreground">
                  Meus Cupons
                </h2>
              </div>

              {activeCoupons.length > 0 ? (
                <div className="space-y-4">
                  <h3 className="font-semibold text-foreground mb-3">Cupons Ativos</h3>
                  {activeCoupons.map((coupon) => (
                    <div 
                      key={coupon.id}
                      className="p-4 rounded-xl border-2 border-dashed border-primary bg-primary/5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-bold text-lg text-primary font-mono">{coupon.code}</p>
                          <p className="text-sm text-foreground">{coupon.description}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Válido até {new Date(coupon.expiresAt).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-2xl text-primary">
                            {coupon.discountType === 'percentage' ? `${coupon.discount}%` : `¥${coupon.discount}`}
                          </p>
                          <p className="text-xs text-muted-foreground">desconto</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  Você não tem cupons ativos no momento.
                </p>
              )}

              {(usedCoupons.length > 0 || expiredCoupons.length > 0) && (
                <div className="mt-6 pt-6 border-t border-border">
                  <h3 className="font-semibold text-muted-foreground mb-3 text-sm">
                    Cupons Utilizados ou Expirados
                  </h3>
                  <div className="space-y-2">
                    {[...usedCoupons, ...expiredCoupons].map((coupon) => (
                      <div 
                        key={coupon.id}
                        className="p-3 rounded-lg bg-secondary/30 opacity-60"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-mono text-sm">{coupon.code}</p>
                            <p className="text-xs text-muted-foreground">
                              {coupon.isUsed ? 'Utilizado' : 'Expirado'}
                            </p>
                          </div>
                          <p className="text-sm">
                            {coupon.discountType === 'percentage' ? `${coupon.discount}%` : `¥${coupon.discount}`}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Purchase History */}
            <div className="bg-card rounded-2xl border border-border p-6 lg:p-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <ShoppingBag className="w-5 h-5 text-primary" />
                  </div>
                  <h2 className="font-display text-2xl font-semibold text-foreground">
                    Histórico de Compras
                  </h2>
                </div>
              </div>

              {orders.length > 0 ? (
                <div className="space-y-4">
                  {orders.map((order) => (
                    <div 
                      key={order.id}
                      className="p-4 rounded-xl border border-border hover:bg-secondary/50 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-semibold text-foreground font-mono">
                            {order.orderNumber}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(order.date).toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: 'long',
                              year: 'numeric'
                            })}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg text-foreground">
                            ¥{order.totalAmount.toLocaleString()}
                          </p>
                          <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                            order.status === 'delivered' ? 'bg-green-100 text-green-800' :
                            order.status === 'shipped' ? 'bg-blue-100 text-blue-800' :
                            (order.status as string) === 'processing' ? 'bg-orange-100 text-orange-800' :
                            order.status === 'confirmed' ? 'bg-yellow-100 text-yellow-800' :
                            order.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {order.status === 'delivered' ? 'Entregue' :
                             order.status === 'shipped' ? 'Em Trânsito' :
                             (order.status as string) === 'processing' ? 'Processando' :
                             order.status === 'confirmed' ? 'Confirmado' :
                             order.status === 'cancelled' ? 'Cancelado' : 'Pendente'}
                          </span>
                        </div>
                      </div>

                      {/* Tracking Info */}
                      {order.status === 'shipped' && (order as any).trackingNumber && (() => {
                        const trackingNumber = (order as any).trackingNumber;
                        const savedUrl = (order as any).trackingUrl || '';
                        let carrierRaw = (order as any).carrier || (order as any).shipping?.carrier || '';
                        
                        // If carrier is empty, detect from saved URL
                        if (!carrierRaw && savedUrl) {
                          if (savedUrl.includes('kuronekoyamato')) carrierRaw = 'Yamato';
                          else if (savedUrl.includes('sagawa')) carrierRaw = 'Sagawa';
                          else if (savedUrl.includes('japanpost')) carrierRaw = 'Japan Post';
                          else if (savedUrl.includes('fukutsu')) carrierRaw = 'Fukutsu';
                        }
                        
                        // Derive carrier display name
                        const getCarrierName = (c: string) => {
                          const lc = c.toLowerCase();
                          if (lc.includes('yamato') || lc.includes('クロネコ')) return 'Yamato Transport (クロネコヤマト)';
                          if (lc.includes('sagawa') || lc.includes('佐川')) return 'Sagawa Express (佐川急便)';
                          if (lc.includes('japan post') || lc.includes('ゆうパック') || lc.includes('post')) return 'Japan Post (日本郵便)';
                          if (lc.includes('fukutsu') || lc.includes('福通')) return 'Fukutsu Express (福山通運)';
                          return c;
                        };
                        
                        // Always reconstruct the tracking URL with latest format
                        const getTrackingUrl = (c: string, tn: string) => {
                          const lc = c.toLowerCase();
                          if (lc.includes('yamato') || lc.includes('クロネコ')) return `https://toi.kuronekoyamato.co.jp/cgi-bin/tneko?number00=1&number01=${tn}`;
                          if (lc.includes('sagawa') || lc.includes('佐川')) return `https://k2k.sagawa-exp.co.jp/p/web/okurijosearch.do?okurijoNo=${tn}`;
                          if (lc.includes('japan post') || lc.includes('ゆうパック') || lc.includes('post')) return `https://trackings.post.japanpost.jp/services/srv/search/direct?reqCodeNo1=${tn}&locale=ja`;
                          if (lc.includes('fukutsu') || lc.includes('福通')) return `https://corp.fukutsu.co.jp/situation/tracking_no_hunt.html?tracking_no=${tn}`;
                          return '';
                        };
                        
                        const carrierName = getCarrierName(carrierRaw);
                        // Always reconstruct the URL to ensure latest format is used
                        const trackingUrl = getTrackingUrl(carrierRaw, trackingNumber) || savedUrl;
                        
                        return (
                          <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                            <div className="flex items-center gap-2 mb-1">
                              <Package className="w-4 h-4 text-blue-600" />
                              <span className="text-sm font-semibold text-blue-800 dark:text-blue-200">Rastreamento</span>
                            </div>
                            <p className="text-sm text-blue-700 dark:text-blue-300 font-mono">
                              Código: {trackingNumber}
                            </p>
                            {carrierName && (
                              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                                Transportadora: {carrierName}
                              </p>
                            )}
                            {trackingUrl && (
                              <a
                                href={trackingUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 mt-2 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                              >
                                🔍 Rastrear Pedido
                              </a>
                            )}
                          </div>
                        );
                      })()}

                      <div className="space-y-2">
                        {order.items.map((item, idx) => {
                          const pid = findProductId(item.productName);
                          const reviewed = pid && user ? !reviewService.canUserReview(user.id, pid) : false;
                          void reviewBump; // dependência p/ recalcular após avaliar
                          return (
                            <div key={idx} className="flex justify-between items-center gap-2 text-sm">
                              <span className="text-muted-foreground flex-1 min-w-0">
                                {item.productName} ({item.size}) × {item.quantity}
                              </span>
                              {pid && (
                                reviewed ? (
                                  <span className="text-[11px] text-green-600 font-semibold flex items-center gap-1 shrink-0">
                                    <Star className="w-3.5 h-3.5 fill-green-600" /> Avaliado
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => setReviewTarget({ id: pid, name: item.productName })}
                                    className="text-[11px] font-semibold text-primary border border-primary/30 rounded-full px-2.5 py-1 hover:bg-primary/5 flex items-center gap-1 shrink-0"
                                  >
                                    <Star className="w-3.5 h-3.5" /> Avaliar
                                  </button>
                                )
                              )}
                              <span className="font-medium shrink-0">¥{(item.price * item.quantity).toLocaleString()}</span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Order breakdown: subtotal, coupon, shipping, total */}
                      {(() => {
                        const itemsSubtotal = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
                        const discount = (order as any).couponDiscount || (itemsSubtotal > order.totalAmount ? itemsSubtotal - order.totalAmount : 0);
                        const shippingData = (order as any).shipping;
                        const shippingCost = shippingData?.cost ?? null;
                        const carrierName = shippingData?.carrier || '';
                        const couponCode = (order as any).couponCode || (order as any).appliedCoupon?.code || '';
                        
                        return (
                          <div className="mt-2 pt-2 border-t border-border space-y-1 text-sm">
                            <div className="flex justify-between text-muted-foreground">
                              <span>Subtotal</span>
                              <span>¥{itemsSubtotal.toLocaleString()}</span>
                            </div>
                            {discount > 0 && (
                              <div className="flex justify-between text-green-600">
                                <span className="flex items-center gap-1">
                                  <Tag className="w-3 h-3" />
                                  Cupom {couponCode && <span className="font-mono text-xs">({couponCode})</span>}
                                </span>
                                <span>-¥{discount.toLocaleString()}</span>
                              </div>
                            )}
                            {shippingCost != null && (
                              <div className="flex justify-between text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Truck className="w-3 h-3" />
                                  Frete {carrierName && <span className="text-xs">({carrierName})</span>}
                                </span>
                                <span>{shippingCost === 0 ? <span className="text-green-600">Grátis</span> : `¥${shippingCost.toLocaleString()}`}</span>
                              </div>
                            )}
                            <div className="flex justify-between font-semibold pt-1 border-t border-border">
                              <span>Total</span>
                              <span className="text-primary">¥{order.totalAmount.toLocaleString()}</span>
                            </div>
                          </div>
                        );
                      })()}

                      <div className="mt-3 pt-3 border-t border-border">
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-muted-foreground">
                            <Package className="w-3 h-3 inline mr-1" />
                            Pagamento: {order.paymentMethod === 'bank' ? 'Depósito Bancário' : 'PayPay'}
                          </p>
                          <Button
                            onClick={() => handleReorder(order)}
                            variant="outline"
                            size="sm"
                            className="gap-2 text-primary hover:bg-primary/10"
                          >
                            <RotateCcw className="w-3 h-3" />
                            Comprar Novamente
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-20 h-20 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4">
                    <ShoppingBag className="w-10 h-10 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground mb-2">
                    Você ainda não fez nenhuma compra
                  </p>
                  <Button 
                    className="btn-primary mt-4"
                    onClick={() => navigate('/produtos')}
                  >
                    Começar a Comprar
                    <ShoppingBag className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              )}
            </div>

            {/* Logout Button */}
            <div className="flex justify-center pt-6">
              <Button 
                variant="outline" 
                onClick={handleLogout}
                className="text-destructive hover:bg-destructive/10"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sair da Conta
              </Button>
            </div>
          </div>
        </div>
      </section>

      {reviewTarget && (
        <ReviewModal
          productId={reviewTarget.id}
          productName={reviewTarget.name}
          onClose={() => setReviewTarget(null)}
          onDone={() => setReviewBump((n) => n + 1)}
        />
      )}
    </Layout>
  );
};

export default Profile;
