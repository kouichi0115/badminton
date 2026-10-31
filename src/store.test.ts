import { describe, it, expect } from 'vitest';
import { getState, update, undo, redo } from './store';

describe('store', () => {
  it('ignores values returned from update callbacks and supports undo/redo', () => {
    update((d) => (d.tournament.name = 'テスト大会') as unknown as void);
    expect(getState().tournament.name).toBe('テスト大会');
    undo();
    expect(getState().tournament.name).toBe('');
    redo();
    expect(getState().tournament.name).toBe('テスト大会');
  });
});
