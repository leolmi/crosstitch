import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  {
    // il wizard vive sulla root: URL canonico pulito per i motori di ricerca
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./features/pattern-wizard/pattern-wizard').then(
        (m) => m.PatternWizard,
      ),
  },
  { path: '**', redirectTo: '' },
];
