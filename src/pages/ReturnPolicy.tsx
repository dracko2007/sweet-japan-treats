import React from 'react';
import Layout from '@/components/layout/Layout';
import { ShieldCheck, AlertTriangle, PackageCheck, Truck, XCircle, Mail } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

type Lang = 'pt' | 'en' | 'ja';

const C: Record<Lang, {
  title: string; updated: string;
  highlightStrong: string; highlight: string;
  s1Title: string; s1: string[];
  s2Title: string; s2: string[];
  s3Title: string; s3: string[];
  s4Title: string; s4: string[];
  s5Title: string; s5: string;
  s6Title: string; s6Pre: string; s6Or: string; s6Post: string;
}> = {
  pt: {
    title: 'Política de Devolução',
    updated: 'Última atualização: junho de 2025',
    highlightStrong: 'Importante:',
    highlight: ' por se tratar de produtos importados do Japão, a devolução só é aceita com o produto totalmente lacrado e intacto. O frete de devolução é por conta do cliente em caso de desistência, e o reembolso é feito somente após a confirmação de que o produto chegou sem qualquer violação.',
    s1Title: '1. Condições para devolução',
    s1: [
      'O produto deve estar completamente lacrado, na embalagem original, sem qualquer sinal de uso.',
      'A caixa/embalagem não pode apresentar nenhuma violação (lacres, selos ou plásticos rompidos).',
      'Produtos abertos, usados, sem lacre ou com a embalagem violada não são elegíveis para devolução.',
      'A solicitação deve ser feita em até 7 dias corridos após o recebimento do pedido.',
    ],
    s2Title: '2. Frete de devolução',
    s2: [
      'Em caso de desistência do produto, o frete de devolução é por conta do cliente.',
      'O envio de retorno deve ser feito com rastreamento, para garantir a comprovação da devolução.',
      'A Japan Express não se responsabiliza por extravios ou danos durante o transporte de retorno.',
    ],
    s3Title: '3. Processo de reembolso',
    s3: [
      'O reembolso é processado somente após o recebimento e a conferência do produto devolvido.',
      'Confirmamos se o produto está intacto e lacrado antes de autorizar o reembolso.',
      'Caso seja constatada qualquer violação da caixa ou do lacre, o reembolso não será realizado e o produto poderá ser devolvido ao cliente às suas custas.',
      'Aprovado o reembolso, o valor é estornado pelo mesmo meio de pagamento utilizado na compra, em até 10 dias úteis.',
    ],
    s4Title: '4. Valores não reembolsáveis',
    s4: [
      'A taxa de PS (Personal Shopper / serviço de compra) não é reembolsável em nenhuma hipótese.',
      'O frete de envio original do pedido não é reembolsado em caso de desistência.',
      'Impostos e taxas alfandegárias já pagos no destino não são reembolsáveis.',
    ],
    s5Title: '5. Produtos com defeito ou avaria de transporte',
    s5: 'Caso o produto chegue com defeito de fabricação ou avaria causada no transporte, entre em contato em até 48 horas após o recebimento, com fotos e vídeo do produto e da embalagem. Avaliaremos cada caso individualmente para reenvio ou reembolso, sem custo de frete para o cliente quando a responsabilidade for nossa.',
    s6Title: '6. Como solicitar',
    s6Pre: 'Para iniciar uma devolução, entre em contato pelo WhatsApp ',
    s6Or: ' ou pelo e-mail ',
    s6Post: ' informando o número do pedido e o motivo da devolução. Nossa equipe orientará o passo a passo.',
  },
  en: {
    title: 'Return Policy',
    updated: 'Last updated: June 2025',
    highlightStrong: 'Important:',
    highlight: ' as these are products imported from Japan, returns are only accepted when the product is fully sealed and intact. Return shipping is the customer’s responsibility in case of withdrawal, and refunds are issued only after we confirm the product arrived without any tampering.',
    s1Title: '1. Return conditions',
    s1: [
      'The product must be completely sealed, in its original packaging, with no signs of use.',
      'The box/packaging must show no tampering (broken seals, stamps, or plastic wrap).',
      'Opened, used, unsealed products or those with tampered packaging are not eligible for return.',
      'Requests must be made within 7 calendar days after receiving the order.',
    ],
    s2Title: '2. Return shipping',
    s2: [
      'In case of withdrawal, return shipping is the customer’s responsibility.',
      'The return must be shipped with tracking to ensure proof of the return.',
      'Japan Express is not responsible for loss or damage during the return transport.',
    ],
    s3Title: '3. Refund process',
    s3: [
      'Refunds are processed only after we receive and inspect the returned product.',
      'We verify that the product is intact and sealed before authorizing the refund.',
      'If any tampering of the box or seal is found, the refund will not be issued and the product may be returned to the customer at their expense.',
      'Once approved, the refund is issued via the same payment method used for the purchase, within 10 business days.',
    ],
    s4Title: '4. Non-refundable amounts',
    s4: [
      'The PS fee (Personal Shopper / purchasing service) is non-refundable under any circumstances.',
      'The original shipping cost of the order is not refunded in case of withdrawal.',
      'Customs duties and taxes already paid at the destination are non-refundable.',
    ],
    s5Title: '5. Defective products or transport damage',
    s5: 'If the product arrives with a manufacturing defect or transport damage, contact us within 48 hours of receipt with photos and video of the product and packaging. We will assess each case individually for reshipment or refund, with no shipping cost to the customer when the responsibility is ours.',
    s6Title: '6. How to request',
    s6Pre: 'To start a return, contact us via WhatsApp ',
    s6Or: ' or by email ',
    s6Post: ' with your order number and the reason for the return. Our team will guide you through the steps.',
  },
  ja: {
    title: '返品ポリシー',
    updated: '最終更新：2025年6月',
    highlightStrong: 'ご注意：',
    highlight: '日本からの輸入商品のため、返品は商品が完全に未開封・未使用の状態である場合のみ受け付けます。お客様都合による返品の送料はお客様のご負担となり、返金は商品に開封・破損がないことを確認した後に行われます。',
    s1Title: '1. 返品の条件',
    s1: [
      '商品は完全に未開封で、使用された形跡がなく、元の梱包のままである必要があります。',
      '箱・梱包に開封の痕跡（封・シール・フィルムの破損など）がないこと。',
      '開封済み・使用済み・未封または梱包が破損した商品は返品の対象外です。',
      'ご返品のご依頼は、商品到着後7日以内にお願いいたします。',
    ],
    s2Title: '2. 返品の送料',
    s2: [
      'お客様都合による返品の場合、返送料はお客様のご負担となります。',
      '返送は追跡付きで行い、返品の証明ができるようにしてください。',
      'Japan Express は返送中の紛失・破損について責任を負いません。',
    ],
    s3Title: '3. 返金の手続き',
    s3: [
      '返金は、返品商品の受領および検品が完了した後にのみ処理されます。',
      '返金を承認する前に、商品が未開封・未使用であることを確認します。',
      '箱や封に開封・破損が確認された場合、返金は行われず、商品はお客様のご負担で返送される場合があります。',
      '返金が承認された場合、ご購入時と同じ支払方法で、10営業日以内に返金されます。',
    ],
    s4Title: '4. 返金されない費用',
    s4: [
      'PS手数料（パーソナルショッパー／購入代行サービス）はいかなる場合も返金されません。',
      'ご注文時の送料は、お客様都合による返品の場合は返金されません。',
      '到着地ですでに支払われた関税・税金は返金されません。',
    ],
    s5Title: '5. 不良品または配送中の破損',
    s5: '商品に製造上の不良または配送中の破損があった場合は、到着後48時間以内に、商品と梱包の写真・動画を添えてご連絡ください。当社の責任による場合は、お客様に送料のご負担なく、再送または返金として個別に対応いたします。',
    s6Title: '6. お申し込み方法',
    s6Pre: '返品をご希望の場合は、WhatsApp ',
    s6Or: ' またはメール ',
    s6Post: ' まで、ご注文番号と返品理由をお知らせください。担当者が手順をご案内いたします。',
  },
};

