import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  computed,
  forwardRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import {
  hexToHsv,
  hsvToHex,
  normalizeHex,
  textColorForBackground,
  type HsvColor,
} from './color.utils';

const DEFAULT_COLORS = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6'];
let nextPaletteId = 0;

@Component({
  selector: 'app-quick-palette',
  standalone: true,
  templateUrl: './quick-palette.component.html',
  styleUrl: './quick-palette.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => QuickPaletteComponent),
      multi: true,
    },
  ],
})
export class QuickPaletteComponent implements ControlValueAccessor {
  readonly label = input('Cor');
  readonly presets = input<readonly string[]>(DEFAULT_COLORS);
  readonly panelId = `quick-palette-${++nextPaletteId}`;
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly addButton = viewChild<ElementRef<HTMLButtonElement>>('addButton');

  readonly value = signal('');
  readonly disabled = signal(false);
  readonly open = signal(false);
  readonly hsv = signal<HsvColor>(hexToHsv('#3B82F6'));
  readonly hexDraft = signal('#3B82F6');
  readonly panelTop = signal(0);
  readonly panelLeft = signal(0);
  readonly panelWidth = signal(320);
  readonly colors = computed(() => [
    ...new Set(
      this.presets()
        .map(normalizeHex)
        .filter((color): color is string => !!color),
    ),
  ]);
  readonly customSelected = computed(() => {
    const current = normalizeHex(this.value());
    return !!current && !this.colors().includes(current);
  });
  readonly customTextColor = computed(() => textColorForBackground(this.value()));
  private dragging = false;
  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  constructor() {
    const reposition = () => {
      if (this.open()) this.positionPanel();
    };
    document.addEventListener('scroll', reposition, true);
    this.destroyRef.onDestroy(() => document.removeEventListener('scroll', reposition, true));
  }

  writeValue(value: string | null): void {
    this.value.set(value ?? '');
    const hex = normalizeHex(value ?? '');
    if (hex) {
      this.hsv.set(hexToHsv(hex));
      this.hexDraft.set(hex);
    }
  }

  registerOnChange(callback: (value: string) => void): void {
    this.onChange = callback;
  }

  registerOnTouched(callback: () => void): void {
    this.onTouched = callback;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
    if (isDisabled) this.close();
  }

  isSelected(color: string): boolean {
    return normalizeHex(this.value()) === color;
  }

  validDraft(): boolean {
    return /^#?[0-9a-fA-F]{6}$/.test(this.hexDraft().trim());
  }

  selectPreset(color: string): void {
    if (this.disabled()) return;
    this.setColor(color);
    this.close();
  }

  toggle(): void {
    if (this.disabled()) return;
    if (this.open()) {
      this.close();
      return;
    }
    const current = normalizeHex(this.value()) ?? '#3B82F6';
    this.hsv.set(hexToHsv(current));
    this.hexDraft.set(current);
    this.positionPanel();
    this.open.set(true);
  }

  close(): void {
    if (!this.open()) return;
    this.open.set(false);
    this.onTouched();
  }

  finishColor(): void {
    if (!this.validDraft() || this.disabled()) return;
    this.close();
    this.addButton()?.nativeElement.focus();
  }

  onHexInput(event: Event): void {
    const draft = (event.target as HTMLInputElement).value;
    this.hexDraft.set(draft);
    const color = /^#?[0-9a-fA-F]{6}$/.test(draft.trim()) ? normalizeHex(draft) : null;
    if (!color || this.disabled()) return;
    this.setColor(color);
  }

  onHueInput(event: Event): void {
    if (this.disabled()) return;
    const hue = Number((event.target as HTMLInputElement).value);
    this.applyHsv({ ...this.hsv(), hue });
  }

  onSaturationBrightnessPointerDown(event: PointerEvent): void {
    if (this.disabled()) return;
    this.dragging = true;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    this.updateSaturationBrightness(event);
  }

  onSaturationBrightnessPointerMove(event: PointerEvent): void {
    if (this.dragging) this.updateSaturationBrightness(event);
  }

  onSaturationBrightnessPointerUp(): void {
    this.dragging = false;
  }

  onSaturationBrightnessKeydown(event: KeyboardEvent): void {
    const step = event.shiftKey ? 10 : 1;
    const current = this.hsv();
    let next: HsvColor;
    switch (event.key) {
      case 'ArrowLeft':
        next = { ...current, saturation: current.saturation - step };
        break;
      case 'ArrowRight':
        next = { ...current, saturation: current.saturation + step };
        break;
      case 'ArrowUp':
        next = { ...current, brightness: current.brightness + step };
        break;
      case 'ArrowDown':
        next = { ...current, brightness: current.brightness - step };
        break;
      default:
        return;
    }
    event.preventDefault();
    this.applyHsv(next);
  }

  @HostListener('document:pointerdown', ['$event'])
  onDocumentPointerDown(event: PointerEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) this.close();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (!this.open()) return;
    this.close();
    this.addButton()?.nativeElement.focus();
  }

  @HostListener('window:resize')
  onResize(): void {
    if (this.open()) this.positionPanel();
  }

  private updateSaturationBrightness(event: PointerEvent): void {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const saturation = ((event.clientX - rect.left) / rect.width) * 100;
    const brightness = (1 - (event.clientY - rect.top) / rect.height) * 100;
    this.applyHsv({ ...this.hsv(), saturation, brightness });
  }

  private applyHsv(next: HsvColor): void {
    const hsv = {
      hue: Math.max(0, Math.min(359, next.hue)),
      saturation: Math.max(0, Math.min(100, next.saturation)),
      brightness: Math.max(0, Math.min(100, next.brightness)),
    };
    this.hsv.set(hsv);
    this.setColor(hsvToHex(hsv), false);
  }

  private setColor(color: string, updateHsv = true): void {
    const hex = normalizeHex(color);
    if (!hex) return;
    if (updateHsv) this.hsv.set(hexToHsv(hex));
    this.hexDraft.set(hex);
    if (this.value() !== hex) {
      this.value.set(hex);
      this.onChange(hex);
    }
    this.onTouched();
  }

  private positionPanel(): void {
    const rect = this.host.nativeElement.getBoundingClientRect();
    const width = Math.min(320, window.innerWidth - 24);
    const height = 372;
    const below = window.innerHeight - rect.bottom;
    const top = below >= height + 12 || below >= rect.top ? rect.bottom + 8 : rect.top - height - 8;
    this.panelTop.set(Math.max(12, Math.min(top, window.innerHeight - height - 12)));
    this.panelLeft.set(Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)));
    this.panelWidth.set(width);
  }
}
