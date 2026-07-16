import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  {
    path: 'pattern',
    loadComponent: () =>
      import('./features/pattern-wizard/pattern-wizard').then(
        (m) => m.PatternWizard,
      ),
  },
  { path: '', pathMatch: 'full', redirectTo: 'pattern' },
  { path: '**', redirectTo: 'pattern' },
];
