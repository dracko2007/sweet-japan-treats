import React from 'react';
import Layout from '@/components/layout/Layout';
import { ShieldCheck, AlertTriangle, PackageCheck, Truck, XCircle, Mail } from 'lucide-react';

const ReturnPolicy: React.FC = () => (
  <Layout>
    <div className="py-12 bg-background">
      <div className="container mx-auto px-4 max-w-3xl">
        <h1 className="font-display text-4xl font-bold text-foreground mb-2">Política de Devolução</h1>
        <p className="text-muted-foreground text-sm mb-10">Última atualização: junho de 2025</p>

        {/* Resumo em destaque */}
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-800 rounded-xl p-5 mb-10 flex items-start gap-3">
          <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800 dark:text-amber-300 leading-relaxed">
            <strong>Importante:</strong> por se tratar de produtos importados do Japão, a devolução só é
            aceita com o produto <strong>totalmente lacrado e intacto</strong>. O frete de devolução é
            por conta do cliente em caso de desistência, e o reembolso é feito somente após a
            confirmação de que o produto chegou sem qualquer violação.
          </div>
        </div>

        <div className="prose prose-gray max-w-none space-y-8 text-foreground/80 leading-relaxed">

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3 flex items-center gap-2">
              <PackageCheck className="w-5 h-5 text-primary" /> 1. Condições para devolução
            </h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>O produto deve estar <strong>completamente lacrado</strong>, na embalagem original, sem qualquer sinal de uso.</li>
              <li>A caixa/embalagem não pode apresentar <strong>nenhuma violação</strong> (lacres, selos ou plásticos rompidos).</li>
              <li>Produtos abertos, usados, sem lacre ou com a embalagem violada <strong>não são elegíveis</strong> para devolução.</li>
              <li>A solicitação deve ser feita em até <strong>7 dias corridos</strong> após o recebimento do pedido.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3 flex items-center gap-2">
              <Truck className="w-5 h-5 text-primary" /> 2. Frete de devolução
            </h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Em caso de <strong>desistência do produto</strong>, o frete de devolução é <strong>por conta do cliente</strong>.</li>
              <li>O envio de retorno deve ser feito com rastreamento, para garantir a comprovação da devolução.</li>
              <li>A Japan Express não se responsabiliza por extravios ou danos durante o transporte de retorno.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" /> 3. Processo de reembolso
            </h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>O reembolso é processado <strong>somente após o recebimento e a conferência</strong> do produto devolvido.</li>
              <li>Confirmamos se o produto está <strong>intacto e lacrado</strong> antes de autorizar o reembolso.</li>
              <li>Caso seja constatada <strong>qualquer violação da caixa ou do lacre</strong>, o reembolso <strong>não será realizado</strong> e o produto poderá ser devolvido ao cliente às suas custas.</li>
              <li>Aprovado o reembolso, o valor é estornado pelo mesmo meio de pagamento utilizado na compra, em até 10 dias úteis.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3 flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-500" /> 4. Valores não reembolsáveis
            </h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>A <strong>taxa de PS (Personal Shopper / serviço de compra)</strong> não é reembolsável em nenhuma hipótese.</li>
              <li>O <strong>frete de envio</strong> original do pedido não é reembolsado em caso de desistência.</li>
              <li>Impostos e taxas alfandegárias já pagos no destino não são reembolsáveis.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">5. Produtos com defeito ou avaria de transporte</h2>
            <p>
              Caso o produto chegue com defeito de fabricação ou avaria causada no transporte,
              entre em contato em até <strong>48 horas</strong> após o recebimento, com fotos e vídeo
              do produto e da embalagem. Avaliaremos cada caso individualmente para reenvio ou
              reembolso, sem custo de frete para o cliente quando a responsabilidade for nossa.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3 flex items-center gap-2">
              <Mail className="w-5 h-5 text-primary" /> 6. Como solicitar
            </h2>
            <p>
              Para iniciar uma devolução, entre em contato pelo WhatsApp{' '}
              <strong>070-1367-1679</strong> ou pelo e-mail{' '}
              <a href="mailto:contato@japanexpress-store.com" className="text-primary hover:underline">
                contato@japanexpress-store.com
              </a>{' '}
              informando o número do pedido e o motivo da devolução. Nossa equipe orientará o passo a passo.
            </p>
          </section>

        </div>
      </div>
    </div>
  </Layout>
);

export default ReturnPolicy;
