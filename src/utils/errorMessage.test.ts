import { describe, expect, it } from 'vitest';
import { errorMessage } from './errorMessage';

describe('errorMessage', () => {
  it('lê a mensagem de Error, string e objetos com message', () => {
    expect(errorMessage(new Error('falhou'))).toBe('falhou');
    expect(errorMessage('texto')).toBe('texto');
    expect(errorMessage({ message: 'firebase', code: 'permission-denied' })).toBe('firebase');
  });

  it('usa o fallback quando não há mensagem', () => {
    expect(errorMessage(null, 'erro')).toBe('erro');
    expect(errorMessage(42, 'erro')).toBe('erro');
    expect(errorMessage(new Error(''), 'erro')).toBe('erro');
    expect(errorMessage(undefined)).toBe('');
  });
});
