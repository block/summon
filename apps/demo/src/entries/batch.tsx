import { mountPage } from '../react/mountPage.js';
import { BatchPageShell } from '../react/pages.js';

void mountPage({
  bodyClass: 'dev-page batch-page',
  children: <BatchPageShell />,
  loadController: () => import('../batch-main.js'),
});
