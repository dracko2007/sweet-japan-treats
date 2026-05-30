import re

file_path = 'src/data/products.ts'

with open(file_path, 'r') as f:
    content = f.read()

products = ['biore-uv', 'hada-labo', 'dhc-cleansing', 'melano-cc', 'senka-whip', 'lululun-mask', 'keana-mask', 'curel-cream', 'softymo-oil', 'anessa-sun',
            'kitkat-matcha', 'sencha-tea', 'pocky-chocolate', 'jagariko-calbee', 'takenoko-meiji', 'konjac-jelly', 'matcha-powder', 'hichew-candy', 'kakijack', 'royce-matcha',
            'luffy-figure', 'kirby-plush', 'muji-organizer', 'tiger-bottle', 'nerv-totebag', 'demon-slayer-pad', 'naruto-nendo', 'divoom-speaker', 'zojirushi-mug', 'moon-cushion',
            'sakura-pens', 'kokuyo-notebooks', 'tombow-eraser', 'washi-tape', 'lihit-case', 'pilot-kakuno', 'tombow-pencil', 'midori-notebook', 'pentel-pens', 'signo-dx']

cats = {'biore-uv': 'cosmeticos', 'hada-labo': 'cosmeticos', 'dhc-cleansing': 'cosmeticos', 'melano-cc': 'cosmeticos', 'senka-whip': 'cosmeticos', 'lululun-mask': 'cosmeticos', 'keana-mask': 'cosmeticos', 'curel-cream': 'cosmeticos', 'softymo-oil': 'cosmeticos', 'anessa-sun': 'cosmeticos',
           'kitkat-matcha': 'doces', 'sencha-tea': 'doces', 'pocky-chocolate': 'doces', 'jagariko-calbee': 'doces', 'takenoko-meiji': 'doces', 'konjac-jelly': 'doces', 'matcha-powder': 'doces', 'hichew-candy': 'doces', 'kakijack': 'doces', 'royce-matcha': 'doces',
           'luffy-figure': 'acessorios', 'kirby-plush': 'acessorios', 'muji-organizer': 'acessorios', 'tiger-bottle': 'acessorios', 'nerv-totebag': 'acessorios', 'demon-slayer-pad': 'acessorios', 'naruto-nendo': 'acessorios', 'divoom-speaker': 'acessorios', 'zojirushi-mug': 'acessorios', 'moon-cushion': 'acessorios',
           'sakura-pens': 'papelaria', 'kokuyo-notebooks': 'papelaria', 'tombow-eraser': 'papelaria', 'washi-tape': 'papelaria', 'lihit-case': 'papelaria', 'pilot-kakuno': 'papelaria', 'tombow-pencil': 'papelaria', 'midori-notebook': 'papelaria', 'pentel-pens': 'papelaria', 'signo-dx': 'papelaria'}

count = 0
for pid in products:
    cat = cats[pid]
    
    # Substitui todas Amazon URLs por local
    old = 'https://m.media-amazon.com/images'
    new = '/images/' + cat + '/' + pid
    
    # Replace image
    pat = "image: '[^']*',"
    repl = "image: '/images/" + cat + "/" + pid + "-1.jpg',"
    if re.search(pat.replace("'", '"'), content):
        pass
    
    # Simpler: just replace all amazon links
    pattern = "https://m\.media-amazon\.com/images/I/[^']+"
    matches = re.findall(pattern, content)
    
    if matches:
        for i, match in enumerate(matches, 1):
            if i <= 5:
                new_url = "/images/" + cat + "/" + pid + "-" + str(i) + ".jpg"
                content = content.replace(match, new_url, 1)
        count += 1
        print("✅ " + pid)

with open(file_path, 'w') as f:
    f.write(content)

print("\n✨ Atualizado!")
