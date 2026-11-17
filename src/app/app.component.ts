import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './shared/header.component';
import { FooterComponent } from './shared/footer.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, FooterComponent],
  template: `<app-header /><main class="page"><router-outlet /></main><app-footer />`,
  styles: `.page { max-width: 1200px; margin: 0 auto; padding: 16px }`,
})
export class AppComponent {}
