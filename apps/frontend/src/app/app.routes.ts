import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  {
    path: 'nuovo-schema',
    loadComponent: () =>
      import('./features/pattern-wizard/pattern-wizard').then(
        (m) => m.PatternWizard,
      ),
  },
  { path: '', pathMatch: 'full', redirectTo: 'nuovo-schema' },
  { path: '**', redirectTo: 'nuovo-schema' },
];
