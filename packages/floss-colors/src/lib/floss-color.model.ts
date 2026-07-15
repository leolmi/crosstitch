/** Un colore di filato da ricamo con i codici degli standard supportati. */
export interface FlossColor {
  /** Codice DMC (es. '310', 'B5200', 'White', 'Ecru') */
  dmc: string;
  /** Nome commerciale DMC del colore */
  name: string;
  /** Colore equivalente in hex sRGB, formato '#rrggbb' minuscolo */
  hex: string;
  /** Codice Anchor equivalente, dove noto */
  anchor?: string;
}
