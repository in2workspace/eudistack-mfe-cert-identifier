import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/**
 * AppComponent — shell raíz de la SPA.
 *
 * Equivalente al App.tsx del proyecto React; delega toda la lógica de
 * presentación a ClaveAuthComponent (cargado vía lazy route).
 * El redirect al Portal de Emisión lo gestiona el propio ClaveAuthComponent
 * en su método `emitAuthenticated()`.
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: '<router-outlet></router-outlet>',
})
export class AppComponent {}
