const validThemes = ['commerce', 'editorial', 'refined'];
const validScreens = ['catalog', 'product', 'cart', 'account'];
const params = new URLSearchParams(location.hash.slice(1));
const selection = { theme: validThemes.includes(params.get('theme')) ? params.get('theme') : 'commerce', screen: validScreens.includes(params.get('screen')) ? params.get('screen') : 'catalog', lang: ['ru','uz','en'].includes(params.get('lang')) ? params.get('lang') : 'ru', state: 'ready' };
const frame = document.querySelector('#preview');
const notes = {
  commerce: ['A', 'Покупки на первом плане.', 'Чёткая сетка, спокойный фон и выразительный тёмно-синий. Лайм подчёркивает главное действие. Универсальная основа для одежды, техники и косметики.'],
  editorial: ['B', 'У сервиса появляется почерк.', 'Журнальная типографика, крупная фотография, открытая композиция. Более выразительная главная и сдержанные рабочие экраны. Подходит, если одежда станет главным направлением.'],
  refined: ['C', 'Тот же Atlas. Более цельный.', 'Знакомые синий и лайм, мягкие карточки и ясная иерархия. Самый бережный переход от текущего интерфейса: меньше визуального риска, больше преемственности.']
};
function sync() {
  document.querySelectorAll('[data-direction]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.direction === selection.theme)));
  document.querySelectorAll('[data-screen]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.screen === selection.screen)));
  document.querySelector('#locale').value = selection.lang;
  const [id, title, body] = notes[selection.theme];
  document.querySelector('#note-id').textContent = `НАПРАВЛЕНИЕ ${id}`;
  document.querySelector('#note-title').textContent = title;
  document.querySelector('#note-body').textContent = body;
  const query = new URLSearchParams(selection).toString();
  document.querySelector('#full-screen').href = `screen.html?${query}`;
  history.replaceState(null, '', `#${query}`);
  frame.contentWindow.postMessage({ type: 'atlas-design', ...selection }, location.origin);
}
document.querySelectorAll('[data-direction]').forEach(button => button.addEventListener('click', () => { selection.theme = button.dataset.direction; sync(); }));
document.querySelectorAll('[data-screen]').forEach(button => button.addEventListener('click', () => { selection.screen = button.dataset.screen; selection.state = 'ready'; document.querySelector('#state').value = 'ready'; sync(); }));
document.querySelector('#locale').addEventListener('change', event => { selection.lang = event.target.value; sync(); });
document.querySelector('#state').addEventListener('change', event => { selection.state = event.target.value; sync(); });
document.querySelector('#device').addEventListener('click', event => { const mobile = frame.classList.toggle('mobile'); event.currentTarget.setAttribute('aria-pressed', String(mobile)); event.currentTarget.textContent = mobile ? 'На весь экран' : 'Телефон 390 px'; });
frame.addEventListener('load', sync);
window.addEventListener('message', event => { if (event.origin !== location.origin || event.source !== frame.contentWindow || event.data?.type !== 'atlas-screen' || !validScreens.includes(event.data.screen)) return; selection.screen = event.data.screen; sync(); });
sync();
