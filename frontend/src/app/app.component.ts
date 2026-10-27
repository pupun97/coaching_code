import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { ToastService } from './core/services/toast.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  template: `
    <router-outlet></router-outlet>

    <!-- Global Toast Notification Stack -->
    <div class="toast-stack" aria-live="polite">
      @for (t of toast.toasts(); track t.id) {
        <div class="toast-item" [attr.data-type]="t.type">
          <div class="toast-body">
            <strong>{{ t.title }}</strong>
            @if (t.message) {
              <div>{{ t.message }}</div>
            }
          </div>
          <button class="toast-close" (click)="toast.dismiss(t.id)" aria-label="Dismiss notification">✕</button>
        </div>
      }
    </div>

    <!-- Global Confirmation Dialog for Destructive / Critical Actions -->
    @if (toast.confirmModal().open) {
      <div class="confirm-backdrop" role="dialog" aria-modal="true">
        <div class="confirm-dialog card">
          <h3 style="margin:0 0 8px">{{ toast.confirmModal().title }}</h3>
          <p style="margin:0 0 20px;color:#475569;font-size:0.92rem;line-height:1.5">
            {{ toast.confirmModal().message }}
          </p>
          <div style="display:flex;justify-content:flex-end;gap:10px">
            <button class="btn btn-secondary" (click)="toast.closeConfirm(false)">Cancel</button>
            <button
              class="btn"
              [class.btn-danger]="toast.confirmModal().danger"
              [class.btn-primary]="!toast.confirmModal().danger"
              (click)="toast.closeConfirm(true)"
            >
              {{ toast.confirmModal().confirmLabel }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .toast-stack {
      position: fixed; bottom: 20px; right: 20px; z-index: 9999;
      display: flex; flex-direction: column; gap: 10px; max-width: 380px; width: 100%;
      pointer-events: none;
    }
    .toast-item {
      pointer-events: auto;
      display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;
      padding: 14px 16px; border-radius: 12px; background: #0f172a; color: #fff;
      box-shadow: 0 10px 25px rgba(15, 23, 42, 0.2); font-size: 0.86rem;
      border-left: 5px solid #4f46e5;
      &[data-type='success'] { border-left-color: #10b981; }
      &[data-type='error'] { border-left-color: #ef4444; }
      &[data-type='warning'] { border-left-color: #f59e0b; }
    }
    .toast-close { background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 0.9rem; }
    .confirm-backdrop {
      position: fixed; inset: 0; background: rgba(15, 23, 42, 0.55);
      display: flex; align-items: center; justify-content: center; z-index: 9998; padding: 16px;
    }
    .confirm-dialog { width: 100%; max-width: 440px; }
    @media (max-width: 640px) {
      .toast-stack {
        bottom: 12px; left: 12px; right: 12px; max-width: none; width: auto;
      }
    }
  `],
})
export class AppComponent {
  readonly toast = inject(ToastService);
}
