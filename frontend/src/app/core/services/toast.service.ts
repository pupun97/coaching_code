import { Injectable, signal } from '@angular/core';
import { ToastMessage } from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<ToastMessage[]>([]);
  readonly confirmModal = signal<{
    open: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    danger: boolean;
    onConfirm?: () => void;
  }>({
    open: false,
    title: '',
    message: '',
    confirmLabel: 'Confirm',
    danger: true,
  });

  show(type: ToastMessage['type'], title: string, message: string, durationMs = 4000) {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    this.toasts.update((list) => [...list, { id, type, title, message }]);
    setTimeout(() => this.dismiss(id), durationMs);
  }

  success(title: string, message = '') {
    this.show('success', title, message);
  }

  error(title: string, message = '') {
    this.show('error', title, message, 5500);
  }

  info(title: string, message = '') {
    this.show('info', title, message);
  }

  warning(title: string, message = '') {
    this.show('warning', title, message);
  }

  dismiss(id: string) {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }

  confirm(options: {
    title: string;
    message: string;
    confirmLabel?: string;
    danger?: boolean;
    onConfirm: () => void;
  }) {
    this.confirmModal.set({
      open: true,
      title: options.title,
      message: options.message,
      confirmLabel: options.confirmLabel || 'Confirm',
      danger: options.danger ?? true,
      onConfirm: options.onConfirm,
    });
  }

  closeConfirm(confirmed: boolean) {
    const current = this.confirmModal();
    this.confirmModal.update((s) => ({ ...s, open: false }));
    if (confirmed && current.onConfirm) {
      current.onConfirm();
    }
  }
}
