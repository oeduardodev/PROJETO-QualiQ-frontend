import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

// Supabase may fall back to the configured Site URL when a redirect is not allowed.
// Keep the auth tokens in the URL while opening the password setup screen.
const authLinkType =
  new URLSearchParams(window.location.hash.slice(1)).get('type') ??
  new URLSearchParams(window.location.search).get('type');
if (
  (authLinkType === 'invite' || authLinkType === 'recovery') &&
  window.location.pathname.replace(/\/$/, '') !== '/definir-senha'
) {
  window.history.replaceState(
    null,
    '',
    `/definir-senha${window.location.search}${window.location.hash}`,
  );
}

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
