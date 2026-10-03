const interactiveSelector = '[data-go], [data-toast]';
const appRoot = document.querySelector('#app');

function makeFocusable(element) {
  if (element.matches('button, input, select, textarea, a[href]')) return;
  element.tabIndex = 0;
  element.setAttribute('role', element.tagName === 'A' ? 'link' : 'button');
}

function enhance(root) {
  if (!(root instanceof Element)) return;
  if (root.matches(interactiveSelector)) makeFocusable(root);
  root.querySelectorAll(interactiveSelector).forEach(makeFocusable);
}

if (appRoot) {
  enhance(appRoot);
  new MutationObserver((records) => {
    for (const record of records) record.addedNodes.forEach(enhance);
  }).observe(appRoot, { childList: true, subtree: true });
}

document.addEventListener('keydown', (event) => {
  if (!(event.target instanceof Element)) return;
  const control = event.target.closest(interactiveSelector);
  if (!control || control.matches('button, a[href]')) return;
  const role = control.getAttribute('role');
  const activates = event.key === 'Enter' || (role === 'button' && event.key === ' ');
  if (!activates) return;
  event.preventDefault();
  control.click();
});
