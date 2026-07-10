import { Component, computed, input, output } from '@angular/core';

/**
 * InputComponent — porta el primitivo `<Input>` de la UI React.
 *
 * Renderiza un `<input>` nativo con las clases Tailwind del diseño original.
 * El host usa `display: contents` para que el `<input>` interno no quede
 * envuelto en un contenedor adicional.
 *
 * Uso:
 *   <app-input
 *     id="dni"
 *     placeholder="12345678A"
 *     [value]="dni()"
 *     (valueChange)="dni.set($event)"
 *     extraClass="mt-2"
 *   ></app-input>
 */
@Component({
  selector: 'app-input',
  standalone: true,
  template: `
    <input
      [id]="id()"
      [type]="type()"
      [placeholder]="placeholder()"
      [value]="value()"
      [disabled]="disabled()"
      [class]="classes()"
      (input)="onInput($event)"
    />
  `,
  styles: [':host { display: contents; }'],
})
export class InputComponent {
  readonly id = input<string>('');
  readonly type = input<string>('text');
  readonly placeholder = input<string>('');
  readonly value = input<string>('');
  readonly disabled = input<boolean>(false);

  /** Extra Tailwind classes from the parent (equivalent to React's `className`). */
  readonly extraClass = input<string>('');

  readonly valueChange = output<string>();

  protected readonly classes = computed(
    () =>
      'placeholder:text-gray-400 border-gray-200 flex h-9 w-full min-w-0 rounded-md border ' +
      'px-3 py-1 text-base bg-white transition-colors outline-none ' +
      'focus-visible:border-gray-400 focus-visible:ring-2 focus-visible:ring-gray-400/50 ' +
      'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm ' +
      this.extraClass(),
  );

  protected onInput(event: Event): void {
    this.valueChange.emit((event.target as HTMLInputElement).value);
  }
}
