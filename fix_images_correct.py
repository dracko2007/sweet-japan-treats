#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import re

file_path = 'src/data/products.ts'

# Mapeamento completo
products = {
    'biore-uv': 'cosmeticos',
    'hada-labo': 'cosmeticos',
    'dhc-cleansing': 'cosmeticos',
    'melano-cc': 'cosmeticos',
    'senka-whip': 'cosmeticos',
    'lululun-mask': 'cosmeticos',
    'keana-mask': 'cosmeticos',
    'curel-cream': 'cosmeticos',
    'softymo-oil': 'cosmeticos',
    'anessa-sun': 'cosmeticos',
    'kitkat-matcha': 'doces',
    'sencha-tea': 'doces',
    'pocky-chocolate': 'doces',
    'jagariko-calbee': 'doces',
    'takenoko-meiji': 'doces',
    'konjac-jelly': 'doces',
    'matcha-powder': 'doces',
    'hichew-candy': 'doces',
    'kakijack': 'doces',
    'royce-matcha': 'doces',
    'luffy-figure': 'acessorios',
    'kirby-plush': 'acessorios',
    'muji-organizer': 'acessorios',
    'tiger-bottle': 'acessorios',
    'nerv-totebag': 'acessorios',
    'demon-slayer-pad': 'acessorios',
    'naruto-nendo': 'acessorios',
    'divoom-speaker': 'acessorios',
    'zojirushi-mug': 'acessorios',
    'moon-cushion': 'acessorios',
    'sakura-pens': 'papelaria',
    'kokuyo-notebooks': 'papelaria',
    'tombow-eraser': 'papelaria',
    'washi-tape': 'papelaria',
    'lihit-case': 'papelaria',
    'pilot-kakuno': 'papelaria',
    'tombow-pencil': 'papelaria',
    'midori-notebook': 'papelaria',
    'pentel-pens': 'papelaria',
    'signo-dx': 'papelaria'
}

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

count = 0

# Para cada produto
for product_id, category in products.items():
    # Encontra o bloco do produto entre id: 'product_id' e o próximo id: ou export
    pattern = r"(\{\s*id:\s*['\"]" + re.escape(product_id) + r"['\"].*?)(\n  \},?\s*\{|$)"

    def replace_func(match):
        global count
        block = match.group(1)

        # Substitui image
        block = re.sub(
            r"image:\s*['\"][^'\"]*['\"]",
            f"image: '/images/{category}/{product_id}-1.jpg'",
            block
        )

        # Substitui gallery (multiline)
        gallery_lines = [f"'/images/{category}/{product_id}-{i}.jpg'" for i in range(1, 6)]
        gallery_str = "[\n      " + ",\n      ".join(gallery_lines) + "\n    ]"

        block = re.sub(
            r"gallery:\s*\[[\s\S]*?\]",
            f"gallery: {gallery_str}",
            block
        )

        count += 1
        print(f"OK {product_id}")

        return block + match.group(2)

    content = re.sub(pattern, replace_func, content, flags=re.DOTALL)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"\n{count} produtos atualizados!")
