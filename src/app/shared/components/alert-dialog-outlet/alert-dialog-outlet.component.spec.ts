import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, beforeEach } from 'vitest';
import { SideDrawerComponent } from '@shared/components/side-drawer/side-drawer.component';
import { AlertDialogService } from '@shared/services/alert-dialog.service';
import { AlertDialogOutletComponent } from './alert-dialog-outlet.component';

@Component({
  standalone: true,
  imports: [SideDrawerComponent, AlertDialogOutletComponent],
  template: `
    <button type="button" id="origin">Abrir confirmação</button>
    <app-side-drawer [open]="drawerOpen" title="Editar" (closed)="drawerOpen = false">
      <p>Dados do formulário</p>
    </app-side-drawer>
    <app-alert-dialog-outlet />
  `,
})
class DialogHostComponent {
  drawerOpen = true;
}

describe('AlertDialogOutletComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [DialogHostComponent] }).compileComponents();
  });

  it('shows the alert modal, cancels, and restores focus', async () => {
    const fixture = TestBed.createComponent(DialogHostComponent);
    fixture.detectChanges();
    const origin = fixture.nativeElement.querySelector('#origin') as HTMLButtonElement;
    origin.focus();

    const service = TestBed.inject(AlertDialogService);
    const result = service.confirm('Excluir este item?');
    fixture.detectChanges();
    await fixture.whenStable();

    const dialog = [...fixture.nativeElement.querySelectorAll('[role="dialog"]')].find(
      (item: HTMLElement) => item.textContent?.includes('Confirmar exclusão'),
    ) as HTMLElement;
    expect(dialog.textContent).toContain('Excluir este item?');
    const cancel = [...dialog.querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === 'Cancelar',
    ) as HTMLButtonElement;
    expect(document.activeElement).toBe(cancel);

    cancel.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(await result).toBe(false);
    expect(fixture.componentInstance.drawerOpen).toBe(true);
    expect(document.activeElement).toBe(origin);
  });

  it('confirms only after the user clicks Excluir', async () => {
    const fixture = TestBed.createComponent(DialogHostComponent);
    fixture.detectChanges();
    const service = TestBed.inject(AlertDialogService);
    const result = service.confirm('Excluir este item?');
    const duplicate = service.confirm('Excluir outro item?');
    expect(await duplicate).toBe(false);
    fixture.detectChanges();

    const dialog = [...fixture.nativeElement.querySelectorAll('[role="dialog"]')].find(
      (item: HTMLElement) => item.textContent?.includes('Confirmar exclusão'),
    ) as HTMLElement;
    expect(dialog.textContent).not.toContain('Excluir outro item?');
    const confirm = [...dialog.querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === 'Excluir',
    ) as HTMLButtonElement;
    confirm.click();
    fixture.detectChanges();
    expect(await result).toBe(true);
  });

  it('uses Escape to cancel the alert without closing the drawer behind it', async () => {
    const fixture = TestBed.createComponent(DialogHostComponent);
    fixture.detectChanges();
    const service = TestBed.inject(AlertDialogService);
    const result = service.confirm('Excluir este item?');
    fixture.detectChanges();

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    );
    fixture.detectChanges();
    expect(await result).toBe(false);
    expect(fixture.componentInstance.drawerOpen).toBe(true);
  });
});
