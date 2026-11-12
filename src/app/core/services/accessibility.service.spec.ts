import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccessibilityService } from './accessibility.service';

describe('AccessibilityService', () => {
  const originalEnvironment = window.__env;

  beforeEach(() => {
    window.__env = {};
    localStorage.removeItem('qualiq-accessibility');
  });

  afterEach(() => {
    window.__env = originalEnvironment;
    document
      .querySelectorAll('script[data-qualiq-vlibras], script[src*="handtalk.me"]')
      .forEach((script) => script.remove());
    document.documentElement.classList.remove(
      'a11y-large-text',
      'a11y-high-contrast',
      'a11y-reduce-motion',
      'a11y-underline-links',
    );
    localStorage.removeItem('qualiq-accessibility');
    delete (window as Window & { HT?: unknown }).HT;
  });

  it('loads VLibras without a Hand Talk token and preserves reading preferences', () => {
    const service = new AccessibilityService();
    service.initialize();

    expect(document.querySelector('script[data-qualiq-vlibras]')).not.toBeNull();
    service.toggle('largeText');
    expect(document.documentElement.classList.contains('a11y-large-text')).toBe(true);
    expect(new AccessibilityService().preferences().largeText).toBe(true);
    service.reset();
    expect(document.documentElement.classList.contains('a11y-large-text')).toBe(false);
  });

  it('initializes the licensed Hand Talk plugin when its script loads', () => {
    window.__env = { VITE_HANDTALK_TOKEN: 'test-token' };
    const constructor = vi.fn();
    (window as Window & { HT?: unknown }).HT = constructor;

    const service = new AccessibilityService();
    service.initialize();
    const script = document.querySelector<HTMLScriptElement>('script[src*="handtalk.me"]');
    expect(script).not.toBeNull();
    script?.dispatchEvent(new Event('load'));

    expect(constructor).toHaveBeenCalledWith({ token: 'test-token' });
    expect(service.handTalkActive()).toBe(true);
    expect(document.querySelector('script[data-qualiq-vlibras]')).toBeNull();
  });

  it('falls back to VLibras when Hand Talk cannot load', () => {
    window.__env = { VITE_HANDTALK_TOKEN: 'test-token' };
    const service = new AccessibilityService();
    service.initialize();
    document.querySelector('script[src*="handtalk.me"]')?.dispatchEvent(new Event('error'));

    expect(document.querySelector('script[data-qualiq-vlibras]')).not.toBeNull();
    expect(service.handTalkActive()).toBe(false);
  });
});
