import { describe, expect, it, vi } from 'vitest';
import { fetchAllPages } from './fetch-all-pages';

describe('fetchAllPages', () => {
  it('continues after a full page and preserves order', async () => {
    const first = Array.from({ length: 500 }, (_, index) => index);
    const fetchPage = vi.fn((from: number, to: number) =>
      Promise.resolve({
        data: from === 0 && to === 499 ? first : [500],
        error: null,
      }),
    );
    expect(await fetchAllPages(fetchPage)).toEqual([...first, 500]);
    expect(fetchPage).toHaveBeenNthCalledWith(1, 0, 499);
    expect(fetchPage).toHaveBeenNthCalledWith(2, 500, 999);
  });

  it('does not hide database errors', async () => {
    const error = new Error('database unavailable');
    await expect(fetchAllPages(() => Promise.resolve({ data: null, error }))).rejects.toBe(error);
  });
});
