import React from 'react';
import Layout from '@/components/layout/Layout';

const TermsOfService: React.FC = () => (
  <Layout>
    <div className="py-12 bg-background">
      <div className="container mx-auto px-4 max-w-3xl">
        <h1 className="font-display text-4xl font-bold text-foreground mb-2">Termos de Uso</h1>
        <p className="text-muted-foreground text-sm mb-10">Última atualização: junho de 2025</p>

        <div className="prose prose-gray max-w-none space-y-8 text-foreground/80 leading-relaxed">

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">1. Aceitação dos termos</h2>
            <p>
              Ao acessar ou utilizar o site <strong>japanexpress-store.com</strong>, você concorda com estes
              Termos de Uso. Se não concordar com qualquer parte, não utilize nosso site.
              Estes termos se aplicam a todos os visitantes, clientes e usuários cadastrados.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">2. Sobre a Japan Express</h2>
            <p>
              A Japan Express é uma loja especializada em produtos importados do Japão, operando
              desde Hiroshima, Japão. Vendemos produtos originais japoneses — cosméticos, doces,
              papelaria, acessórios e outros — com entrega internacional para o Brasil e outros países.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">3. Cadastro e conta</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Você deve fornecer informações verdadeiras e atualizadas no cadastro.</li>
              <li>É responsabilidade do usuário manter a senha em sigilo.</li>
              <li>Menores de 18 anos devem ter autorização de um responsável legal.</li>
              <li>Reservamo-nos o direito de suspender contas com atividades suspeitas ou fraudulentas.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">4. Produtos e preços</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Os preços são exibidos na moeda correspondente ao país selecionado (BRL, JPY ou EUR).</li>
              <li>Imagens são meramente ilustrativas; pequenas variações de embalagem podem ocorrer.</li>
              <li>Reservamo-nos o direito de alterar preços sem aviso prévio.</li>
              <li>Em caso de erro de preço evidente, o pedido poderá ser cancelado com reembolso integral.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">5. Pedidos e pagamento</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>O pedido é confirmado somente após verificação do pagamento (PIX, PayPay ou transferência).</li>
              <li>Após fazer o pedido, envie o comprovante de pagamento via WhatsApp (070-1367-1679).</li>
              <li>O prazo de processamento é de até 2 dias úteis após confirmação do pagamento.</li>
              <li>Pedidos com dados incorretos de endereço podem resultar em entrega falha, sem reembolso do frete.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">6. Frete e entrega</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>O frete é calculado com base no peso, dimensões e destino do pedido.</li>
              <li>Prazos de entrega são estimados e podem variar por fatores externos (alfândega, greves, feriados).</li>
              <li>A Japan Express não se responsabiliza por atrasos causados pela alfândega brasileira ou japonesa.</li>
              <li>O cliente é responsável por eventuais taxas de importação cobradas pela Receita Federal.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">7. Trocas e devoluções</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Aceitamos solicitações de troca ou devolução em até 7 dias após o recebimento do produto.</li>
              <li>O produto deve estar sem uso, na embalagem original e sem avarias causadas pelo cliente.</li>
              <li>Para iniciar o processo, entre em contato via WhatsApp ou e-mail com foto do produto.</li>
              <li>Produtos alimentícios e cosméticos abertos não são elegíveis para devolução por questões de higiene.</li>
              <li>O frete de devolução é de responsabilidade do cliente, exceto em casos de produto com defeito ou erro nosso.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">8. Propriedade intelectual</h2>
            <p>
              Todo o conteúdo do site (textos, imagens, logotipos, design) é de propriedade da Japan Express
              ou licenciado por terceiros. É proibida a reprodução ou uso comercial sem autorização prévia por escrito.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">9. Limitação de responsabilidade</h2>
            <p>
              A Japan Express não se responsabiliza por danos indiretos, incidentais ou consequentes decorrentes
              do uso do site. Nossa responsabilidade máxima é limitada ao valor do pedido em questão.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">10. Lei aplicável e foro</h2>
            <p>
              Estes termos são regidos pelas leis do Brasil. Eventuais disputas serão submetidas ao foro da
              comarca do domicílio do consumidor, conforme o Código de Defesa do Consumidor (Lei nº 8.078/1990).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">11. Contato</h2>
            <ul className="list-none space-y-1">
              <li>📧 <a href="mailto:contato@japanexpress-store.com" className="text-primary hover:underline">contato@japanexpress-store.com</a></li>
              <li>💬 WhatsApp: +81 70-1367-1679</li>
            </ul>
          </section>

        </div>
      </div>
    </div>
  </Layout>
);

export default TermsOfService;
