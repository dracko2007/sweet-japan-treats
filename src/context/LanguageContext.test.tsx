import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider, useLanguage } from './LanguageContext';

function Probe() {
  const { language, selectedCountry } = useLanguage();
  return (
    <div>
      <span data-testid="language">{language}</span>
      <span data-testid="country">{selectedCountry}</span>
    </div>
  );
}

function fireStorage(key: string, newValue: string | null) {
  window.dispatchEvent(
    new StorageEvent('storage', { key, newValue, storageArea: window.localStorage }),
  );
}

describe('LanguageContext cross-tab sync', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('preferred-language', 'pt');
    localStorage.setItem('sakura_selected_country', 'Brasil');
    // Evita chamada de rede real de detecção por IP durante o teste.
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network disabled in test')));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('picks up preferred-language changes made from another tab', async () => {
    render(
      <LanguageProvider>
        <Probe />
      </LanguageProvider>,
    );

    expect(screen.getByTestId('language').textContent).toBe('pt');

    fireStorage('preferred-language', 'ja');

    await waitFor(() => {
      expect(screen.getByTestId('language').textContent).toBe('ja');
    });
  });

  it('picks up sakura_selected_country changes made from another tab', async () => {
    render(
      <LanguageProvider>
        <Probe />
      </LanguageProvider>,
    );

    expect(screen.getByTestId('country').textContent).toBe('Brasil');

    fireStorage('sakura_selected_country', 'Japão');

    await waitFor(() => {
      expect(screen.getByTestId('country').textContent).toBe('Japão');
    });
  });

  it('ignores storage events for unrelated keys', async () => {
    render(
      <LanguageProvider>
        <Probe />
      </LanguageProvider>,
    );

    fireStorage('some_other_key', 'whatever');

    // Dá tempo para um possível (indevido) re-render acontecer antes de afirmar que nada mudou.
    const { promise, resolve } = Promise.withResolvers<void>();
    setTimeout(resolve, 20);
    await promise;
    expect(screen.getByTestId('language').textContent).toBe('pt');
    expect(screen.getByTestId('country').textContent).toBe('Brasil');
  });
});
