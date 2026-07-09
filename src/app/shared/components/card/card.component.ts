import { Component, computed, input } from '@angular/core';

/**
 * CardComponent — porta el primitivo `<Card>` de la UI React.
 *
 * Base classes: bg-white text-gray-900 flex flex-col gap-6 rounded-xl border
 * El parent pasa clases extra (padding, cursor, hover) via `extraClass`.
 *
 * Uso:
 *   <app-card extraClass="p-6 cursor-pointer hover:shadow-lg">
 *     contenido
 *   </app-card>
 */
@Component({
  selector: 'app-card',
  standalone: true,
  template: '<ng-content></ng-content>',
  host: {
    '[class]': 'hostClass()',
  },
})
export class CardComponent {
  /** Extra Tailwind classes (padding, cursor, hover) from the parent. */
  readonly extraClass = input<string>('');

  protected readonly hostClass = computed(
    () =>
      'bg-white text-gray-900 flex flex-col gap-6 rounded-xl border ' +
      this.extraClass(),
  );
}
