import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service';
import { ThemeService } from './theme.service';
import { UserManagementService } from '@features/users/data-access/user-management.service';
import { ToastService } from '@shared/services/toast.service';
import type { Profile } from '@core/models/database';

describe('ThemeService', () => {
  const profile = signal<Profile | null>(null);
  const user = signal<{ id: string } | null>(null);
  const save = vi.fn();
  const setThemePreference = vi.fn((preference: 'light' | 'dark') => {
    const current = profile();
    if (current) profile.set({ ...current, theme_preference: preference });
  });
  const error = vi.fn();

  beforeEach(() => {
    profile.set(null);
    user.set(null);
    save.mockReset();
    setThemePreference.mockClear();
    error.mockReset();
    document.documentElement.classList.remove('dark');
    delete document.documentElement.dataset['theme'];
    TestBed.configureTestingModule({
      providers: [
        ThemeService,
        { provide: AuthService, useValue: { profile, user, setThemePreference } },
        { provide: UserManagementService, useValue: { save } },
        { provide: ToastService, useValue: { error } },
      ],
    });
  });

  afterEach(() => {
    document.documentElement.classList.remove('dark');
    delete document.documentElement.dataset['theme'];
  });

  it('applies the saved preference and resets after sign out', () => {
    const theme = TestBed.inject(ThemeService);
    profile.set({ id: 'user-1', theme_preference: 'dark' } as Profile);
    TestBed.tick();
    expect(theme.theme()).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    profile.set(null);
    TestBed.tick();
    expect(theme.theme()).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('saves the preference for the signed-in user', async () => {
    const theme = TestBed.inject(ThemeService);
    user.set({ id: 'user-1' });
    profile.set({ id: 'user-1', theme_preference: 'light' } as Profile);
    save.mockResolvedValue({});
    TestBed.tick();
    await theme.setTheme('dark');
    TestBed.tick();

    expect(save).toHaveBeenCalledWith({ action: 'update_theme', theme_preference: 'dark' });
    expect(setThemePreference).toHaveBeenCalledWith('dark');
    expect(theme.theme()).toBe('dark');
    expect(document.documentElement.dataset['theme']).toBe('dark');
  });

  it('restores the previous theme when saving fails', async () => {
    const theme = TestBed.inject(ThemeService);
    user.set({ id: 'user-1' });
    save.mockRejectedValue(new Error('Falha de rede'));
    await theme.setTheme('dark');

    expect(theme.theme()).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(error).toHaveBeenCalledOnce();
  });
});
