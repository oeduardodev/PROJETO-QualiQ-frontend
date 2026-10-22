import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { hexToHsv, hsvToHex, normalizeHex, textColorForBackground } from './color.utils';
import { QuickPaletteComponent } from './quick-palette.component';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, QuickPaletteComponent],
  template: `<form [formGroup]="form">
    <app-quick-palette formControlName="color_key" [presets]="presets" />
  </form>`,
})
class PaletteHost {
  readonly color = new FormControl('#3b82f6', {
    nonNullable: true,
    validators: Validators.required,
  });
  readonly form = new FormGroup({ color_key: this.color });
  readonly presets = ['#ef4444', '#3b82f6'];
}

describe('QuickPaletteComponent', () => {
  beforeEach(() => {
    localStorage.removeItem('qualiq.quick-palette.colors.v1');
    TestBed.configureTestingModule({ imports: [PaletteHost] });
  });

  afterEach(() => localStorage.removeItem('qualiq.quick-palette.colors.v1'));

  it('keeps the existing form value and writes preset selections through ControlValueAccessor', () => {
    const fixture = TestBed.createComponent(PaletteHost);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(fixture.componentInstance.color.value).toBe('#3b82f6');
    expect(root.querySelector('[title="#3B82F6"]')?.getAttribute('aria-pressed')).toBe('true');
    expect(root.querySelector('input[type="color"]')).toBeNull();

    (root.querySelector('[title="#EF4444"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.componentInstance.color.value).toBe('#EF4444');
    expect(fixture.componentInstance.color.touched).toBe(true);
    expect(fixture.componentInstance.color.valid).toBe(true);

    fixture.componentInstance.color.setValue('#12AB34');
    fixture.detectChanges();
    expect(root.querySelector('[title="#12AB34"]')).toBeNull();
    const customButton = root.querySelector('.palette-add') as HTMLButtonElement;
    expect(customButton.classList.contains('is-selected')).toBe(true);
    expect(customButton.style.backgroundColor).toBe('rgb(18, 171, 52)');
  });

  it('uses a custom HEX value only in the current form, without adding a swatch', () => {
    const fixture = TestBed.createComponent(PaletteHost);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const defaultSwatchCount = root.querySelectorAll('.palette-swatch').length;
    (root.querySelector('.palette-add') as HTMLButtonElement).click();
    fixture.detectChanges();
    const input = root.querySelector('.palette-hex input') as HTMLInputElement;
    input.value = '#123456';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    expect(fixture.componentInstance.color.value).toBe('#123456');
    expect(root.querySelectorAll('.palette-swatch').length).toBe(defaultSwatchCount);
    expect(root.querySelector('[title="#123456"]')).toBeNull();
    const customButton = root.querySelector('.palette-add') as HTMLButtonElement;
    expect(customButton.classList.contains('is-selected')).toBe(true);
    expect(customButton.style.backgroundColor).toBe('rgb(18, 52, 86)');
    expect(customButton.style.color).toBe('rgb(255, 255, 255)');

    (root.querySelector('.palette-done') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(root.querySelector('.palette-popover')).toBeNull();
    expect(localStorage.getItem('qualiq.quick-palette.colors.v1')).toBeNull();

    const secondFixture = TestBed.createComponent(PaletteHost);
    secondFixture.detectChanges();
    const secondRoot = secondFixture.nativeElement as HTMLElement;
    expect(secondRoot.querySelector('[title="#123456"]')).toBeNull();
    secondFixture.componentInstance.color.setValue('#123456');
    secondFixture.detectChanges();
    expect(secondRoot.querySelector('.palette-add')?.classList.contains('is-selected')).toBe(true);
    expect(secondRoot.querySelector('[title="#123456"]')).toBeNull();
  });

  it('disables all choices when the form control is disabled', () => {
    const fixture = TestBed.createComponent(PaletteHost);
    fixture.detectChanges();
    fixture.componentInstance.color.disable();
    fixture.detectChanges();
    const buttons = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>(
      '.palette-row button',
    );
    expect(buttons.length).toBeGreaterThan(0);
    expect([...buttons].every((button) => button.disabled)).toBe(true);
  });

  it('changes hue, saturation, and brightness without accepting invalid HEX', () => {
    const fixture = TestBed.createComponent(PaletteHost);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    (root.querySelector('.palette-add') as HTMLButtonElement).click();
    fixture.detectChanges();
    const hexInput = root.querySelector('.palette-hex input') as HTMLInputElement;
    hexInput.value = '#NOTHEX';
    hexInput.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    expect(fixture.componentInstance.color.value).toBe('#3b82f6');
    expect((root.querySelector('.palette-done') as HTMLButtonElement).disabled).toBe(true);

    hexInput.value = '#00FF00';
    hexInput.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    expect(fixture.componentInstance.color.value).toBe('#00FF00');

    const hueInput = root.querySelector('input[type="range"]') as HTMLInputElement;
    hueInput.value = '240';
    hueInput.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    expect(fixture.componentInstance.color.value).toBe('#0000FF');

    const saturationBrightness = root.querySelector(
      '.palette-saturation-brightness',
    ) as HTMLElement;
    saturationBrightness.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
    );
    fixture.detectChanges();
    expect(fixture.componentInstance.color.value).toBe('#0000FC');
  });
});

describe('palette color conversion', () => {
  it('normalizes HEX and round trips colors through HSV', () => {
    expect(normalizeHex('#abc')).toBe('#AABBCC');
    expect(normalizeHex('#gggggg')).toBeNull();
    expect(textColorForBackground('#FFFFFF')).toBe('#0F172A');
    expect(textColorForBackground('#123456')).toBe('#FFFFFF');
    for (const color of ['#7C3AED', '#10B981', '#EF4444', '#000000', '#FFFFFF']) {
      expect(hsvToHex(hexToHsv(color))).toBe(color);
    }
  });
});
