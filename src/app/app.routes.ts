import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/auth/clave-auth/clave-auth.component').then(
        (m) => m.ClaveAuthComponent,
      ),
  },
  { path: '**', redirectTo: '' },
];
