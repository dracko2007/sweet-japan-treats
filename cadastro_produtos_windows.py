import argparse
import io
import os
import re
import sys
import threading
import unicodedata
from pathlib import Path
from typing import Any, Optional

import tkinter as tk
from tkinter import filedialog, messagebox, ttk

try:
    from PIL import Image
except Exception:
    Image = None

try:
    import firebase_admin
    from firebase_admin import credentials, firestore
except Exception:
    firebase_admin = None
    credentials = None
    firestore = None


APP_DIR = Path(__file__).resolve().parent
PROJECT_DIR = Path("C:/sk.kogyo/temu_shop")
COLLECTION_NAME = "products"
MAX_IMAGE_SIZE = 600
JPEG_QUALITY = 72

CATEGORIES = [
    ("cosmeticos", "Cosmeticos"),
    ("doces", "Doces & Chas"),
    ("acessorios", "Acessorios"),
    ("papelaria", "Papelaria"),
    ("eletronicos", "Eletronicos"),
    ("masculino", "Masculino"),
    ("vestuario", "Vestuario"),
    ("higiene", "Higiene & Saude"),
]


def configure_windows_utf8() -> None:
    if sys.platform == "win32":
        for stream_name in ("stdout", "stderr"):
            stream = getattr(sys, stream_name, None)
            if stream is not None and hasattr(stream, "buffer"):
                setattr(
                    sys,
                    stream_name,
                    io.TextIOWrapper(stream.buffer, encoding="utf-8", errors="replace"),
                )


def slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFD", value.strip().lower())
    ascii_text = normalized.encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_text).strip("-")
    return slug[:60] or f"produto-{os.getpid()}"


def parse_float(value: str, default: Optional[float] = None) -> Optional[float]:
    text = value.strip().replace(",", ".")
    if not text:
        return default
    return float(text)


def parse_int(value: str, default: Optional[int] = None) -> Optional[int]:
    text = value.strip()
    if not text:
        return default
    return int(float(text.replace(",", ".")))


def compact_dict(data: dict[str, Any]) -> dict[str, Any]:
    clean: dict[str, Any] = {}
    for key, value in data.items():
        if value is None or value == "":
            continue
        if isinstance(value, list) and not value:
            continue
        if isinstance(value, dict):
            nested = compact_dict(value)
            if nested:
                clean[key] = nested
            continue
        clean[key] = value
    return clean


def credential_candidates() -> list[Path]:
    candidates = [
        PROJECT_DIR / "serviceAccountKey.json",
        PROJECT_DIR / "firebase-credentials.json",
        PROJECT_DIR / "erp" / "firebase-credentials.json",
        APP_DIR / "serviceAccountKey.json",
        APP_DIR / "firebase-credentials.json",
    ]
    erp_dir = PROJECT_DIR / "erp"
    if erp_dir.exists():
        for path in erp_dir.glob("*.json"):
            name = path.name.lower()
            if "firebase" in name or "adminsdk" in name:
                candidates.append(path)
    seen: set[Path] = set()
    unique = []
    for path in candidates:
        resolved = path.resolve()
        if resolved not in seen:
            seen.add(resolved)
            unique.append(path)
    return unique


def find_default_credentials() -> Optional[Path]:
    for path in credential_candidates():
        if path.exists():
            return path
    return None


def image_to_data_url(path: Path) -> str:
    if Image is None:
        raise RuntimeError("Pillow nao esta instalado. Execute: pip install pillow")
    with Image.open(path) as img:
        img = img.convert("RGB")
        img.thumbnail((MAX_IMAGE_SIZE, MAX_IMAGE_SIZE), Image.Resampling.LANCZOS)
        buffer = io.BytesIO()
        img.save(buffer, format="JPEG", quality=JPEG_QUALITY, optimize=True)
    import base64

    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    return f"data:image/jpeg;base64,{encoded}"


