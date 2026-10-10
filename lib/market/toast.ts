// sonner, loaded on demand: the shared store chunk of every page keeps only this small queue, and the library
// (with its injected styles) arrives when the shell mounts its Toaster after the first screen, or with the first toast.
// Calls made before that wait for the Toaster to subscribe, in order, so no message is lost.
type Sonner = typeof import('sonner');
type Toast = Sonner['toast'];

let loading: Promise<Sonner> | undefined;
export const loadSonner = () => (loading ??= import('sonner'));

let resolveMounted: () => void = () => {};
const mounted = new Promise<void>(resolve => { resolveMounted = resolve; });
let requestMount: () => void = () => {};
let requested = false;

/** The shell's Toaster slot: registers how to mount itself and reports once sonner's Toaster has subscribed. */
export const toasterHost = {
  onRequest(mount: () => void) { requestMount = mount; if (requested) mount(); },
  mounted: () => resolveMounted(),
};

function run(call: (toast: Toast) => void) {
  requested = true;
  requestMount();
  void Promise.all([loadSonner(), mounted]).then(([module]) => call(module.toast));
}

/** Same calls as sonner's `toast` (success, error, warning, message, dismiss); they do not return the toast id. */
export const toast = {
  success: (...args: Parameters<Toast['success']>) => run(toast => toast.success(...args)),
  error: (...args: Parameters<Toast['error']>) => run(toast => toast.error(...args)),
  warning: (...args: Parameters<Toast['warning']>) => run(toast => toast.warning(...args)),
  message: (...args: Parameters<Toast['message']>) => run(toast => toast.message(...args)),
  /** Nothing to dismiss before sonner has loaded. */
  dismiss: (...args: Parameters<Toast['dismiss']>) => { if (loading) run(toast => toast.dismiss(...args)); },
};
