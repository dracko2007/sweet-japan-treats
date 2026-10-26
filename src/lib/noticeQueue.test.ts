import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NOTICE_GAP_MS, noticeQueue } from './noticeQueue';

describe('noticeQueue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    noticeQueue.reset();
  });
  afterEach(() => {
    noticeQueue.reset();
    vi.useRealTimers();
  });

  it('mostra só um aviso por vez, o de maior prioridade primeiro', () => {
    noticeQueue.request('install', 40);
    noticeQueue.request('cookie', 100);
    // install chegou primeiro e já está na tela — não é trocado
    expect(noticeQueue.isActive('install')).toBe(true);
    expect(noticeQueue.isActive('cookie')).toBe(false);
  });

  it('espera o respiro antes do próximo aviso', () => {
    noticeQueue.request('cookie', 100);
    noticeQueue.request('install', 40);
    noticeQueue.release('cookie');
    expect(noticeQueue.isActive('install')).toBe(false);
    vi.advanceTimersByTime(NOTICE_GAP_MS);
    expect(noticeQueue.isActive('install')).toBe(true);
  });

  it('preempt entra na hora e devolve o lugar depois', () => {
    noticeQueue.request('cookie', 100);
    noticeQueue.request('exit', 200, true);
    expect(noticeQueue.isActive('exit')).toBe(true);
    expect(noticeQueue.isActive('cookie')).toBe(false);
    noticeQueue.release('exit');
    vi.advanceTimersByTime(NOTICE_GAP_MS);
    expect(noticeQueue.isActive('cookie')).toBe(true);
  });

  it('avisa os inscritos quando o aviso ativo muda', () => {
    const listener = vi.fn();
    const unsubscribe = noticeQueue.subscribe(listener);
    noticeQueue.request('cookie', 100);
    expect(listener).toHaveBeenCalled();
    unsubscribe();
  });
});
