/**
 * One reason in plain words and one action for a card waiting in the admin queue, instead of the raw list of failed
 * checks ("Название · Фото · Цена · Валюта · …"). Order: what blocks a sale first (27 October 2026).
 */
export type QueueAction = 'recheck' | 'edit' | 'delete';
export type QueueVerdict = { text: string; action?: QueueAction; label?: string };

const has = (all: string, ...parts: string[]) => parts.some(part => all.includes(part));

export function catalogQueueVerdict(details: string, soldOut = false): QueueVerdict {
  const all = details;
  if (has(all, 'Ручной ввод')) return { text: 'Магазин без автоимпорта — заполните карточку со страницы магазина.', action: 'edit', label: 'Заполнить' };
  if (soldOut || has(all, 'Нет доступных вариантов')) return { text: 'Магазин сообщает: нет в наличии.', action: 'delete', label: 'Удалить черновик' };
  if (has(all, 'Ошибка проверки магазина') && has(all, 'Название')) return { text: 'Магазин не ответил — данных нет.', action: 'recheck', label: 'Перечитать' };
  if (has(all, 'Цена', 'Валюта', 'Не подтверждена цена')) return { text: 'Магазин не отдал цену.', action: 'recheck', label: 'Перечитать' };
  if (has(all, 'Доступный вариант', 'Нет подтверждённого доступного варианта', 'Подтвердите доступный вариант')) return { text: 'Магазин не отдал размеры или цвета.', action: 'recheck', label: 'Перечитать' };
  if (has(all, 'Страна отправки')) return { text: 'Не указана страна отправки.', action: 'edit', label: 'Указать' };
  if (has(all, 'Фото')) return { text: 'Нет фото товара.', action: 'edit', label: 'Добавить фото' };
  if (has(all, 'Название')) return { text: 'Нет названия.', action: 'edit', label: 'Указать' };
  if (has(all, 'Стоимость выше лимита')) return { text: 'Дороже $10 000 — Atlas такое не везёт.', action: 'delete', label: 'Удалить черновик' };
  if (has(all, 'Обновите источник')) return { text: 'Данные устарели.', action: 'recheck', label: 'Перечитать' };
  if (has(all, 'уточняем у магазина', 'полноту вариантов', 'точные доступные варианты', 'фотографии конкретного варианта', 'уточним перед выкупом')) return { text: 'Опубликовано; часть вариантов уточняется при следующей проверке.' };
  if (has(all, 'неполный', 'неполные данные')) return { text: 'Магазин ответил не полностью — карточка не менялась.', action: 'recheck', label: 'Перечитать' };
  return { text: all };
}
