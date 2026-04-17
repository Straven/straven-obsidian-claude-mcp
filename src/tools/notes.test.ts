import { describe, it, expect } from 'vitest';
import { VaultError } from './notes';

describe('VaultError', () => {
  it('carries code and message', () => {
    const err = new VaultError('FILE_NOT_FOUND', 'test.md not found');
    expect(err.code).toBe('FILE_NOT_FOUND');
    expect(err.message).toBe('test.md not found');
    expect(err).toBeInstanceOf(Error);
  });
});
