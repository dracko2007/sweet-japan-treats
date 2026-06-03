// Utilitários de validação e máscara de inputs.
// Cobrem os campos usados na loja: e-mail, telefone, CPF (alfândega Brasil),
// CEP japonês (〒XXX-XXXX) e nome.

/* ------------------------------------------------------------------ */
/*  Validações                                                         */
/* ------------------------------------------------------------------ */

export const isValidEmail = (email: string): boolean => {
  const value = email.trim();
  // RFC simplificado: algo@dominio.tld
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
};

/** Valida CPF brasileiro com os dois dígitos verificadores. */
export const isValidCPF = (cpf: string): boolean => {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return false;
  // Rejeita sequências repetidas (000..., 111..., etc.)
  if (/^(\d)\1{10}$/.test(digits)) return false;

  const calcCheck = (slice: string, factorStart: number): number => {
    let sum = 0;
    for (let i = 0; i < slice.length; i++) {
      sum += parseInt(slice[i], 10) * (factorStart - i);
    }
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };

  const check1 = calcCheck(digits.slice(0, 9), 10);
  if (check1 !== parseInt(digits[9], 10)) return false;
  const check2 = calcCheck(digits.slice(0, 10), 11);
  if (check2 !== parseInt(digits[10], 10)) return false;
  return true;
};

/** Valida CNPJ brasileiro (14 dígitos) com os dois dígitos verificadores. */
export const isValidCNPJ = (cnpj: string): boolean => {
  const d = cnpj.replace(/\D/g, '');
  if (d.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(d)) return false;

  const calc = (len: number): number => {
    const weights = len === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < len; i++) sum += parseInt(d[i], 10) * weights[i];
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  if (calc(12) !== parseInt(d[12], 10)) return false;
  if (calc(13) !== parseInt(d[13], 10)) return false;
  return true;
};

/** Formata CNPJ: 00.000.000/0000-00 */
export const maskCNPJ = (value: string): string => {
  const d = value.replace(/\D/g, '').slice(0, 14);
  return d
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
};

/** CEP japonês: 7 dígitos (com ou sem hífen). */
export const isValidJapanesePostalCode = (cep: string): boolean => {
  const digits = cep.replace(/\D/g, '');
  return digits.length === 7;
};

/** Telefone internacional (E.164): 8 a 15 dígitos, com ou sem código do país. */
export const isValidPhone = (phone: string): boolean => {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 15;
};

/** Lista de países com código de discagem (DDI) para o cadastro. */
export const COUNTRY_DIAL_CODES = [
  { country: 'Brasil', code: '+55', flag: '🇧🇷' },
  { country: 'Japão', code: '+81', flag: '🇯🇵' },
  { country: 'Portugal', code: '+351', flag: '🇵🇹' },
  { country: 'França', code: '+33', flag: '🇫🇷' },
  { country: 'Itália', code: '+39', flag: '🇮🇹' },
  { country: 'Espanha', code: '+34', flag: '🇪🇸' },
  { country: 'Reino Unido', code: '+44', flag: '🇬🇧' },
  { country: 'Alemanha', code: '+49', flag: '🇩🇪' },
  { country: 'EUA/Canadá', code: '+1', flag: '🇺🇸' },
] as const;

export const isNonEmpty = (value: string, min = 1): boolean =>
  value.trim().length >= min;

/* ------------------------------------------------------------------ */
/*  Máscaras (formatação durante a digitação)                          */
/* ------------------------------------------------------------------ */

/** Formata CPF: 000.000.000-00 */
export const maskCPF = (value: string): string => {
  const d = value.replace(/\D/g, '').slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
};

/** Formata CEP japonês: 000-0000 */
export const maskJapanesePostalCode = (value: string): string => {
  const d = value.replace(/\D/g, '').slice(0, 7);
  if (d.length <= 3) return d;
  return `${d.slice(0, 3)}-${d.slice(3)}`;
};

/** Formata telefone japonês: 000-0000-0000 (ou 00-0000-0000) */
export const maskPhone = (value: string): string => {
  const d = value.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
};

/* ------------------------------------------------------------------ */
/*  Helper de validação de formulário                                  */
/* ------------------------------------------------------------------ */

export type FieldErrors = Record<string, string>;

/**
 * Recebe um objeto de regras { campo: () => mensagemDeErro | null } e
 * retorna o mapa de erros (vazio = válido).
 */
export const runValidations = (
  rules: Record<string, () => string | null>
): FieldErrors => {
  const errors: FieldErrors = {};
  for (const [field, rule] of Object.entries(rules)) {
    const msg = rule();
    if (msg) errors[field] = msg;
  }
  return errors;
};