class ProductAdminApp:
    def __init__(self, root: tk.Tk) -> None:
        self.root = root
        self.root.title("Cadastro de Produtos - Temu Shop")
        self.root.geometry("980x780")
        self.db = None
        self.credential_path = find_default_credentials()
        self.image_paths: list[Path] = []
        self.loaded_gallery: list[str] = []

        self.vars: dict[str, tk.StringVar] = {}
        self.hidden_var = tk.BooleanVar(value=False)
        self.is_new_var = tk.BooleanVar(value=False)
        self.description: tk.Text
        self.variants_text: tk.Text
        self.gallery_list: tk.Listbox
        self.status_var = tk.StringVar(value="Pronto")

        self.build_ui()

    def build_ui(self) -> None:
        outer = ttk.Frame(self.root)
        outer.pack(fill=tk.BOTH, expand=True)

        canvas = tk.Canvas(outer, highlightthickness=0)
        scroll = ttk.Scrollbar(outer, orient=tk.VERTICAL, command=canvas.yview)
        self.form = ttk.Frame(canvas, padding=12)
        self.form.bind("<Configure>", lambda event: canvas.configure(scrollregion=canvas.bbox("all")))
        canvas.create_window((0, 0), window=self.form, anchor="nw")
        canvas.configure(yscrollcommand=scroll.set)
        canvas.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scroll.pack(side=tk.RIGHT, fill=tk.Y)

        self.build_connection_section()
        self.build_product_section()
        self.build_image_section()
        self.build_actions()

        status = ttk.Label(self.root, textvariable=self.status_var, anchor=tk.W, padding=(8, 4))
        status.pack(fill=tk.X)

    def build_connection_section(self) -> None:
        frame = ttk.LabelFrame(self.form, text="Conexao Firebase", padding=10)
        frame.grid(row=0, column=0, columnspan=4, sticky="ew", pady=(0, 10))
        frame.columnconfigure(1, weight=1)

        self.cred_var = tk.StringVar(value=str(self.credential_path or ""))
        ttk.Label(frame, text="Credenciais").grid(row=0, column=0, sticky=tk.W, padx=(0, 8))
        ttk.Entry(frame, textvariable=self.cred_var).grid(row=0, column=1, sticky="ew")
        ttk.Button(frame, text="Escolher JSON", command=self.choose_credentials).grid(row=0, column=2, padx=4)
        ttk.Button(frame, text="Testar conexao", command=self.connect_firebase_async).grid(row=0, column=3)

    def build_product_section(self) -> None:
        frame = ttk.LabelFrame(self.form, text="Produto", padding=10)
        frame.grid(row=1, column=0, columnspan=4, sticky="ew", pady=(0, 10))
        for col in range(4):
            frame.columnconfigure(col, weight=1)

        row = 0
        self.add_entry(frame, row, 0, "ID", "id")
        self.add_entry(frame, row, 2, "Nome", "name")
        row += 1

        ttk.Label(frame, text="Descricao").grid(row=row, column=0, sticky=tk.NW, pady=4)
        self.description = tk.Text(frame, height=5, width=80, wrap=tk.WORD)
        self.description.grid(row=row, column=1, columnspan=3, sticky="ew", pady=4)
        row += 1

        self.vars["category"] = tk.StringVar(value="cosmeticos")
        ttk.Label(frame, text="Categoria").grid(row=row, column=0, sticky=tk.W, pady=4)
        category = ttk.Combobox(
            frame,
            textvariable=self.vars["category"],
            values=[item[0] for item in CATEGORIES],
            state="readonly",
        )
        category.grid(row=row, column=1, sticky="ew", pady=4)
        self.add_entry(frame, row, 2, "Flavor", "flavor")
        row += 1

        self.add_entry(frame, row, 0, "Preco small", "price_small")
        self.add_entry(frame, row, 2, "Preco large", "price_large")
        row += 1
        self.add_entry(frame, row, 0, "Custo", "cost")
        self.add_entry(frame, row, 2, "Desconto %", "discount_percent")
        row += 1
        self.add_entry(frame, row, 0, "Peso g", "weight_grams")
        self.add_entry(frame, row, 2, "Vendas", "sales_count")
        row += 1
        self.add_entry(frame, row, 0, "Largura cm", "width_cm")
        self.add_entry(frame, row, 2, "Comprimento cm", "length_cm")
        row += 1
        self.add_entry(frame, row, 0, "Altura cm", "height_cm")
        self.add_entry(frame, row, 2, "Tags (virgula)", "tags")
        row += 1

        ttk.Checkbutton(frame, text="Oculto no site", variable=self.hidden_var).grid(row=row, column=1, sticky=tk.W)
        ttk.Checkbutton(frame, text="Lancamento", variable=self.is_new_var).grid(row=row, column=2, sticky=tk.W)
        row += 1

        ttk.Label(frame, text="Variantes").grid(row=row, column=0, sticky=tk.NW, pady=4)
        self.variants_text = tk.Text(frame, height=5, width=80, wrap=tk.NONE)
        self.variants_text.grid(row=row, column=1, columnspan=3, sticky="ew", pady=4)
        self.variants_text.insert("1.0", "small|Pequeno|0\n")
        ttk.Label(
            frame,
            text="Uma por linha: id|label|preco. Ex: kit-3|Kit 3 unidades|2500",
        ).grid(row=row + 1, column=1, columnspan=3, sticky=tk.W)

    def add_entry(self, parent: ttk.Frame, row: int, col: int, label: str, key: str) -> None:
        self.vars[key] = tk.StringVar()
        ttk.Label(parent, text=label).grid(row=row, column=col, sticky=tk.W, padx=(0, 8), pady=4)
        ttk.Entry(parent, textvariable=self.vars[key]).grid(row=row, column=col + 1, sticky="ew", pady=4)

    def build_image_section(self) -> None:
        frame = ttk.LabelFrame(self.form, text="Imagens", padding=10)
        frame.grid(row=2, column=0, columnspan=4, sticky="ew", pady=(0, 10))
        frame.columnconfigure(0, weight=1)
        self.gallery_list = tk.Listbox(frame, height=6)
        self.gallery_list.grid(row=0, column=0, columnspan=4, sticky="ew")
        ttk.Button(frame, text="Adicionar imagens", command=self.choose_images).grid(row=1, column=0, sticky=tk.W, pady=6)
        ttk.Button(frame, text="Remover selecionada", command=self.remove_selected_image).grid(row=1, column=1, sticky=tk.W, pady=6)
        ttk.Button(frame, text="Limpar imagens", command=self.clear_images).grid(row=1, column=2, sticky=tk.W, pady=6)

    def build_actions(self) -> None:
        frame = ttk.Frame(self.form)
        frame.grid(row=3, column=0, columnspan=4, sticky="ew")
        ttk.Button(frame, text="Carregar por ID", command=self.load_product_async).pack(side=tk.LEFT, padx=(0, 6))
        ttk.Button(frame, text="Salvar produto", command=self.save_product_async).pack(side=tk.LEFT, padx=6)
        ttk.Button(frame, text="Limpar formulario", command=self.clear_form).pack(side=tk.LEFT, padx=6)

    def choose_credentials(self) -> None:
        path = filedialog.askopenfilename(
            title="Selecione o JSON do Firebase Admin",
            filetypes=[("JSON", "*.json"), ("Todos", "*.*")],
        )
        if path:
            self.credential_path = Path(path)
            self.cred_var.set(path)

    def choose_images(self) -> None:
        paths = filedialog.askopenfilenames(
            title="Selecione imagens do produto",
            filetypes=[("Imagens", "*.jpg *.jpeg *.png *.webp *.bmp"), ("Todos", "*.*")],
        )
        for raw in paths:
            path = Path(raw)
            if path not in self.image_paths:
                self.image_paths.append(path)
                self.gallery_list.insert(tk.END, str(path))

    def remove_selected_image(self) -> None:
        selected = list(self.gallery_list.curselection())
        for index in reversed(selected):
            self.gallery_list.delete(index)
            if index < len(self.image_paths):
                self.image_paths.pop(index)

    def clear_images(self) -> None:
        self.image_paths.clear()
        self.loaded_gallery.clear()
        self.gallery_list.delete(0, tk.END)

    def set_status(self, text: str) -> None:
        self.status_var.set(text)
        self.root.update_idletasks()

    def run_thread(self, target) -> None:
        threading.Thread(target=target, daemon=True).start()

    def connect_firebase_async(self) -> None:
        self.run_thread(self.connect_firebase)

    def connect_firebase(self) -> None:
        try:
            if firebase_admin is None or credentials is None or firestore is None:
                raise RuntimeError("firebase-admin nao esta instalado. Execute: pip install firebase-admin")
            path = Path(self.cred_var.get().strip()) if self.cred_var.get().strip() else find_default_credentials()
            if not path or not path.exists():
                raise FileNotFoundError("JSON de credenciais Firebase nao encontrado.")
            self.set_status("Conectando ao Firebase...")
            if not firebase_admin._apps:
                cred = credentials.Certificate(str(path))
                firebase_admin.initialize_app(cred)
            self.db = firestore.client()
            self.credential_path = path
            self.cred_var.set(str(path))
            self.set_status("Conectado ao Firestore.")
            messagebox.showinfo("Conexao", "Conectado ao Firestore com sucesso.")
        except Exception as error:
            self.set_status("Falha na conexao.")
            messagebox.showerror("Erro de conexao", str(error))

    def require_db(self):
        if self.db is None:
            self.connect_firebase()
        if self.db is None:
            raise RuntimeError("Firestore indisponivel.")
        return self.db

    def parse_variants(self) -> list[dict[str, Any]]:
        variants = []
        for line in self.variants_text.get("1.0", tk.END).splitlines():
            text = line.strip()
            if not text:
                continue
            parts = [part.strip() for part in text.split("|")]
            if len(parts) != 3:
                raise ValueError(f"Variante invalida: {text}. Use id|label|preco.")
            variants.append({"id": parts[0], "label": parts[1], "price": float(parts[2].replace(",", "."))})
        return variants

    def build_payload(self) -> tuple[str, dict[str, Any]]:
        name = self.vars["name"].get().strip()
        if not name:
            raise ValueError("Nome e obrigatorio.")
        product_id = self.vars["id"].get().strip() or slugify(name)
        category = self.vars["category"].get().strip()
        if not category:
            raise ValueError("Categoria e obrigatoria.")

        price_small = parse_float(self.vars["price_small"].get(), 0) or 0
        price_large = parse_float(self.vars["price_large"].get(), price_small) or price_small
        variants = self.parse_variants()
        if variants and price_small == 0:
            price_small = float(variants[0]["price"])
            price_large = price_small

        gallery = [image_to_data_url(path) for path in self.image_paths] if self.image_paths else list(self.loaded_gallery)
        image = gallery[0] if gallery else ""

        dimensions = compact_dict(
            {
                "widthCm": parse_float(self.vars["width_cm"].get()),
                "lengthCm": parse_float(self.vars["length_cm"].get()),
                "heightCm": parse_float(self.vars["height_cm"].get()),
                "source": "manual",
            }
        )
        if not {"widthCm", "lengthCm", "heightCm"}.issubset(dimensions):
            dimensions = {}

        payload = compact_dict(
            {
                "name": name,
                "description": self.description.get("1.0", tk.END).strip(),
                "category": category,
                "prices": {"small": price_small, "large": price_large},
                "variants": variants,
                "cost": parse_float(self.vars["cost"].get()),
                "image": image,
                "gallery": gallery,
                "flavor": self.vars["flavor"].get().strip(),
                "hidden": self.hidden_var.get(),
                "discountPercent": parse_float(self.vars["discount_percent"].get()),
                "weightGrams": parse_int(self.vars["weight_grams"].get()),
                "packageDimensionsCm": dimensions,
                "tags": [tag.strip().lower() for tag in self.vars["tags"].get().split(",") if tag.strip()],
                "isNew": self.is_new_var.get(),
                "salesCount": parse_int(self.vars["sales_count"].get()),
                "__deleted": False,
                "updatedAt": firestore.SERVER_TIMESTAMP if firestore else None,
            }
        )
        return product_id, payload

    def save_product_async(self) -> None:
        self.run_thread(self.save_product)

    def save_product(self) -> None:
        try:
            db = self.require_db()
            product_id, payload = self.build_payload()
            self.set_status(f"Salvando {product_id}...")
            db.collection(COLLECTION_NAME).document(product_id).set(payload, merge=True)
            self.vars["id"].set(product_id)
            self.loaded_gallery = payload.get("gallery", [])
            self.image_paths.clear()
            self.set_status(f"Produto salvo: {product_id}")
            messagebox.showinfo("Sucesso", f"Produto salvo no Firestore:\n{product_id}")
        except Exception as error:
            self.set_status("Erro ao salvar produto.")
            messagebox.showerror("Erro ao salvar", str(error))

    def load_product_async(self) -> None:
        self.run_thread(self.load_product)

    def load_product(self) -> None:
        try:
            product_id = self.vars["id"].get().strip()
            if not product_id:
                raise ValueError("Informe o ID para carregar.")
            db = self.require_db()
            self.set_status(f"Carregando {product_id}...")
            snap = db.collection(COLLECTION_NAME).document(product_id).get()
            if not snap.exists:
                raise FileNotFoundError(f"Produto nao encontrado: {product_id}")
            self.populate_form(product_id, snap.to_dict() or {})
            self.set_status(f"Produto carregado: {product_id}")
        except Exception as error:
            self.set_status("Erro ao carregar produto.")
            messagebox.showerror("Erro ao carregar", str(error))

    def populate_form(self, product_id: str, data: dict[str, Any]) -> None:
        self.clear_form(keep_id=False)
        self.vars["id"].set(product_id)
        self.vars["name"].set(str(data.get("name", "")))
        self.description.insert("1.0", str(data.get("description", "")))
        self.vars["category"].set(str(data.get("category", "cosmeticos")))
        prices = data.get("prices", {}) if isinstance(data.get("prices"), dict) else {}
        self.vars["price_small"].set(str(prices.get("small", "")))
        self.vars["price_large"].set(str(prices.get("large", "")))
        self.vars["cost"].set(str(data.get("cost", "")))
        self.vars["flavor"].set(str(data.get("flavor", "")))
        self.vars["discount_percent"].set(str(data.get("discountPercent", "")))
        self.vars["weight_grams"].set(str(data.get("weightGrams", "")))
        self.vars["sales_count"].set(str(data.get("salesCount", "")))
        dims = data.get("packageDimensionsCm", {}) if isinstance(data.get("packageDimensionsCm"), dict) else {}
        self.vars["width_cm"].set(str(dims.get("widthCm", "")))
        self.vars["length_cm"].set(str(dims.get("lengthCm", "")))
        self.vars["height_cm"].set(str(dims.get("heightCm", "")))
        self.vars["tags"].set(", ".join(data.get("tags", []) if isinstance(data.get("tags"), list) else []))
        self.hidden_var.set(bool(data.get("hidden", False)))
        self.is_new_var.set(bool(data.get("isNew", False)))
        self.variants_text.delete("1.0", tk.END)
        variants = data.get("variants", [])
        if isinstance(variants, list) and variants:
            for variant in variants:
                self.variants_text.insert(
                    tk.END,
                    f"{variant.get('id', '')}|{variant.get('label', '')}|{variant.get('price', '')}\n",
                )
        self.loaded_gallery = data.get("gallery", []) if isinstance(data.get("gallery"), list) else []
        if not self.loaded_gallery and data.get("image"):
            self.loaded_gallery = [str(data["image"])]
        for index, _ in enumerate(self.loaded_gallery, start=1):
            self.gallery_list.insert(tk.END, f"Imagem existente {index}")

    def clear_form(self, keep_id: bool = False) -> None:
        current_id = self.vars.get("id", tk.StringVar()).get()
        for var in self.vars.values():
            var.set("")
        if keep_id:
            self.vars["id"].set(current_id)
        self.vars["category"].set("cosmeticos")
        self.description.delete("1.0", tk.END)
        self.variants_text.delete("1.0", tk.END)
        self.variants_text.insert("1.0", "small|Pequeno|0\n")
        self.hidden_var.set(False)
        self.is_new_var.set(False)
        self.clear_images()
        self.set_status("Formulario limpo.")


def check_environment() -> int:
    print(f"Arquivo: {Path(__file__).resolve()}")
    print(f"firebase-admin: {'ok' if firebase_admin else 'faltando'}")
    print(f"Pillow: {'ok' if Image else 'faltando'}")
    cred = find_default_credentials()
    print(f"Credencial padrao: {cred if cred else 'nao encontrada'}")
    print("Comando para gerar EXE:")
    print(
        f"{sys.executable} -m PyInstaller --noconfirm --onefile --windowed "
        f"--name CadastroProdutosTemu --collect-all firebase_admin "
        f"--collect-all google.cloud.firestore {Path(__file__).resolve()}"
    )
    return 0 if firebase_admin and Image and cred else 1


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Cadastro Windows de produtos Temu Shop.")
    parser.add_argument("--check", action="store_true", help="Verifica dependencias e credenciais sem abrir a janela.")
    return parser.parse_args()


def main() -> None:
    configure_windows_utf8()
    args = parse_args()
    if args.check:
        raise SystemExit(check_environment())
    root = tk.Tk()
    ProductAdminApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()
