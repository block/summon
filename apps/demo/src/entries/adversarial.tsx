import { mountPage } from '../react/mountPage.js';
import { AdversarialPageShell } from '../react/pages.js';

void mountPage({
  bodyClass: 'dev-page utility-page',
  children: <AdversarialPageShell />,
  loadController: () => import('../main.js'),
});
