# japanexpress-mcp

Servidor MCP (Model Context Protocol) do Japan Express. Fala direto com o
Firestore de produção via `serviceAccountKey.json` (mesma credencial já usada
pelos scripts em `scripts/*.cjs`) — sem passar pelo login do painel `/admin`.

## Escopo

- **Produtos**: listar, ver, criar, atualizar (nome, descrição, preço, tags,
  peso, `hidden`, `featured`, `heroCarousel`, `discountPercent`, ...), excluir.
- **Categorias**: listar e criar/editar categorias personalizadas.
- **Conteúdo da home**: vídeos promo (`siteContent/home`) e a promoção ativa
  do hero cinematográfico (`siteContent/homePromotion`).

Fora do escopo (de propósito — mexe com dinheiro/cliente real, fica no painel
`/admin`): pedidos, cupons, financeiro, afiliados, funcionários.

## Rodar

```bash
cd mcp-server
npm install
npm start   # stdio — não é para rodar solto no terminal, é um subprocess de cliente MCP
```

## Registro no OMP

Já registrado em `.omp/mcp.json` na raiz do projeto (escopo de projeto — vale
para qualquer profile OMP que abrir esta pasta). Depois de instalar as
dependências (`npm install` acima), rode `/mcp reload` na sessão do OMP para
conectar.

## Ferramentas

| Tool | O que faz |
|---|---|
| `list_products` | Lista produtos (filtra por categoria/tag/hidden) |
| `get_product` | Detalhe de um produto por id |
| `create_product` | Cria produto novo (id = slug do nome) |
| `update_product` | Edita campos de um produto existente (merge) |
| `delete_product` | Exclusão permanente (prefira `update_product` com `hidden: true`) |
| `list_categories` | Lista categorias personalizadas |
| `upsert_category` | Cria/edita categoria personalizada |
| `get_home_content` | Lê vídeos/textos editáveis da home |
| `update_home_content` | Edita vídeos/textos da home |
| `get_home_promotion` | Lê a promoção ativa do hero |
| `set_home_promotion` | Define ou limpa (`clear: true`) a promoção ativa do hero |

## Segurança

O Admin SDK ignora as Firestore Security Rules — qualquer chamada aqui grava
direto em produção, sem as validações client-side do painel `/admin`. Use
`hidden: true` em vez de `delete_product` quando a intenção for só tirar da
vitrine.
