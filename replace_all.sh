#!/bin/bash

# Cosmeticos
for id in biore-uv hada-labo dhc-cleansing melano-cc senka-whip lululun-mask keana-mask curel-cream softymo-oil anessa-sun; do
  sed -i "s|https://m\.media-amazon\.com/images/I/[^']*|/images/cosmeticos/$id-1.jpg|g" src/data/products.ts
  sed -i "0,/id: '$id'/s|image: '[^']*'|image: '/images/cosmeticos/$id-1.jpg'|" src/data/products.ts
done

# Doces
for id in kitkat-matcha sencha-tea pocky-chocolate jagariko-calbee takenoko-meiji konjac-jelly matcha-powder hichew-candy kakijack royce-matcha; do
  sed -i "s|https://m\.media-amazon\.com/images/I/[^']*|/images/doces/$id-1.jpg|g" src/data/products.ts
done

# Acessorios
for id in luffy-figure kirby-plush muji-organizer tiger-bottle nerv-totebag demon-slayer-pad naruto-nendo divoom-speaker zojirushi-mug moon-cushion; do
  sed -i "s|https://m\.media-amazon\.com/images/I/[^']*|/images/acessorios/$id-1.jpg|g" src/data/products.ts
done

# Papelaria
for id in sakura-pens kokuyo-notebooks tombow-eraser washi-tape lihit-case pilot-kakuno tombow-pencil midori-notebook pentel-pens signo-dx; do
  sed -i "s|https://m\.media-amazon\.com/images/I/[^']*|/images/papelaria/$id-1.jpg|g" src/data/products.ts
done

echo "✅ Todas URLs atualizadas!"
