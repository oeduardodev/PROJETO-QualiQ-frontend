import { Injectable, signal } from '@angular/core';

type Preference = 'largeText' | 'highContrast' | 'reduceMotion' | 'underlineLinks';
type HandTalkPlugin = new (config: { token: string }) => unknown;

const STORAGE_KEY = 'qualiq-accessibility';
const DEFAULT_PREFERENCES: Record<Preference, boolean> = {
  largeText: false,
  highContrast: false,
  reduceMotion: false,
  underlineLinks: false,
};

@Injectable({ providedIn: 'root' })
export class AccessibilityService {
  readonly preferences = signal<Record<Preference, boolean>>(this.readPreferences());
  readonly handTalkActive = signal(false);
  private initialized = false;

  initialize(): void {
    if (this.initialized) return;
    this.initialized = true;
    this.applyPreferences();

    const token = window.__env?.['VITE_HANDTALK_TOKEN']?.trim();
    if (token) this.loadHandTalk(token);
    else this.loadVlibras();
  }

  toggle(preference: Preference): void {
    this.preferences.update((current) => ({ ...current, [preference]: !current[preference] }));
    this.applyPreferences();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.preferences()));
    } catch {
      // Browser storage may be unavailable; keep preferences for this session.
    }
  }

  reset(): void {
    this.preferences.set({ ...DEFAULT_PREFERENCES });
    this.applyPreferences();
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Browser storage may be unavailable.
    }
  }

  private applyPreferences(): void {
    const root = document.documentElement;
    const preferences = this.preferences();
    root.classList.toggle('a11y-large-text', preferences.largeText);
    root.classList.toggle('a11y-high-contrast', preferences.highContrast);
    root.classList.toggle('a11y-reduce-motion', preferences.reduceMotion);
    root.classList.toggle('a11y-underline-links', preferences.underlineLinks);
  }

  private readPreferences(): Record<Preference, boolean> {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<
        string,
        unknown
      >;
      return {
        largeText: saved['largeText'] === true,
        highContrast: saved['highContrast'] === true,
        reduceMotion: saved['reduceMotion'] === true,
        underlineLinks: saved['underlineLinks'] === true,
      };
    } catch {
      return { ...DEFAULT_PREFERENCES };
    }
  }

  private loadHandTalk(token: string): void {
    const script = document.createElement('script');
    script.src = 'https://plugin.handtalk.me/web/latest/handtalk.min.js';
    script.async = true;
    script.onload = () => {
      try {
        const HT = (window as Window & { HT?: HandTalkPlugin }).HT;
        if (!HT) throw new Error('Hand Talk não carregou.');
        new HT({ token });
        this.handTalkActive.set(true);
      } catch {
        this.loadVlibras();
      }
    };
    script.onerror = () => this.loadVlibras();
    document.head.appendChild(script);
  }

  private loadVlibras(): void {
    if (document.querySelector('script[data-qualiq-vlibras]')) return;
    const script = document.createElement('script');
    script.src = 'https://vlibras.gov.br/app/vlibras-plugin.js';
    script.async = true;
    script.dataset['qualiqVlibras'] = '';
    document.head.appendChild(script);
  }
}
