import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Mail, Phone, MapPin, Calendar, Gift, ShoppingBag, Edit2, LogOut, Package } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useUser, UserProfile } from '@/context/UserContext';
import { useToast } from '@/hooks/use-toast';
import { prefectures } from '@/data/prefectures';
import { addAddressHints } from '@/utils/romanize';

const Profile: React.FC = () => {
  const { user, isAuthenticated, coupons, orders, updateProfile, logout } = useUser();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editedUser, setEditedUser] = useState<Partial<UserProfile>>(user || {});

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
      setEditedUser(prev => ({ ...prev, [name]: value }));
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
          const prefectureDisplay = prefecture 
            ? `${result.address1} (${prefecture.name})` 
            : result.address1;
          
          // Adiciona hints de leitura para cidade e bairro separadamente
          const city = addAddressHints(result.address2);
          const neighborhood = result.address3 ? addAddressHints(result.address3) : '';
          const cityDisplay = neighborhood ? `${city} ${neighborhood}` : city;
          
          setEditedUser(prev => ({
            ...prev,
            address: {
              ...prev.address,
              postalCode: formatted,
              prefecture: prefectureDisplay,
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
    updateProfile(editedUser);
    setIsEditing(false);
    toast({
      title: "Perfil atualizado!",
      description: "Suas informações foram salvas com sucesso.",
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
                    <Input
                      id="prefecture"
                      name="address.prefecture"
                      value={editedUser.address?.prefecture || ''}
                      onChange={handleInputChange}
                      readOnly
                      className="bg-secondary/50"
                    />
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
                      {user.address.prefecture} {user.address.city}<br />
                      {user.address.address}
                      {user.address.building && <><br />{user.address.building}</>}
                    </p>
                  </div>
                </div>
              )}
            </div>

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
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <ShoppingBag className="w-5 h-5 text-primary" />
                </div>
                <h2 className="font-display text-2xl font-semibold text-foreground">
                  Histórico de Compras
                </h2>
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
                            order.status === 'confirmed' ? 'bg-yellow-100 text-yellow-800' :
                            order.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {order.status === 'delivered' ? 'Entregue' :
                             order.status === 'shipped' ? 'Enviado' :
                             order.status === 'confirmed' ? 'Confirmado' :
                             order.status === 'cancelled' ? 'Cancelado' : 'Pendente'}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between text-sm">
                            <span className="text-muted-foreground">
                              {item.productName} ({item.size}) × {item.quantity}
                            </span>
                            <span className="font-medium">¥{item.price.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>

                      <div className="mt-3 pt-3 border-t border-border">
                        <p className="text-xs text-muted-foreground">
                          <Package className="w-3 h-3 inline mr-1" />
                          Pagamento: {order.paymentMethod === 'bank' ? 'Depósito Bancário' : 'PayPay'}
                        </p>
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
    </Layout>
  );
};

export default Profile;
