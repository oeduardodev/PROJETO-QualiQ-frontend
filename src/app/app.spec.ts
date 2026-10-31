import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '@core/services/auth.service';
import { App } from './app';

describe('App', () => {
  const auth = {
    initialize: vi.fn(async () => undefined),
    loading: signal(false),
    session: signal(null),
    profile: signal(null),
  };

  beforeEach(async () => {
    auth.initialize.mockClear();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [{ provide: AuthService, useValue: auth }],
    }).compileComponents();
  });

  it('initializes authentication and shows login without a session', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(auth.initialize).toHaveBeenCalledOnce();
    expect(fixture.nativeElement.querySelector('app-login')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-maintenance')).toBeNull();
  });
});