const ReturnPolicy: React.FC = () => {
  const { language } = useLanguage();
  const lang: Lang = (['pt', 'en', 'ja'].includes(language) ? language : 'pt') as Lang;
  const c = C[lang];

  return (
    <Layout>
      <div className="py-12 bg-background">
        <div className="container mx-auto px-4 max-w-3xl">
          <h1 className="font-display text-4xl font-bold text-foreground mb-2">{c.title}</h1>
          <p className="text-muted-foreground text-sm mb-10">{c.updated}</p>

          {/* Resumo em destaque */}
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-800 rounded-xl p-5 mb-10 flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800 dark:text-amber-300 leading-relaxed">
              <strong>{c.highlightStrong}</strong>{c.highlight}
            </div>
          </div>

          <div className="prose prose-gray max-w-none space-y-8 text-foreground/80 leading-relaxed">

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3 flex items-center gap-2">
                <PackageCheck className="w-5 h-5 text-primary" /> {c.s1Title}
              </h2>
              <ul className="list-disc pl-6 space-y-2">
                {c.s1.map((li, i) => <li key={i}>{li}</li>)}
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3 flex items-center gap-2">
                <Truck className="w-5 h-5 text-primary" /> {c.s2Title}
              </h2>
              <ul className="list-disc pl-6 space-y-2">
                {c.s2.map((li, i) => <li key={i}>{li}</li>)}
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-primary" /> {c.s3Title}
              </h2>
              <ul className="list-disc pl-6 space-y-2">
                {c.s3.map((li, i) => <li key={i}>{li}</li>)}
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3 flex items-center gap-2">
                <XCircle className="w-5 h-5 text-red-500" /> {c.s4Title}
              </h2>
              <ul className="list-disc pl-6 space-y-2">
                {c.s4.map((li, i) => <li key={i}>{li}</li>)}
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">{c.s5Title}</h2>
              <p>{c.s5}</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3 flex items-center gap-2">
                <Mail className="w-5 h-5 text-primary" /> {c.s6Title}
              </h2>
              <p>
                {c.s6Pre}<strong>070-1367-1679</strong>{c.s6Or}
                <a href="mailto:contato@japanexpress-store.com" className="text-primary hover:underline">
                  contato@japanexpress-store.com
                </a>
                {c.s6Post}
              </p>
            </section>

          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ReturnPolicy;
