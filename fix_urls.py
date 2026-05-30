import re

file_path = '/c/sk.kogyo/temu_shop/src/data/products.ts'

products_map = {
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

with open(file_path, 'r') as f:
    content = f.read()

count = 0
for product_id, category in products_map.items():
    # Replace image URLs
    pattern = f"(id:\s*['\"]}{product_id}['\"].*?image:\s*['\"])[^'\"]+(['\"])"
    replacement = f"\1/images/{category}/{product_id}-1.jpg\2"
    new_content, n = re.subn(pattern, replacement, content, flags=re.DOTALL)
    if n > 0:
        content = new_content
        count += 1
        print(f"✅ {product_id} (image)")
    
    # Replace gallery
    pattern = f"(id:\s*['\"]}{product_id}['\"].*?gallery:\s*)\[[^\]]*\]"
    gallery_urls = ",\n      ".join([f"'/images/{category}/{product_id}-{i}.jpg'" for i in range(1,6)])
    replacement = f"\1[\n      {gallery_urls}\n    ]"
    new_content, n = re.subn(pattern, replacement, content, flags=re.DOTALL)
    if n > 0:
        content = new_content
        count += 1
        print(f"✅ {product_id} (gallery)")

with open(file_path, 'w') as f:
    f.write(content)

print(f"\n✨ {count} substituições realizadas!")
