import React from 'react';
import Layout from '@/components/layout/Layout';

const PrivacyPolicy: React.FC = () => (
  <Layout>
    <div className="py-12 bg-background">
      <div className="container mx-auto px-4 max-w-3xl">
        <h1 className="font-display text-4xl font-bold text-foreground mb-2">Política de Privacidade</h1>
        <p className="text-muted-foreground text-sm mb-10">Última atualização: junho de 2025</p>

        <div className="prose prose-gray max-w-none space-y-8 text-foreground/80 leading-relaxed">

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">1. Quem somos</h2>
            <p>
              A <strong>Japan Express</strong> é uma loja de importados do Japão, com sede em Hiroshima, Japão.
              Operamos o site <strong>japanexpress-store.com</strong> e tratamos os dados dos nossos clientes
              com transparência e responsabilidade, em conformidade com a Lei Geral de Proteção de Dados (LGPD —
              Lei nº 13.709/2018).
            </p>
            <p className="mt-2">Contato do responsável pelos dados: <a href="mailto:contato@japanexpress-store.com" className="text-primary hover:underline">contato@japanexpress-store.com</a></p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">2. Quais dados coletamos</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Dados de cadastro:</strong> nome, e-mail e senha (armazenada de forma criptografada).</li>
              <li><strong>Dados de entrega:</strong> endereço, CEP, cidade, estado/prefeitura e telefone.</li>
              <li><strong>Dados de pedido:</strong> produtos comprados, valores, método de pagamento e status.</li>
              <li><strong>Dados de navegação:</strong> páginas visitadas, tempo de sessão e dispositivo — coletados anonimamente pelo Firebase Analytics, somente após seu consentimento via banner de cookies.</li>
            </ul>
            <p className="mt-3">Não coletamos dados de cartão de crédito em nossos servidores. Pagamentos via PIX e PayPay são processados externamente.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">3. Como usamos seus dados</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Processar e entregar seus pedidos.</li>
              <li>Enviar confirmações de pedido e atualizações de rastreamento por e-mail e WhatsApp.</li>
              <li>Melhorar nossos produtos, serviços e experiência no site.</li>
              <li>Cumprir obrigações legais e fiscais.</li>
              <li>Prevenir fraudes e garantir a segurança da plataforma.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">4. Base legal para o tratamento (LGPD)</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Execução de contrato</strong> — para processar pedidos e entregas.</li>
              <li><strong>Consentimento</strong> — para cookies analíticos e marketing.</li>
              <li><strong>Interesse legítimo</strong> — para segurança e prevenção de fraudes.</li>
              <li><strong>Obrigação legal</strong> — para emissão de notas e registros fiscais.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">5. Compartilhamento de dados</h2>
            <p>Seus dados são compartilhados apenas com:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li><strong>Google Firebase</strong> — banco de dados, autenticação e analytics (servidores na UE/EUA com cláusulas contratuais padrão).</li>
              <li><strong>Resend</strong> — plataforma de envio de e-mails transacionais.</li>
              <li><strong>Correios / transportadoras</strong> — para entrega dos pedidos.</li>
            </ul>
            <p className="mt-3">Nunca vendemos seus dados a terceiros.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">6. Seus direitos (LGPD)</h2>
            <p>Você pode, a qualquer momento, solicitar:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>Acesso aos dados que temos sobre você.</li>
              <li>Correção de dados incorretos ou desatualizados.</li>
              <li>Exclusão dos seus dados pessoais.</li>
              <li>Portabilidade dos dados para outro fornecedor.</li>
              <li>Revogação do consentimento para cookies analíticos.</li>
            </ul>
            <p className="mt-3">Para exercer esses direitos, envie um e-mail para <a href="mailto:contato@japanexpress-store.com" className="text-primary hover:underline">contato@japanexpress-store.com</a>. Responderemos em até 15 dias úteis.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">7. Cookies</h2>
            <p>Utilizamos cookies essenciais (necessários para o funcionamento do site) e analíticos (com seu consentimento). Veja nossa <a href="/cookies" className="text-primary hover:underline">Política de Cookies</a> para mais detalhes.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">8. Retenção de dados</h2>
            <p>Mantemos seus dados pelo tempo necessário para cumprir as finalidades descritas nesta política, ou conforme exigido por lei (em geral, 5 anos para registros fiscais). Dados de contas inativas por mais de 2 anos podem ser excluídos.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">9. Segurança</h2>
            <p>Adotamos medidas técnicas e organizacionais para proteger seus dados, incluindo transmissão via HTTPS, autenticação com Firebase e acesso restrito ao painel administrativo.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">10. Alterações nesta política</h2>
            <p>Podemos atualizar esta política periodicamente. Quando houver mudanças relevantes, avisaremos por e-mail ou banner no site. A data de última atualização sempre estará indicada no topo desta página.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">11. Contato</h2>
            <p>Para dúvidas sobre privacidade e proteção de dados:</p>
            <ul className="list-none mt-2 space-y-1">
              <li>📧 <a href="mailto:contato@japanexpress-store.com" className="text-primary hover:underline">contato@japanexpress-store.com</a></li>
              <li>💬 WhatsApp: +81 70-1367-1679</li>
              <li>📍 Hiroshima-ken, Japão</li>
            </ul>
          </section>

        </div>
      </div>
    </div>
  </Layout>
);

export default PrivacyPolicy;
