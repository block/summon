import { mountPage } from '../react/mountPage.js';
import { FatalPageShell } from '../react/pages.js';

void mountPage({
  bodyClass: 'dev-page utility-page',
  children: <FatalPageShell />,
  loadController: () => import('../fatal-main.js'),
});
