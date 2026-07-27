import { Component, computed, input, output } from '@angular/core';
import { NgClass } from '@angular/common';

/**
 * ButtonComponent — porta el primitivo `<Button>` de la UI React.
 *
 * Variantes disponibles (mismas que el original React):
 *   default  | destructive | outline | secondary | ghost | link
 *
 * Tamaños:
 *   default | sm | lg | icon
 *
 * Uso:
 *   <app-button variant="ghost" [disabled]="loading()" (clicked)="doSomething()">
 *     Texto
 *   </app-button>
 *
 * Nota: el evento se llama `clicked` (no `click`) para no chocar con el evento
 * nativo del host. El parent puede usar `(clicked)` o el nativo `(click)` directamente.
 */
@Component({
  selector: 'app-button',
  standalone: true,
  imports: [NgClass],
  template: `
    <button
      [type]="type()"
      [disabled]="disabled()"
      [ngClass]="classes()"
      (click)="clicked.emit($event)"
    >
      <ng-content></ng-content>
    </button>
  `,
  styles: [':host { display: contents; }'],
})
export class ButtonComponent {
  readonly variant = input<
    'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  >('default');

  readonly size = input<'default' | 'sm' | 'lg' | 'icon'>('default');

  readonly disabled = input<boolean>(false);

  readonly type = input<'button' | 'submit' | 'reset'>('button');

  /** Extra Tailwind classes forwarded from the parent (equivalent to React's `className`). */
  readonly extraClass = input<string>('');

  readonly clicked = output<MouseEvent>();

  protected readonly classes = computed<string[]>(() => {
    const base =
      'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all ' +
      'disabled:pointer-events-none disabled:opacity-50 outline-none';

    const variantClasses: Record<string, string> = {
      default: 'bg-brand-secondary text-brand-secondary-contrast hover:opacity-90',
      destructive: 'bg-red-600 text-white hover:bg-red-700',
      outline:
        'border border-gray-200 bg-white text-gray-900 hover:bg-gray-50 hover:text-gray-900',
      secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200',
      ghost: 'hover:bg-gray-100 hover:text-gray-900',
      link: 'text-brand-accent underline-offset-4 hover:underline',
    };

    const sizeClasses: Record<string, string> = {
      default: 'h-9 px-4 py-2',
      sm: 'h-8 rounded-md px-3',
      lg: 'h-10 rounded-md px-6',
      icon: 'size-9 rounded-md',
    };

    return [
      base,
      variantClasses[this.variant()] ?? variantClasses['default'],
      sizeClasses[this.size()] ?? sizeClasses['default'],
      this.extraClass(),
    ].filter(Boolean);
  });
}
