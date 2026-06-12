import { mountPage } from '../react/mountPage.js';
import { StrictPageShell } from '../react/pages.js';

void mountPage({
  bodyClass: 'dev-page utility-page',
  children: <StrictPageShell />,
  loadController: () => import('../strict-main.js'),
});
