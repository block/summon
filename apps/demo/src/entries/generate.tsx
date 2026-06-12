import { mountPage } from '../react/mountPage.js';
import { GeneratePageShell } from '../react/pages.js';

void mountPage({
  bodyClass: 'dev-page generate-page',
  children: <GeneratePageShell />,
  loadController: () => import('../generate-main.js'),
});
