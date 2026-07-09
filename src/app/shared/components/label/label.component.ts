import { Component, input } from '@angular/core';

/**
 * LabelComponent — porta el primitivo `<Label>` de la UI React.
 *
 * Renderiza un `<label>` nativo. El host usa `display: contents`
 * para transparencia de layout.
 *
 * Uso:
 *   <app-label [for]="'dni'">Número de DNI</app-label>
 */
@Component({
  selector: 'app-label',
  standalone: true,
  template: `
    <label [htmlFor]="for()" class="flex items-center gap-2 text-sm font-medium leading-none select-none">
      <ng-content></ng-content>
    </label>
  `,
  styles: [':host { display: contents; }'],
})
export class LabelComponent {
  readonly for = input<string>('');
}
