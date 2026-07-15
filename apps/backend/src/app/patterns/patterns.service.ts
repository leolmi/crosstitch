import { Injectable } from '@nestjs/common';

export interface Pattern {
  id: string;
  name: string;
  /** Larghezza in punti */
  width: number;
  /** Altezza in punti */
  height: number;
  /** Numero di colori (matassine) usati */
  colors: number;
}

/**
 * Dati statici provvisori: verranno sostituiti dal repository MongoDB
 * quando la connessione Mongoose sarà attivata (vedi app.module.ts).
 */
const STATIC_PATTERNS: Pattern[] = [
  { id: '1', name: 'Rosa antica', width: 80, height: 60, colors: 12 },
  { id: '2', name: 'Veliero al tramonto', width: 120, height: 90, colors: 24 },
  { id: '3', name: 'Alfabeto floreale', width: 200, height: 150, colors: 18 },
];

@Injectable()
export class PatternsService {
  findAll(): Pattern[] {
    return STATIC_PATTERNS;
  }
}
