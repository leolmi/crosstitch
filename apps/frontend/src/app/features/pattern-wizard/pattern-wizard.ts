import {
  afterNextRender,
  ApplicationRef,
  Component,
  effect,
  inject,
  Injector,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatStepper, MatStepperModule } from '@angular/material/stepper';
import { TranslatePipe } from '../../i18n/translate-pipe';
import { ImageEditor } from './editor/image-editor';
import { PatternDraftStore } from './pattern-draft-store';
import { PatternFileService } from './persistence/pattern-file-service';
import { DecompositionStep } from './steps/decomposition-step';
import { DownloadStep } from './steps/download-step';
import { SourceStep } from './steps/source-step';

@Component({
  selector: 'app-pattern-wizard',
  imports: [
    MatButtonModule,
    MatStepperModule,
    TranslatePipe,
    ImageEditor,
    DecompositionStep,
    DownloadStep,
    SourceStep,
  ],
  templateUrl: './pattern-wizard.html',
  styleUrl: './pattern-wizard.scss',
})
export class PatternWizard {
  protected readonly store = inject(PatternDraftStore);
  protected readonly editor = viewChild(ImageEditor);
  protected readonly stepper = viewChild(MatStepper);
  private readonly appRef = inject(ApplicationRef);
  private readonly files = inject(PatternFileService);
  private readonly injector = inject(Injector);

  constructor() {
    // all'apertura di un file, posiziona lo stepper sull'ultimo step con dati
    effect(() => {
      if (this.files.loaded() === 0) {
        return; // nessuna apertura ancora avvenuta
      }
      // attende che i binding [completed] degli step siano propagati
      afterNextRender(() => this.goToLoadedStep(), {
        injector: this.injector,
      });
    });
  }

  /** Salta all'ultimo step per cui esistono dati caricati. */
  private goToLoadedStep(): void {
    const stepper = this.stepper();
    if (!stepper) {
      return;
    }
    stepper.selectedIndex = this.store.hasDecomposition()
      ? 2
      : this.store.hasEdited()
        ? 1
        : 0;
  }

  /** Conferma l'elaborazione corrente e passa allo step successivo. */
  protected async confirmEditing(stepper: MatStepper): Promise<void> {
    const editor = this.editor();
    if (!editor) {
      return;
    }
    await editor.commit();
    // lo stepper lineare consente next() solo a step "completed": attende
    // che la change detection propaghi store.hasEdited() al binding
    await this.appRef.whenStable();
    stepper.next();
  }
}
