# 📁 Instruções para Adicionar Arquivos de Mídia

## 🖼️ Imagens dos Produtos

Copie as imagens dos produtos para a pasta `/public/products/` com os seguintes nomes:

### Produtos Artesanais:
- `cremoso.jpg` - Doce de Leite Cremoso (tradicional)
- `cafe.jpg` - Doce de Leite de Café  
- `coco.jpg` - Doce de Leite de Coco
- `amendoim.jpg` - Doce de Leite de Amendoim

### Produtos Premium:
- `amendoas.jpg` - Doce de Leite de Amêndoas
- `matcha.jpg` - Doce de Leite de Matcha
- `chocolate.jpg` - Doce de Leite de Chocolate

**Origem das imagens:** `/home/master/Downloads/sweet-japan-treats-reproduced/sweet-japan-treats-main/public`

As 3 imagens fornecidas correspondem a:
- Imagem 1 (pote marrom escuro com grãos de café) → `cafe.jpg`
- Imagem 2 (pote branco com coco) → `coco.jpg`
- Imagem 3 (pote caramelo) → `cremoso.jpg` (tradicional)

---

## 🎥 Vídeo de Preparo

Copie o vídeo MP4 para a pasta `/public/video/` com o nome:
- `preparo.mp4` - Vídeo mostrando o preparo do doce de leite

**Opcional:** 
- `preparo-thumbnail.jpg` - Imagem de capa do vídeo (frame inicial)

**Origem do vídeo:** `/home/master/Downloads/sweet-japan-treats-reproduced/sweet-japan-treats-main/public`

---

## 🚀 Como Copiar os Arquivos

### Via Terminal (Linux/Mac):

```bash
# Copiar imagens dos produtos
cp /home/master/Downloads/sweet-japan-treats-reproduced/sweet-japan-treats-main/public/*.jpg "/home/master/Paula site/sweet-japan-treats/public/products/"

# Copiar vídeo
cp /home/master/Downloads/sweet-japan-treats-reproduced/sweet-japan-treats-main/public/*.mp4 "/home/master/Paula site/sweet-japan-treats/public/video/preparo.mp4"
```

### Via Interface Gráfica:

1. Abra o gerenciador de arquivos
2. Navegue até `/home/master/Downloads/sweet-japan-treats-reproduced/sweet-japan-treats-main/public`
3. Copie as 3 imagens JPG para `/home/master/Paula site/sweet-japan-treats/public/products/`
4. Renomeie conforme a lista acima
5. Copie o arquivo MP4 para `/home/master/Paula site/sweet-japan-treats/public/video/preparo.mp4`

---

## ✅ Checklist

- [ ] cafe.jpg copiado para /public/products/
- [ ] coco.jpg copiado para /public/products/
- [ ] cremoso.jpg copiado para /public/products/
- [ ] preparo.mp4 copiado para /public/video/
- [ ] (Opcional) preparo-thumbnail.jpg copiado para /public/video/

---

## 🔍 Verificação

Após copiar os arquivos, verifique se estão acessíveis:

- http://localhost:5173/products/cafe.jpg
- http://localhost:5173/products/coco.jpg
- http://localhost:5173/products/cremoso.jpg
- http://localhost:5173/video/preparo.mp4

Se os arquivos não aparecerem, reinicie o servidor de desenvolvimento:

```bash
npm run dev
```
