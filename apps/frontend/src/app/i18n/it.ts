/**
 * Dizionario italiano: è la fonte di verità per le chiavi di traduzione.
 * Il tipo TranslationKey deriva da qui, quindi il dizionario inglese (en.ts)
 * deve fornire esattamente le stesse chiavi: se ne manca una, o ne ha una in
 * più, è errore di compilazione.
 *
 * Chiavi piatte in dot-notation, raggruppate per prefisso di dominio.
 * Nelle stringhe, i parametri dinamici usano la forma {nome}.
 */
export const it = {
  // comuni / riusate
  'common.next': 'Avanti',
  'common.back': 'Indietro',

  // SEO: titolo del documento e meta description (vedi App), intestazione
  // visibile della pagina (vedi PatternWizard)
  'seo.title': 'Crosstitch - App per Punto Croce Online | Disegna e Ricama',
  'seo.description':
    'Trasforma le tue immagini in schemi punto croce: ritocca la foto, scegli i colori dei filati DMC o Anchor e scarica il PDF con schema a simboli e lista filati. Gratis, senza registrazione.',
  'intro.title': 'Crea schemi punto croce dalle tue immagini',
  'intro.text':
    'Crosstitch è un’app gratuita per il punto croce: carica una foto o un disegno, ritocca l’immagine, scomponila nei colori dei filati DMC o Anchor e scarica lo schema in PDF con legenda e lista filati. Tutto nel browser, senza registrazione.',

  // barra dell'applicazione
  'toolbar.language': 'Lingua',
  'toolbar.github': 'Codice sorgente su GitHub',
  'toolbar.theme': 'Tema',
  'theme.light': 'Chiaro',
  'theme.dark': 'Scuro',
  'theme.auto': 'Automatico',

  // passi del wizard
  'wizard.step.source': 'Scelta immagine',
  'wizard.step.editing': 'Elaborazione',
  'wizard.step.decomposition': 'Scomposizione',
  'wizard.step.download': 'Download schema',

  // primo passo: scelta immagine o apertura documento
  'source.preview-alt': 'Anteprima immagine selezionata',
  'source.remove': 'Rimuovi e scegli un’altra immagine',
  'source.dropzone-hint': 'Trascina qui un’immagine o uno schema, oppure',
  'source.choose-file': 'Scegli dal PC',
  'source.url-label': '…o incolla il link di un’immagine o schema',
  'source.load-url': 'Carica da URL',
  'source.loading-aria': 'Caricamento immagine',

  // comuni riusati (editor e scomposizione)
  'common.zoom-out': 'Riduci zoom',
  'common.zoom-in': 'Aumenta zoom',
  'common.zoom-fit': 'Adatta alla finestra',
  'common.apply': 'Applica',

  // editor immagine
  'editor.placeholder-no-source':
    'Carica prima un’immagine nello step “Scelta immagine”.',
  'editor.undo': 'Annulla',
  'editor.redo': 'Ripeti',
  'editor.reset-original': 'Ripristina l’immagine originale',
  'editor.real-size': 'Dimensione reale (100%)',
  'editor.tool.wand': 'Bacchetta',
  'editor.tool.wand-tip': 'Bacchetta: rimuove le aree di colore simile',
  'editor.tool.eraser': 'Gomma',
  'editor.tool.eraser-tip': 'Gomma: cancella direttamente col pennello',
  'editor.tool.crop': 'Ritaglio',
  'editor.tool.crop-tip': 'Ritaglio: seleziona l’area da tenere',
  'editor.wand.tolerance': 'Tolleranza: {value}',
  'editor.wand.contiguous': 'Solo area contigua',
  'editor.wand.removed': 'Rimossi {count} pixel.',
  'editor.wand.none': 'Nessun pixel rimosso.',
  'editor.reset-initial': 'Riporta al valore iniziale',
  'editor.eraser.brush-size': 'Dimensione pennello: {size} px',
  'editor.crop.hint':
    'Trascina sull’immagine per selezionare l’area; trascina la selezione per spostarla.',
  'editor.crop.apply': 'Applica ritaglio',
  'editor.crop.clear': 'Annulla selezione',
  'editor.no-tool-hint':
    'Nessuno strumento attivo: selezionane uno per lavorare sull’immagine. Rotazione e regolazioni sono sempre disponibili qui sotto.',
  'editor.rotation.title': 'Rotazione',
  'editor.rotation.left': 'Ruota a sinistra',
  'editor.rotation.right': 'Ruota a destra',
  'editor.rotation.flip': 'Specchia orizzontalmente',
  'editor.rotation.fine-angle': 'Angolo fine: {angle}°',
  'editor.rotation.apply': 'Applica rotazione',
  'editor.reset-zero': 'Riporta a 0',
  'editor.adjust.title': 'Regolazioni',
  'editor.adjust.brightness': 'Luminosità: {value}',
  'editor.adjust.contrast': 'Contrasto: {value}',
  'editor.adjust.saturation': 'Saturazione: {value}',
  'editor.adjust.reset': 'Azzera',

  'common.close': 'Chiudi',

  // scomposizione
  'decomposition.placeholder-editing-first':
    'Completa prima lo step “Elaborazione”.',
  'decomposition.fabric-label': 'Tela',
  'decomposition.width-cm': 'Larghezza disegno (cm)',
  'decomposition.width-stitches': 'Larghezza (punti)',
  'decomposition.max-colors': 'Numero massimo colori: {count}',
  'decomposition.standard-label': 'Standard filati',
  'decomposition.anchor-hint':
    'Con lo standard Anchor la palette è limitata ai {count} colori con equivalenza nota.',
  'decomposition.fabric-color': 'Colore tela (celle non ricamate)',
  'decomposition.lock-note':
    'Parametri bloccati per non perdere i ritocchi manuali.',
  'decomposition.regenerate': 'Rigenera schema',
  'decomposition.info-points': '{width} × {height} punti',
  'decomposition.info-colors': '{count} colori',
  'decomposition.info-total-stitches': '{count} punti totali',
  'decomposition.undo': 'Annulla modifica',
  'decomposition.redo': 'Ripeti modifica',
  'decomposition.tool.paint': 'Assegna un colore alle celle',
  'decomposition.tool.choose-color': 'Scegli il colore da assegnare',
  'decomposition.tool.erase': 'Rimuovi punti (tela nuda)',
  'decomposition.computing-aria': 'Calcolo schema',
  'decomposition.empty-transparent':
    'L’immagine non contiene punti da ricamare: tutte le celle sono trasparenti.',
  'decomposition.legend.title': 'Legenda',
  'decomposition.legend.sort-label': 'Ordina per',
  'decomposition.legend.sort-count': 'Numero di punti',
  'decomposition.legend.sort-hue': 'Tonalità',
  'decomposition.legend.sort-code': 'Codice',
  'decomposition.legend.entry-count': '{count} punti',
  'decomposition.legend.edit-color': 'Sostituisci questo colore',
  'decomposition.legend.empty': 'Nessun colore calcolato.',
  'decomposition.merge-notice':
    'Colore accorpato a {code} (già presente): i punti sono stati sommati.',
  'decomposition.fabric.aida-11': 'Aida 11 count (4,3 punti/cm)',
  'decomposition.fabric.aida-14': 'Aida 14 count (5,5 punti/cm)',
  'decomposition.fabric.aida-16': 'Aida 16 count (6,3 punti/cm)',
  'decomposition.fabric.aida-18': 'Aida 18 count (7,1 punti/cm)',
  'decomposition.fabric.aida-20': 'Aida 20 count (7,9 punti/cm)',
  'decomposition.fabric.linen-25': 'Lino 25 count su 2 fili (4,9 punti/cm)',
  'decomposition.fabric.linen-28': 'Lino 28 count su 2 fili (5,5 punti/cm)',
  'decomposition.fabric.linen-32': 'Lino 32 count su 2 fili (6,3 punti/cm)',

  'common.cancel': 'Annulla',

  // selettore colore filato
  'floss-picker.title': 'Scegli un colore',
  'floss-picker.search-label': 'Cerca per codice o nome',
  'floss-picker.in-use': 'Già nello schema',
  'floss-picker.catalog-dmc': 'Catalogo DMC',
  'floss-picker.catalog-anchor': 'Catalogo Anchor',
  'floss-picker.empty': 'Nessun colore corrisponde alla ricerca.',

  // download / esportazione
  'download.placeholder-decomp-first': 'Completa prima lo step “Scomposizione”.',
  'download.ready-title': 'Schema pronto',
  'download.title-label': 'Titolo',
  'download.summary.dimensions': 'Dimensioni',
  'download.summary.measure': 'Misura',
  'download.summary.fabric': 'Tela',
  'download.summary.colors': 'Colori',
  'download.summary.total-stitches': 'Punti totali',
  'download.summary.standard': 'Standard',
  'download.strands-label': 'Capi',
  'download.strands-1': '1 capo',
  'download.strands-2': '2 capi',
  'download.strands-3': '3 capi',
  'download.strands-6': '6 capi',
  'download.floss-estimated-label': 'Filato stimato:',
  'download.floss-skeins': '{count} matassine',
  'download.floss-meters-note': '(~{meters} m) · stima indicativa',
  'download.pdf-hint':
    'Il PDF contiene la copertina con l’anteprima e i riquadri delle pagine, la lista filati (con metri/matassine stimati e caselle “Ho” e “Compra”, stampabile da sola) e lo schema a simboli.',
  'download.download-btn': 'Scarica PDF',
  'download.save-btn': 'Salva schema',
  'download.busy-aria': 'Operazione in corso',
  'download.default-title': 'Schema punto croce',

  // messaggi di errore
  'errors.not-an-image': 'Il file selezionato non è un’immagine.',
  'errors.image-too-large': 'Immagine troppo grande (massimo 20 MB).',
  'errors.url-invalid': 'URL non valido.',
  'errors.url-http-only': 'Sono supportati solo URL http(s).',
  'errors.download-failed': 'Impossibile scaricare l’immagine.',
  'errors.url-not-image': 'L’URL non restituisce un’immagine.',
  'errors.format-unrecognized': 'Formato immagine non riconosciuto.',
  'errors.load-generic': 'Errore imprevisto durante il caricamento.',
  'errors.unrecognized-file':
    'File non riconosciuto: non è un’immagine né uno schema Crosstitch.',
  'errors.pdf-generation': 'Errore durante la generazione del PDF.',
  'errors.preview-generation': 'Impossibile generare l’anteprima.',
  'errors.save-pattern': 'Errore durante il salvataggio dello schema.',
  'errors.write-denied': 'Permesso di scrittura sul file negato.',
  'errors.image-read': 'Impossibile leggere l’immagine.',
  'errors.file-not-json': 'Il file non è un JSON valido.',
  'errors.not-crosstitch': 'Il file non è uno schema Crosstitch.',
  'errors.unsupported-version': 'Versione del file non supportata.',
  'errors.file-incomplete': 'File schema incompleto o danneggiato.',
  'errors.data-corrupted': 'Dati dello schema corrotti.',
  'errors.generic': 'Operazione non riuscita.',

  // PDF generato
  'pdf.generated-by': 'Generato da Crosstitch — free web app by leolmi',
  'pdf.generated-on': 'Generato il {date}',
  'pdf.summary.dimensions': 'Dimensioni: {width} × {height} punti',
  'pdf.summary.measure': 'Misura: {width} × {height} cm',
  'pdf.summary.fabric': 'Tela: {count} count',
  'pdf.summary.colors': 'Colori: {count}',
  'pdf.summary.total-stitches': 'Punti totali: {count}',
  'pdf.summary.standard': 'Standard: {name}',
  'pdf.col.symbol': 'Simbolo',
  'pdf.col.color': 'Colore',
  'pdf.col.name': 'Nome',
  'pdf.col.points': 'Punti',
  'pdf.col.meters': 'Metri',
  'pdf.col.skeins': 'Matass.',
  'pdf.col.have': 'Ho',
  'pdf.col.buy': 'Compra',
  'pdf.floss-list-title': 'Lista filati',
  'pdf.page-of': 'Pagina {current} di {total}',
  'pdf.checklist-hint':
    'Spunta “Ho” i colori già in tuo possesso e “Compra” quelli da acquistare.',
  'pdf.estimate-note':
    'Stima con {strands} capi, matassina {skeinMeters} m, margine {waste}% — indicativa. Totale ~{skeins} matassine (~{meters} m).',
  'pdf.chart-tile':
    'Schema — riquadro {index} di {total}  (colonne {colFrom}–{colTo}, righe {rowFrom}–{rowTo})',
  'pdf.chart-title': 'Schema',
};

/** Unione di tutte le chiavi di traduzione disponibili. */
export type TranslationKey = keyof typeof it;
