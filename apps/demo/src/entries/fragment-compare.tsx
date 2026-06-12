import { mountPage } from '../react/mountPage.js';
import { FragmentComparePageShell } from '../react/pages.js';

void mountPage({
  bodyClass: 'dev-page fragment-compare-page',
  children: <FragmentComparePageShell />,
  loadController: () => import('../fragment-compare-main.js'),
});
