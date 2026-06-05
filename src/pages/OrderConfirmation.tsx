import { safeStorage } from '@/utils/storage';
import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CheckCircle, Home, Mail, Printer, Copy, AlertCircle, Smartphone, CreditCard, FileText, Landmark, Wallet, ExternalLink } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { QRCodeSVG } from 'qrcode.react';
import { formatPrice } from '@/utils/currency';
import { paymentSettingsService } from '@/services/paymentSettingsService';
import DemoBanner from '@/components/DemoBanner';

const OrderConfirmation: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const order = location.state?.order;
  
  const [pixTimeLeft, setPixTimeLeft] = useState(600); // 10 minutes for PIX
  const [pixStatus, setPixStatus] = useState<'pending' | 'loading' | 'success'>('pending');
  const [copied, setCopied] = useState(false);
  const [cardData, setCardData] = useState({ number: '', name: '', expiry: '', cvv: '' });
  const [cardStatus, setCardStatus] = useState<'idle' | 'processing' | 'success'>('idle');
  const [wiseLink, setWiseLink] = useState('');

  useEffect(() => {
    if (order?.paymentMethod === 'wise') {
      paymentSettingsService.get().then((s) => setWiseLink(s.wiseLink || ''));
    }
  }, [order]);

  // Redirect if no order data is received
  useEffect(() => {
    if (!order) {
      navigate('/', { replace: true });
    }
  }, [order, navigate]);

  // PIX Countdown Timer
  useEffect(() => {
    if (order?.paymentMethod !== 'pix' || pixStatus === 'success') return;

    const interval = setInterval(() => {
      setPixTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [order, pixStatus]);

  // Simulate PIX Automatic Payment Detection (after 8 seconds)
  useEffect(() => {
    if (order?.paymentMethod !== 'pix' || pixStatus !== 'pending') return;

    const timer = setTimeout(() => {
      setPixStatus('loading');
      setTimeout(() => {
        setPixStatus('success');
        
        // Update order status in safeStorage to 'Pago'
        const existingOrders = JSON.parse(safeStorage.getItem('sakura_orders') || '[]');
        const updatedOrders = existingOrders.map((o: any) => {
          if (o.id === order.id) {
            return { ...o, status: 'Pago' };
          }
          return o;
        });
        safeStorage.setItem('sakura_orders', JSON.stringify(updatedOrders));

        toast({
          title: "Pagamento Aprovado! 🎉",
          description: "Seu PIX foi identificado e o pedido foi enviado para o centro logístico de Tóquio.",
        });
      }, 2000);
    }, 8000);

    return () => clearTimeout(timer);
  }, [order, pixStatus, toast]);

  if (!order) return null;

  // Format PIX Payload Code
  const pixPayload = `00020101021226870014br.gov.bcb.pix25800263600020000000000000000000000000000000000000000000000000000000000000000000000053039865405${order.total.toFixed(2)}5802BR5914Japan Express6009Sao Paulo62070503***6304`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(pixPayload);
    setCopied(true);
    toast({
      title: "Chave PIX Copiada!",
      description: "Código copiado para a área de transferência.",
    });
    setTimeout(() => setCopied(false), 3000);
  };

  const handleCardPay = (e: React.FormEvent) => {
    e.preventDefault();
    setCardStatus('processing');
    
    setTimeout(() => {
      setCardStatus('success');
      
      // Update order status in safeStorage to 'Pago'
      const existingOrders = JSON.parse(safeStorage.getItem('sakura_orders') || '[]');
      const updatedOrders = existingOrders.map((o: any) => {
        if (o.id === order.id) {
          return { ...o, status: 'Pago' };
        }
        return o;
      });
      safeStorage.setItem('sakura_orders', JSON.stringify(updatedOrders));

      toast({
        title: "Transação Aprovada! 💳",
        description: "Seu pagamento foi confirmado pela operadora e enviado para Tóquio.",
      });
    }, 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  // Timer Formatting
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Layout>
      <section className="py-12 bg-background min-h-screen">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">

            {/* Aviso de modo demonstração */}
            <DemoBanner className="mb-6 print:hidden" />

            {/* Header Success Message */}
            <div className="text-center mb-8 print:hidden">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                <CheckCircle className="w-12 h-12 text-green-600" />
              </div>
              <h1 className="font-display text-4xl font-extrabold text-gray-900 mb-2">
                {order.currency === 'JPY' ? 'Pedido Confirmado! 🎉' : 'Pedido Gerado!'}
              </h1>
              <p className="text-lg text-muted-foreground mb-2">
                ID do pedido: <span className="font-mono font-semibold text-gray-900">{order.orderNumber || order.id}</span>
              </p>
              <p className="text-muted-foreground text-sm">
                Obrigado por comprar na Japan Express. Realize o pagamento para iniciar o preparo e envio de Hiroshima.
              </p>
            </div>

            {/* PAYMENT SCREENS */}

            {/* PAYPAY SCREEN */}
            {order.paymentMethod === 'paypay' && (
              <div className="bg-white rounded-3xl border-2 border-orange-500 p-6 mb-8 shadow-md print:hidden text-center space-y-4 animate-fade-in">
                <div className="flex items-center justify-center gap-2 text-orange-600 font-extrabold text-lg">
                  <Smartphone className="w-6 h-6 animate-pulse" />
                  <span>ÁREA DE PAGAMENTO PAYPAY</span>
                </div>

                <div className="bg-red-50 text-red-700 text-xs font-semibold px-4 py-3 rounded-xl inline-flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Abra o app PayPay, escaneie o QR Code e realize o pagamento no valor exato.</span>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 inline-block shadow-sm">
                  <img 
                    src="/products/paypay-qr.png" 
                    alt="PayPay QR Code - Japan Express" 
                    className="w-60 h-auto rounded-xl border border-gray-200 mx-auto shadow-md"
                    onError={(e) => {
                      e.currentTarget.src = "https://placehold.co/240x240/red/white?text=PayPay+QR";
                    }}
                  />
                  <p className="text-[10px] text-gray-400 mt-2 font-mono">
                    Escaneie com o app do PayPay
                  </p>
                </div>

                <div className="bg-gray-100 p-4 rounded-xl max-w-sm mx-auto text-xs space-y-2 font-mono text-left">
                  <p><strong className="text-gray-800">Enviar para:</strong> Japan Express</p>
                  <p><strong className="text-gray-800">Telefone:</strong> 070-1367-1679</p>
                  <p><strong className="text-gray-800">Valor do Pedido:</strong> {formatPrice(order.total, 'JPY')}</p>
                </div>

                <div className="pt-2 text-xs text-muted-foreground leading-relaxed max-w-md mx-auto">
                  Após concluir a transferência, por favor envie o comprovante (print de tela) para o WhatsApp: <strong className="text-gray-800">070-1367-1679</strong>. Seu pedido será liberado no mesmo dia!
                </div>
              </div>
            )}

            {/* YUCHO SCREEN */}
            {order.paymentMethod === 'yucho' && (
              <div className="bg-white rounded-3xl border-2 border-orange-500 p-6 mb-8 shadow-md print:hidden space-y-4 animate-fade-in">
                <div className="flex items-center justify-center gap-2 text-orange-600 font-extrabold text-lg">
                  <Landmark className="w-6 h-6" />
                  <span>DEPÓSITO BANCÁRIO (Yucho Bank / ゆうちょ銀行)</span>
                </div>

                <div className="bg-yellow-50 text-yellow-700 text-xs font-semibold px-4 py-3 rounded-xl inline-flex items-center gap-2 border border-yellow-200">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Por favor, realize a transferência e nos envie o comprovante pelo WhatsApp (070-1367-1679).</span>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 max-w-md mx-auto space-y-3 font-mono text-xs md:text-sm text-left">
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-gray-500">Banco:</span>
                    <span className="font-bold text-gray-800">ゆうちょ銀行 (Japan Post Bank)</span>
                  </div>
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-gray-500">記号 (Kigou):</span>
                    <span className="font-bold text-gray-800">12260</span>
                  </div>
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-gray-500">番号 (Bangou):</span>
                    <span className="font-bold text-gray-800">33664351</span>
                  </div>
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-gray-500">Nome:</span>
                    <span className="font-bold text-gray-800">ロドリゲス シオカワ ミリアン パウラ</span>
                  </div>
                  
                  <div className="pt-3 border-t border-dashed text-[10px] text-gray-500 space-y-1">
                    <p className="font-bold">Para transferência de outros bancos (振込用):</p>
                    <p>金融機関コード (Cód. Banco): <strong className="text-gray-700">9900</strong></p>
                    <p>店名 (Agência): <strong className="text-gray-700">二二八店 (228)</strong></p>
                    <p>口座番号 (Nº Conta): <strong className="text-gray-700">3366435</strong> (普通)</p>
                  </div>
                </div>

                <div className="pt-2 text-xs text-muted-foreground leading-relaxed max-w-md mx-auto text-center">
                  Após o depósito, envie uma foto do comprovante para o WhatsApp: <strong className="text-gray-800">070-1367-1679</strong>.
                </div>
              </div>
            )}

            {/* PIX SCREEN */}
            {order.paymentMethod === 'pix' && (
              <div className="bg-white rounded-3xl border-2 border-orange-500 p-6 mb-8 shadow-md print:hidden text-center space-y-4">
                <div className="flex items-center justify-center gap-2 text-orange-600 font-extrabold text-lg">
                  <Smartphone className="w-6 h-6 animate-pulse" />
                  <span>ÁREA DE PAGAMENTO PIX</span>
                </div>

                {pixStatus === 'pending' && (
                  <div className="space-y-4">
                    <div className="bg-red-50 text-red-700 text-xs font-semibold px-4 py-3 rounded-xl inline-flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>Seu pedido será cancelado se o PIX não for pago em {formatTime(pixTimeLeft)}</span>
                    </div>

                    <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 inline-block shadow-sm">
                      <QRCodeSVG value={pixPayload} size={200} includeMargin={true} />
                    </div>

                    <div className="max-w-md mx-auto space-y-2">
                      <p className="text-xs text-gray-500 font-bold uppercase">Chave Copia e Cola:</p>
                      <div className="flex border border-gray-300 rounded-xl overflow-hidden shadow-sm bg-gray-50">
                        <input
                          type="text"
                          readOnly
                          value={pixPayload}
                          className="flex-1 px-3 py-2 text-xs font-mono text-gray-500 bg-transparent select-all outline-none"
                        />
                        <button
                          onClick={copyToClipboard}
                          className="bg-orange-500 hover:bg-orange-600 text-white px-4 flex items-center justify-center gap-1.5 transition-all text-xs font-bold"
                        >
                          <Copy className="w-4 h-4" />
                          {copied ? 'Copiado!' : 'Copiar'}
                        </button>
                      </div>
                    </div>

                    <div className="pt-2 flex flex-col items-center justify-center">
                      <div className="animate-spin rounded-full h-5 h-5 border-2 border-orange-500 border-t-transparent mb-2"></div>
                      <p className="text-xs text-orange-600 font-bold animate-pulse">
                        Aguardando pagamento... (Simulador ativo)
                      </p>
                    </div>
                  </div>
                )}

                {pixStatus === 'loading' && (
                  <div className="py-8 space-y-3">
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-500 border-t-transparent mx-auto"></div>
                    <p className="text-sm font-bold text-orange-600">Verificando recebimento do PIX...</p>
                  </div>
                )}

                {pixStatus === 'success' && (
                  <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center space-y-3 animate-fade-in">
                    <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center text-white mx-auto">
                      ✓
                    </div>
                    <h3 className="font-sans font-bold text-lg text-green-800">Pagamento PIX Confirmado!</h3>
                    <p className="text-xs text-green-700 max-w-sm mx-auto leading-relaxed">
                      Seu pagamento foi aprovado instantaneamente. Seu pacote já está em processo de separação e rotulagem no porto de Tóquio. Rastreio: <strong>{order.trackingCode}</strong>.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* CREDIT CARD SCREEN */}
            {order.paymentMethod === 'card' && (
              <div className="bg-white rounded-3xl border-2 border-orange-500 p-6 mb-8 shadow-md print:hidden space-y-4">
                <div className="flex items-center gap-2 text-orange-600 font-extrabold text-lg justify-center">
                  <CreditCard className="w-6 h-6" />
                  <span>PAGAMENTO VIA CARTÃO DE CRÉDITO</span>
                </div>

                {cardStatus === 'idle' && (
                  <form onSubmit={handleCardPay} className="space-y-4 max-w-md mx-auto pt-2">
                    <div className="space-y-1">
                      <Label htmlFor="cardNumber" className="text-xs font-bold text-gray-500">Número do Cartão *</Label>
                      <Input
                        id="cardNumber"
                        type="text"
                        placeholder="4512 3456 7890 1234"
                        required
                        value={cardData.number}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 16);
                          const formatted = val.replace(/(.{4})/g, '$1 ').trim();
                          setCardData(prev => ({ ...prev, number: formatted }));
                        }}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="cardName" className="text-xs font-bold text-gray-500">Nome do Titular *</Label>
                      <Input
                        id="cardName"
                        type="text"
                        placeholder="Nome como impresso no cartão"
                        required
                        value={cardData.name}
                        onChange={(e) => setCardData(prev => ({ ...prev, name: e.target.value.toUpperCase() }))}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label htmlFor="cardExpiry" className="text-xs font-bold text-gray-500">Validade *</Label>
                        <Input
                          id="cardExpiry"
                          type="text"
                          placeholder="MM/AA"
                          required
                          value={cardData.expiry}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                            const formatted = val.length > 2 ? `${val.slice(0, 2)}/${val.slice(2, 4)}` : val;
                            setCardData(prev => ({ ...prev, expiry: formatted }));
                          }}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="cardCvv" className="text-xs font-bold text-gray-500">CVV *</Label>
                        <Input
                          id="cardCvv"
                          type="password"
                          placeholder="123"
                          maxLength={3}
                          required
                          value={cardData.cvv}
                          onChange={(e) => setCardData(prev => ({ ...prev, cvv: e.target.value.replace(/\D/g, '') }))}
                        />
                      </div>
                    </div>
                    
                    <button
                      type="submit"
                      className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-md active:scale-95"
                    >
                      Pagar R$ {order.total.toFixed(2)}
                    </button>
                  </form>
                )}

                {cardStatus === 'processing' && (
                  <div className="py-8 text-center space-y-3">
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-500 border-t-transparent mx-auto"></div>
                    <p className="text-sm font-bold text-orange-600">Aprovando transação com a operadora do cartão...</p>
                  </div>
                )}

                {cardStatus === 'success' && (
                  <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center space-y-3 animate-fade-in">
                    <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center text-white mx-auto">
                      ✓
                    </div>
                    <h3 className="font-sans font-bold text-lg text-green-800">Transação de Cartão Aprovada!</h3>
                    <p className="text-xs text-green-700 max-w-sm mx-auto leading-relaxed">
                      Seu pagamento foi confirmado com sucesso. O pedido foi enviado para separação no porto logístico de Tóquio. Rastreamento {order.country === 'Brasil' ? 'dos Correios' : 'Postal'}: <strong>{order.trackingCode}</strong>.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* BOLETO SCREEN */}
            {order.paymentMethod === 'boleto' && (
              <div className="bg-white rounded-3xl border-2 border-orange-500 p-6 mb-8 shadow-md print:hidden text-center space-y-4">
                <div className="flex items-center justify-center gap-2 text-orange-600 font-extrabold text-lg">
                  <FileText className="w-6 h-6" />
                  <span>EMISSÃO DE BOLETO BANCÁRIO</span>
                </div>

                <div className="bg-yellow-50 text-yellow-700 text-xs font-semibold px-4 py-3 rounded-xl inline-flex items-center gap-2 border border-yellow-200">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Boleto vence em 3 dias úteis. Compensação em até 48 horas após o pagamento.</span>
                </div>

                <div className="bg-gray-100 p-6 rounded-2xl max-w-md mx-auto border border-gray-300 font-mono text-xs flex flex-col items-center gap-3">
                  {/* Mock Barcode display */}
                  <div className="w-full h-12 bg-black flex items-center justify-center text-white text-[8px] tracking-[3px] select-none font-sans">
                    ||||| | ||||| | || ||||| | ||||| | || ||||| | ||||| | || ||||| | ||||| 
                  </div>
                  <p className="font-bold text-gray-800 text-[10px]">
                    34191.79001 01043.513184 91020.150008 7 926500000{(order.total * 100).toFixed(0).padStart(6, '0')}
                  </p>
                </div>

                <div className="flex justify-center gap-4">
                  <Button 
                    onClick={() => {
                      navigator.clipboard.writeText(`34191.79001 01043.513184 91020.150008 7 926500000${(order.total * 100).toFixed(0).padStart(6, '0')}`);
                      toast({ title: "Código copiado!", description: "Linha digitável copiada." });
                    }}
                    variant="outline"
                    className="border-2"
                  >
                    Copiar Código de Barras
                  </Button>
                  <Button 
                    onClick={handlePrint}
                    variant="secondary"
                  >
                    Imprimir Boleto
                  </Button>
                </div>
              </div>
            )}

            {order.paymentMethod === 'wise' && (
              <div className="bg-white rounded-3xl border-2 border-emerald-500 p-6 mb-8 shadow-md print:hidden text-center space-y-4">
                <div className="flex items-center justify-center gap-2 text-emerald-600 font-extrabold text-lg">
                  <Wallet className="w-6 h-6" />
                  <span>PAGAMENTO VIA WISE</span>
                </div>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Pague <strong>{formatPrice(order.total, order.currency || 'BRL')}</strong> pelo Wise com câmbio justo. Após pagar, nos envie o comprovante pelo contato informado.
                </p>
                {wiseLink ? (
                  <a
                    href={wiseLink.startsWith('http') ? wiseLink : `https://wise.com/pay/${wiseLink.replace(/^@/, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-3 rounded-xl transition-colors"
                  >
                    <ExternalLink className="w-5 h-5" /> Pagar pelo Wise
                  </a>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    Em instantes enviaremos o link de pagamento Wise pelo seu contato.
                  </p>
                )}
              </div>
            )}

            {/* ORDER CONFIRMATION INVOICE / RECIBO */}
            <div className="bg-card rounded-2xl border border-border p-8 mb-6">
              <div className="text-center mb-6 print:block hidden">
                <h1 className="font-display text-3xl font-bold mb-2">
                  Japan Express
                </h1>
                <p className="text-muted-foreground">
                  {order.currency === 'JPY' ? 'Recibo de Pedido Doméstico' : 'Recibo de Pedido Internacional'}
                </p>
                <p className="font-mono text-sm">Pedido: {order.orderNumber || order.id}</p>
                <p className="text-sm text-muted-foreground">{order.date}</p>
              </div>

              <div className="space-y-6">
                
                {/* Print Title Header */}
                <div className="flex items-center justify-between border-b pb-4">
                  <h3 className="font-sans font-bold text-lg text-foreground">
                    {order.currency === 'JPY' ? 'Comprovante de Compra Local' : 'Comprovante de Importação'}
                  </h3>
                  <Button onClick={handlePrint} variant="ghost" size="sm" className="print:hidden font-semibold">
                    <Printer className="w-4 h-4 mr-2" />
                    Imprimir Comprovante
                  </Button>
                </div>

                {/* Tracking Details */}
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex flex-col md:flex-row justify-between gap-3 text-xs md:text-sm">
                  <div>
                    <span className="text-muted-foreground block">
                      {order.currency === 'JPY' ? 'Código de Rastreamento (Transportadora):' : `Código de Rastreamento Aéreo (${order.country === 'Brasil' ? 'Correios' : 'Posta Local'}):`}
                    </span>
                    <span className="font-mono font-bold text-gray-800 text-base">{order.trackingCode}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-muted-foreground block">Status Logístico:</span>
                    <span className="bg-orange-600 text-white font-extrabold px-2 py-0.5 rounded text-xs uppercase inline-block mt-1">
                      {order.status === 'Pago' || pixStatus === 'success' || cardStatus === 'success'
                        ? (order.currency === 'JPY' ? 'Preparando Envio Doméstico' : 'Aguardando Despacho Aéreo')
                        : 'Aguardando Pagamento'
                      }
                    </span>
                  </div>
                </div>

                {/* Customer Details */}
                <div className="grid md:grid-cols-2 gap-4 text-xs md:text-sm border-b pb-4">
                  <div>
                    <h4 className="font-semibold text-gray-500 uppercase tracking-wider mb-1">Destinatário</h4>
                    <p className="font-bold text-gray-800">{order.name}</p>
                    {order.currency !== 'JPY' && order.cpf && (
                      <p className="text-muted-foreground font-mono mt-0.5">CPF: {order.cpf}</p>
                    )}
                    <p className="text-muted-foreground">Tel: {order.phone}</p>
                    <p className="text-muted-foreground">{order.email}</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-500 uppercase tracking-wider mb-1">Endereço de Entrega</h4>
                    <p className="text-gray-800">〒 {order.postalCode}</p>
                    <p className="text-gray-800">
                      {order.prefecture}, {order.city}
                    </p>
                    <p className="text-gray-800">{order.address}</p>
                    {order.building && <p className="text-gray-500 text-xs">Complemento: {order.building}</p>}
                    <p className="font-bold text-gray-800 mt-1">
                      {order.country || 'Brasil'} {
                        order.country === 'Japão' ? '🇯🇵' :
                        order.country === 'Brasil' ? '🇧🇷' :
                        order.country === 'Portugal' ? '🇵🇹' :
                        order.country === 'França' ? '🇫🇷' :
                        order.country === 'Itália' ? '🇮🇹' :
                        order.country === 'Espanha' ? '🇪🇸' : '🇧🇷'
                      }
                    </p>
                  </div>
                </div>

                {/* Items list */}
                <div>
                  <h4 className="font-semibold text-xs text-gray-500 uppercase tracking-wider mb-2">
                    Itens do Pedido
                  </h4>
                  <div className="space-y-3">
                    {order.items.map((item: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center text-xs md:text-sm border-b border-gray-100 pb-2 last:border-0">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {item.image && (
                            <img src={item.image} alt={item.name} className="w-8 h-8 rounded object-cover border border-gray-100" />
                          )}
                          <div className="truncate">
                            <p className="font-bold text-gray-800 truncate">{item.name}</p>
                            <p className="text-muted-foreground text-[10px]">{item.size} × {item.quantity}</p>
                          </div>
                        </div>
                        <p className="font-bold text-gray-800 shrink-0">
                          {formatPrice(item.price * item.quantity, order.currency || 'BRL')}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Invoice Totals */}
                <div className="border-t pt-4 space-y-2 text-xs md:text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal dos Produtos</span>
                    <span className="font-semibold text-gray-800">
                      {formatPrice(order.subtotal, order.currency || 'BRL')}
                    </span>
                  </div>
                  
                  {order.couponDiscount > 0 && (
                    <div className="flex justify-between text-green-600 font-bold">
                      <span>Desconto do Cupom ({order.couponCode})</span>
                      <span>-{formatPrice(order.couponDiscount, order.currency || 'BRL')}</span>
                    </div>
                  )}

                  {order.currency !== 'JPY' && order.pixDiscount > 0 && (
                    <div className="flex justify-between text-orange-600 font-bold">
                      <span>Desconto Adicional de PIX (5%)</span>
                      <span>-{formatPrice(order.pixDiscount, 'BRL')}</span>
                    </div>
                  )}

                  {order.currency !== 'JPY' && (order.taxAmount > 0 || order.federalTax > 0) && (
                    <div className="bg-orange-50/50 dark:bg-orange-950/10 border border-orange-200/60 rounded-xl p-3 space-y-2 mt-2">
                      <div className="flex justify-between text-xs font-bold text-orange-850 dark:text-orange-300">
                        <span>Imposto Aduaneiro Estimado (A cobrar na entrega)</span>
                        <span>{formatPrice(order.taxAmount || (order.federalTax + order.icmsTax), order.currency)}</span>
                      </div>
                      <p className="text-[10px] text-orange-700 dark:text-orange-400 leading-relaxed font-semibold">
                        ⚠️ <strong>Lembrete:</strong> Este valor é apenas uma estimativa do imposto que poderá ser cobrado pela alfândega local na chegada do pacote ao país de destino. Ele <strong>NÃO</strong> foi somado ao total pago no site.
                      </p>
                    </div>
                  )}

                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {order.currency === 'JPY' ? 'Frete Local' : 'Frete Internacional (Tóquio Hub)'}
                    </span>
                    <span className="font-semibold text-gray-800">
                      {order.shippingCost === 0 ? 'Grátis' : formatPrice(order.shippingCost, order.currency || 'BRL')}
                    </span>
                  </div>

                  <div className="flex justify-between pt-3 border-t font-black text-base md:text-lg">
                    <span>Total Pago / A Pagar</span>
                    <span className="text-xl text-orange-600">
                      {formatPrice(order.total, order.currency || 'BRL')}
                    </span>
                  </div>
                </div>

              </div>
            </div>

            {/* Back Button */}
            <div className="flex gap-4 print:hidden justify-center">
              <Button 
                onClick={() => navigate('/')}
                className="btn-primary rounded-xl py-6 text-base font-bold gap-2 px-8 shadow-md"
              >
                <Home className="w-5 h-5" />
                Voltar à Página Inicial
              </Button>
            </div>

            {/* Simulated Logistics Milestones - Urgency & Trust */}
            <div className="mt-8 bg-gray-50 border border-gray-100 rounded-2xl p-6 print:hidden space-y-4">
              <h3 className="font-bold text-sm text-gray-800 uppercase tracking-wider">
                {order.currency === 'JPY' ? 'Como Acompanhar Sua Entrega Doméstica' : 'Como Acompanhar Sua Importação'}
              </h3>
              <div className="relative pl-6 border-l border-orange-300 space-y-4 text-xs text-muted-foreground">
                
                {order.currency === 'JPY' ? (
                  <>
                    <div className="relative">
                      <div className="absolute -left-[30px] top-0 w-4 h-4 bg-orange-500 rounded-full border-2 border-white flex items-center justify-center text-white text-[8px]">✓</div>
                      <h4 className="font-bold text-gray-800">Etapa 1: Embalagem em Hiroshima (Centro de Distribuição Japan Express)</h4>
                      <p className="mt-0.5">Sua encomenda é conferida, embalada com proteção reforçada e preparada para envio no centro de Hiroshima Prefecture.</p>
                    </div>

                    <div className="relative">
                      <div className="absolute -left-[30px] top-0 w-4 h-4 bg-gray-300 rounded-full border-2 border-white flex items-center justify-center text-white text-[8px]">2</div>
                      <h4 className="font-bold text-gray-700">Etapa 2: Coleta e Despacho Doméstico (Yamato / Sagawa / JP Post)</h4>
                      <p className="mt-0.5">A transportadora local selecionada coleta a encomenda diretamente em nosso centro de distribuição em Hiroshima Prefecture.</p>
                    </div>

                    <div className="relative">
                      <div className="absolute -left-[30px] top-0 w-4 h-4 bg-gray-300 rounded-full border-2 border-white flex items-center justify-center text-white text-[8px]">3</div>
                      <h4 className="font-bold text-gray-700">Etapa 3: Trânsito Expresso entre Províncias</h4>
                      <p className="mt-0.5">Sua encomenda segue via rede expressa rodoviária japonesa para trânsito rápido e seguro até sua província.</p>
                    </div>

                    <div className="relative">
                      <div className="absolute -left-[30px] top-0 w-4 h-4 bg-gray-300 rounded-full border-2 border-white flex items-center justify-center text-white text-[8px]">4</div>
                      <h4 className="font-bold text-gray-700">Etapa 4: Entrega Direta na Residência</h4>
                      <p className="mt-0.5">A transportadora realiza a entrega em mãos no seu endereço no Japão. Use o código para rastrear no site oficial.</p>
                    </div>
                  </>
                ) : order.country === 'Brasil' ? (
                  <>
                    <div className="relative">
                      <div className="absolute -left-[30px] top-0 w-4 h-4 bg-orange-500 rounded-full border-2 border-white flex items-center justify-center text-white text-[8px]">✓</div>
                      <h4 className="font-bold text-gray-800">Etapa 1: Embalagem em Tóquio (Hub Logístico)</h4>
                      <p className="mt-0.5">Após a aprovação do pagamento, seu pedido é inspecionado, embalado com plástico bolha e preparado para despacho aéreo.</p>
                    </div>

                    <div className="relative">
                      <div className="absolute -left-[30px] top-0 w-4 h-4 bg-gray-300 rounded-full border-2 border-white flex items-center justify-center text-white text-[8px]">2</div>
                      <h4 className="font-bold text-gray-700">Etapa 2: Voo Tóquio para São Paulo (GRU)</h4>
                      <p className="mt-0.5">Despacho no aeroporto de Narita (Tóquio) com destino a São Paulo Guarulhos via priority mail express.</p>
                    </div>

                    <div className="relative">
                      <div className="absolute -left-[30px] top-0 w-4 h-4 bg-gray-300 rounded-full border-2 border-white flex items-center justify-center text-white text-[8px]">3</div>
                      <h4 className="font-bold text-gray-700">Etapa 3: Desembaraço Aduaneiro Rápido</h4>
                      <p className="mt-0.5">O pacote passa pela alfândega dos Correios. Por estar no programa Remessa Conforme, o desembaraço ocorre em poucas horas sem taxas adicionais.</p>
                    </div>

                    <div className="relative">
                      <div className="absolute -left-[30px] top-0 w-4 h-4 bg-gray-300 rounded-full border-2 border-white flex items-center justify-center text-white text-[8px]">4</div>
                      <h4 className="font-bold text-gray-700">Etapa 4: Entrega no Seu Endereço</h4>
                      <p className="mt-0.5">Os Correios realizam a entrega direta na sua residência. Rastreie pelo site dos Correios com o código de rastreamento.</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="relative">
                      <div className="absolute -left-[30px] top-0 w-4 h-4 bg-orange-500 rounded-full border-2 border-white flex items-center justify-center text-white text-[8px]">✓</div>
                      <h4 className="font-bold text-gray-800">Etapa 1: Embalagem em Tóquio (Hub Logístico)</h4>
                      <p className="mt-0.5">Após a aprovação do pagamento, seu pedido é inspecionado, embalado com plástico bolha e preparado para despacho aéreo.</p>
                    </div>

                    <div className="relative">
                      <div className="absolute -left-[30px] top-0 w-4 h-4 bg-gray-300 rounded-full border-2 border-white flex items-center justify-center text-white text-[8px]">2</div>
                      <h4 className="font-bold text-gray-700">Etapa 2: Voo Tóquio para Europa</h4>
                      <p className="mt-0.5">Despacho no aeroporto de Narita (Tóquio) com destino ao aeroporto internacional europeu via priority mail express.</p>
                    </div>

                    <div className="relative">
                      <div className="absolute -left-[30px] top-0 w-4 h-4 bg-gray-300 rounded-full border-2 border-white flex items-center justify-center text-white text-[8px]">3</div>
                      <h4 className="font-bold text-gray-700">Etapa 3: Desembaraço Aduaneiro Simplificado</h4>
                      <p className="mt-0.5">O pacote passa pelo processamento e liberação na alfândega do país de destino europeu de forma rápida e simplificada.</p>
                    </div>

                    <div className="relative">
                      <div className="absolute -left-[30px] top-0 w-4 h-4 bg-gray-300 rounded-full border-2 border-white flex items-center justify-center text-white text-[8px]">4</div>
                      <h4 className="font-bold text-gray-700">Etapa 4: Entrega no Seu Endereço</h4>
                      <p className="mt-0.5">A transportadora postal local (como CTT, La Poste, Poste Italiane, Correos) realiza a entrega direta na sua residência.</p>
                    </div>
                  </>
                )}

              </div>
            </div>

          </div>
        </div>
      </section>
    </Layout>
  );
};

export default OrderConfirmation;
