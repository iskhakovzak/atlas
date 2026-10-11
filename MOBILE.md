# Мобильные приложения Atlas (iOS и Android)

Документ описывает нативную оболочку Atlas в `mobile/`, её связь с сайтом, покрытие требований сторов и то, что должен сделать владелец перед публикацией. Короткие команды — в `mobile/README.md`.

## 1. Архитектура

**Что это.** `mobile/` — проект [Capacitor](https://capacitorjs.com) 8.5.2 (`@capacitor/core`, `cli`, `ios`, `android` 8.5.2). Приложение — тонкая оболочка: системный WebView (WKWebView на iOS, Android System WebView) загружает живой сайт `https://atlasmarket.uz` (`server.url` в `mobile/capacitor.config.ts`). Сайт рендерится на сервере (Vinext на Cloudflare Worker с D1 и R2), поэтому копия страниц в приложение не упаковывается: страницы, вход, API и состояние остаются на одном origin, cookie-сессия `__Host-atlas_session` работает как в браузере, релиз приложения не требуется при изменениях сайта. В `mobile/www/` лежат только два локальных файла: `index.html` (стартовая страница, используется лишь если убрать `server.url`) и `error.html` (офлайн-страница «Нет соединения с Atlas» на трёх языках с кнопкой «Повторить», оформлена в стиле Atlas Day: белая карточка, Inter через системный фолбэк, зелёная кнопка `#1f4d3b`).

**Версии и совместимость.** Все плагины — последние 8.x; `@capacitor-community/apple-sign-in` 7.1.0 объявляет `peerDependencies: @capacitor/core >=7.0.0`, поэтому ставится в Capacitor 8 без `--legacy-peer-deps` (CLI пишет предупреждение «built for Capacitor 7, it might cause issues» — это только предупреждение; плагин использует стабильный API `CAPPlugin`). iOS-зависимости подключаются через Swift Package Manager (`mobile/ios/App/CapApp-SPM/Package.swift`), CocoaPods не нужен. `@capacitor/assets` 3.0.5 стоит в devDependencies и приносит `sharp` для генерации иконок.

**Нативные возможности** (мост — `lib/native/bridge.ts`, без npm-пакета: рантайм Capacitor внедряет `window.Capacitor` в страницы, загруженные в приложении; в браузере каждая функция — no-op или веб-фолбэк):

| Возможность | Где на стороне сайта | Нативный плагин |
| --- | --- | --- |
| Sign in with Apple (системный лист, только iOS) | `appleSignInNative({nonce})` → `POST /api/auth/apple` `{step:'verify'}` | `@capacitor-community/apple-sign-in` |
| Вход через Google и web-Apple в системном браузере с возвратом в приложение (handoff) | `GET /api/auth/google?native=1` → `/auth/return?code=…` → `uz.atlasmarket.app://auth?code=…` → `app/native-shell.tsx` → `POST /api/auth/handoff` | `@capacitor/browser`, `@capacitor/app` |
| Внешние ссылки (магазины, Telegram, lex.uz, `target="_blank"`) в SFSafariViewController / Chrome Custom Tabs | перехват кликов в `app/native-shell.tsx`, `openExternal()` | `@capacitor/browser` |
| Share sheet | `shareLink()` (в браузере — Web Share API) | `@capacitor/share` |
| Тактильный отклик | `haptic()` | `@capacitor/haptics` |
| Статус-бар в цвете темы (Atlas Day / Night) | `setStatusBarTheme()` при монтировании и при смене `resolvedTheme` (next-themes) | `@capacitor/status-bar` |
| Splash | `hideSplash()` после первого рендера; авто-скрытие через 3 с как страховка (офлайн-страница на Android не имеет доступа к плагинам) | `@capacitor/splash-screen` |
| Клавиатура | `resize:'native'` в конфиге | `@capacitor/keyboard` |
| Deep links / universal links / app links | `onAppUrlOpen` → `parseAppLink()` (`lib/native/links.ts`) | `@capacitor/app` |
| «Поделиться → Atlas»: ссылка из приложения магазина открывает заказ по ссылке | `GET /share` (`app/share/route.ts`) разбирает текст и отвечает 303 на `/order-by-link?url=…`; `parseAppLink` переводит `uz.atlasmarket.app://share?…` в путь `/share?…` (только `url`, `text`, `title`) | Android: intent-filter `ACTION_SEND` `text/plain`, `MainActivity` переписывает его в `ACTION_VIEW` на `https://atlasmarket.uz/share?text=…&title=…` (событие `appUrlOpen` хранится до подписки). iOS: расширение `mobile/ios/App/AtlasShare` открывает `uz.atlasmarket.app://share?url=…&text=…&title=…` (цель в Xcode добавляется вручную, см. §4) |
| Кнопка «Назад» (Android) | `onBackButton`: история назад; на `/` — выход из приложения | `@capacitor/app` |
| Свайп «назад/вперёд» от края экрана (iOS) | смена страниц на месте — обычные записи истории, жест их листает | `AtlasViewController` (`SceneDelegate.swift`): `allowsBackForwardNavigationGestures` |
| Переходы «как в приложении» | `components/site-link.tsx` меняет страницу без перезагрузки (шапка и нижняя панель на месте), вкладка загорается сразу, страница поднимается; вкладки нижней панели заготавливаются в простое (`useWarmLinks`) и открываются без сети | — |
| Офлайн-страница | `server.errorPath: 'error.html'` | ядро Capacitor |

**Интеграция на стороне сайта.**
- `app/native-shell.tsx` — клиентский компонент, смонтирован один раз в `app/layout.tsx` внутри `MarketProvider`. В приложении ставит `document.documentElement.dataset.native = 'ios' | 'android'`, скрывает splash, синхронизирует статус-бар с темой, перехватывает внешние ссылки, завершает handoff входа (успех → `closeExternal()`, `refresh()` из `useMarket`, `window.location.assign(returnTo || '/account')`; ошибка → `toast.error` на языке пользователя и переход на `/login`), открывает пути из universal links и обрабатывает «Назад». В браузере ничего не делает и ничего не рендерит.
- `app/native.css` — последний слой стилей, все правила под `html[data-native]`: скрыт `.home-footer` (его ссылки есть в «Кабинет → Настройки»), safe-area у `.site-header` на любой ширине (планшеты), без callout и подсветки тапа. Хлебные крошки оставлены (на страницах кабинета они и так скрыты в `customer.css`, на остальных служат заголовком).
- `lib/native/links.ts` — чистый парсер ссылок (`parseAppLink`, `isExternalHref`, `APP_LINK_PATHS`), `lib/native/well-known.ts` — сборщики AASA и assetlinks. Тесты: `tests/native.test.mjs`.
- `app/.well-known/apple-app-site-association/route.ts` и `app/.well-known/assetlinks.json/route.ts` — отдают файлы ассоциации только когда заданы `APPLE_TEAM_ID` + `APPLE_APP_BUNDLE_ID` и `ANDROID_PACKAGE_NAME` + `ANDROID_CERT_SHA256`; иначе 404 (`Cache-Control: no-store`), при наличии — `application/json`, `public, max-age=3600`. `middleware.ts` их не трогает (путь с точкой в последнем сегменте матчером исключён, а AASA без расширения получает лишь заголовок локали).
- `tsconfig.json` исключает `mobile`, `eslint.config.mjs` игнорирует `mobile/**`, `.gitignore` — зависимости и сборочные артефакты оболочки (сами проекты `android/` и `ios/` коммитятся; их собственные `.gitignore` отсекают копии, которые делает `cap sync`: `public/`, `capacitor.config.json`, `config.xml`, `capacitor.plugins.json`).

**Идентификаторы.** Bundle ID iOS и applicationId Android — `uz.atlasmarket.app`; custom URL scheme — `uz.atlasmarket.app` (`uz.atlasmarket.app://auth?code=…&return_to=…`); хост universal/app links — `atlasmarket.uz` (пути `/auth/return*`, `/order-by-link*`, `/catalog*`, `/orders*`, `/app`). Константы: `lib/auth/core.ts` (`APP_URL_SCHEME`, `appAuthLink`), `lib/native/links.ts`.

**Что сделано в сгенерированных проектах.**
- Android (`mobile/android/app/src/main/AndroidManifest.xml`): intent-filter для схемы `uz.atlasmarket.app` (host `auth`), intent-filter с `android:autoVerify="true"` для `https://atlasmarket.uz` и `www.atlasmarket.uz` по перечисленным путям, `android:usesCleartextTraffic="false"`, `android:allowBackup="false"` (иначе Android Auto Backup копировал бы данные WebView вместе с cookie сессии `__Host-atlas_session` в облако; `fullBackupContent`/`dataExtractionRules` намеренно не заданы), `INTERNET`; `versionName "1.0.0"`, `versionCode 1` (`android/app/build.gradle`); имя «Atlas» (`res/values/strings.xml`); иконка и splash сгенерированы `npm run assets` (ниже). Ярлыки по долгому нажатию на иконку (`res/xml/shortcuts.xml`, `<meta-data android:name="android.app.shortcuts">` в манифесте): «Заказ по ссылке», «Каталог», «Корзина», «Мои заказы» — VIEW-интенты на `https://atlasmarket.uz/<путь>` с явным `MainActivity` (у `/cart` нет App Link, без явной цели интент не нашёл бы приложение); подписи на ru (по умолчанию), `values-en`, `values-uz`, `values-b+uz+Cyrl`, иконки — векторы `drawable/ic_shortcut_*.xml` (lucide на мятном круге, ночью тёмный круг). Цвета темы (`res/values/colors.xml`) — зелёный Atlas вместо индиго Capacitor; окно под WebView белое, чтобы до первой отрисовки не мелькал серый; splash белый и днём, и ночью (сайт по умолчанию светлый, `values-night/colors.xml` меняет только ярлыки и акцент). Splash Android 12+ (и compat-библиотеки ниже): тема `AppTheme.NoActionBarLaunch` от `Theme.SplashScreen` без подложки иконки, знак «atlas↗» на белом. Подпись релиза: `android/keystore.properties` (`storeFile`, `storePassword`, `keyAlias`, `keyPassword`; в `android/.gitignore` вместе с `*.jks`/`*.keystore`, ключ лежит в `secrets/`, который теперь в корневом `.gitignore`); без файла release-сборка остаётся неподписанной.
- iOS (`mobile/ios/App/App/`): `Info.plist` — `CFBundleDisplayName Atlas`, `CFBundleURLTypes` со схемой, `NSCameraUsageDescription` и `NSPhotoLibraryUsageDescription` по-русски (фото паспорта/ID по выбору пользователя), `UIViewControllerBasedStatusBarAppearance true`, `ITSAppUsesNonExemptEncryption false`, `CFBundleLocalizations ru/uz/en`; `App.entitlements` — `com.apple.developer.applesignin ["Default"]`, `associated-domains ["applinks:atlasmarket.uz","webcredentials:atlasmarket.uz"]`, подключён в `project.pbxproj` (`CODE_SIGN_ENTITLEMENTS = App/App.entitlements` в Debug и Release, файл добавлен в группу App); `PrivacyInfo.xcprivacy` — `NSPrivacyTracking false`, собираемые данные (email, имя, телефон, адрес, история покупок, ID пользователя, фото) — linked, не для трекинга, цель App Functionality; категории API: UserDefaults `CA92.1`, FileTimestamp `C617.1`, SystemBootTime `35F9.1`, DiskSpace `E174.1`; файл добавлен в Resources фазу сборки. `MARKETING_VERSION = 1.0.0`.
- `capacitor.config.ts`: `appId`, `appName`, `webDir 'www'`, `server {url, errorPath, cleartext:false}`, `ios {contentInset:'automatic', limitsNavigationsToAppBoundDomains:false}`, `android {allowMixedContent:false}`, плагины `SplashScreen`, `StatusBar` (`overlaysWebView:false`, `style:'LIGHT'`, белый фон), `SystemBars {insetsHandling:'native'}` (edge-to-edge на Android 15+), `Keyboard`. Имена опций сверены с `@capacitor/cli/dist/declarations.d.ts` и `definitions.d.ts` плагинов. Отличие от исходного ТЗ: `SplashScreen.launchAutoHide` оставлен `true` c `launchShowDuration 3000` — иначе при старте без сети на Android splash не исчезнет никогда (офлайн-страница не получает мост); сайт всё равно прячет splash сразу после рендера.

**Запланировано, не сделано:** push-уведомления (нужны APNs-ключ и FCM; серверная часть — отдельный план в `TODO.md`), биометрическая блокировка, автоматическая генерация скриншотов.

## 2. Покрытие чек-листа сторов (10 пунктов владельца)

| № | Требование | Как закрыто | Где |
| --- | --- | --- | --- |
| 1 | Не «просто обёртка сайта» (Apple 4.2) | Нативный Sign in with Apple, системный браузер с handoff, share sheet, haptics, статус-бар, splash, офлайн-страница, universal links, «Назад»; экран «Настройки» в кабинете с нативными строками (версия приложения из `appInfo()`, поддержка; строки «оценить приложение» нет) | `lib/native/bridge.ts`, `app/native-shell.tsx`, экран настроек кабинета |
| 2 | Раскрытие использования ИИ | Раздел в `/privacy` и текст на странице распознавания документа (OCR в браузере, без отправки третьим лицам) | `/privacy`, `app/*` (страницы агента pages) |
| 3 | Политика конфиденциальности и условия | `/privacy`, `/terms`; ссылки из настроек, подвала и форм входа | маршруты агента pages |
| 4 | Удаление аккаунта из приложения (Apple 5.1.1(v), Google Play) | «Кабинет → Настройки → Удалить аккаунт» + публичная `/delete-account` + `POST /api/account/delete` `{confirm:true}` → `{deleted:true}`; отказ `err_41` при активных оплаченных заказах | агент deletion, `lib/market/account-delete*.ts` |
| 5 | «Восстановить покупки» | В приложении нет встроенных покупок и подписок. Строка «Восстановить покупки» в настройках кабинета заново читает аккаунт (`refresh()`) и сообщает клиенту: «В Atlas нет встроенных покупок App Store и Google Play. Заказы (N) и баланс восстановлены из вашего аккаунта» (`customer-copy.ts`, `settings.restored`) | `app/account-views.tsx`, экран настроек |
| 6 | Sign in with Apple при наличии других соц-входов (Apple 4.8) | Нативно на iOS (`appleSignInNative`), web-flow на Android и в браузере (`GET /api/auth/apple`) | `lib/auth/server.ts`, агент Apple |
| 7 | Без выдуманных рейтингов/отзывов/счётчиков | Ничего не придумано: `lib/market/site-content.ts` хранит `null`, `MissingContent` показывает заглушки только в dev | `lib/market/site-content.ts` |
| 8 | Согласие на обработку данных | Экран согласия при входе + раздел «Согласие» в `/privacy` + запись в `market_legal_consents` | агент deletion/consent |
| 9 | Сайт и страница приложения | `https://atlasmarket.uz` + `/app` (ссылки на сторы появятся после публикации) | `/app` |
| 10 | Страница поддержки | `/support`, ссылка из настроек кабинета; контакты — из `siteContent` (пока `null`, владелец заполняет) | `/support` |

## 3. Что должен сделать владелец

**Apple.**
1. Вступить в Apple Developer Program (99 $/год) от юрлица или ИП; D-U-N-S для организации.
2. В [developer.apple.com/account](https://developer.apple.com/account): записать **Team ID** → `APPLE_TEAM_ID`.
3. Identifiers → App ID `uz.atlasmarket.app` с capabilities **Sign in with Apple** и **Associated Domains** → `APPLE_APP_BUNDLE_ID=uz.atlasmarket.app`.
4. Identifiers → **Services ID** (например `uz.atlasmarket.web`) для веб-входа: включить Sign in with Apple, primary App ID — тот же, домен `atlasmarket.uz`, return URL `https://atlasmarket.uz/api/auth/apple/callback` → `APPLE_SERVICES_ID`.
5. Keys → ключ **Sign in with Apple** (.p8): `APPLE_KEY_ID`, содержимое файла → `APPLE_PRIVATE_KEY` (с переводами строк, как есть). Ключ скачивается один раз — хранить в `secrets/`, не в репозитории.
6. Сертификаты и provisioning: при `CODE_SIGN_STYLE = Automatic` Xcode создаёт их сам после входа в аккаунт в Xcode → Settings → Accounts.
7. App Store Connect: создать приложение «Atlas», категория Shopping, возрастной рейтинг — отвечать на анкету так, чтобы итог был **17+** (см. «Возрастной рейтинг» ниже), скриншоты 6.7″ и 6.5″ (и 12.9″ iPad, если не отключить iPad в Xcode — рекомендую оставить только iPhone: General → Supported Destinations), описание ru/uz/en, ключевые слова, URL поддержки `https://atlasmarket.uz/support`, URL политики `https://atlasmarket.uz/privacy`.
8. Установить переменные `APPLE_*` в Sites (`AUTH_SETUP.md`), после чего `GET /api/auth/methods` вернёт `apple:true`, `appleNative:true`, а `/.well-known/apple-app-site-association` начнёт отдаваться.

**Google.**
1. Google Play Console (25 $ однократно), верификация организации.
2. Создать приложение «Atlas», applicationId `uz.atlasmarket.app`. Включить **Play App Signing**; скачать SHA-256 отпечатков **upload key** и **app signing key** (Setup → App integrity) → `ANDROID_CERT_SHA256` через запятую, `ANDROID_PACKAGE_NAME=uz.atlasmarket.app`. После этого `/.well-known/assetlinks.json` отдаётся и App Links верифицируются.
3. Upload keystore создать локально (`keytool -genkeypair -v -keystore atlas-upload.jks -alias atlas -keyalg RSA -keysize 2048 -validity 10000`), хранить в `secrets/`, подключить в Android Studio (Build → Generate Signed Bundle) или через `android/keystore.properties` (не коммитить).
4. Store listing: иконка 512 (`mobile/store/play-icon-512.png`), feature graphic 1024×500 (`mobile/store/feature-graphic.png`, знак на светлом фоне — заменить, если владелец захочет картинку с экранами), скриншоты телефона, описание ru/uz/en, категория Shopping, контакт разработчика, URL политики.
5. **Data safety** (ответы, согласованные с `/privacy`): собираем — имя, email, телефон, адрес, история покупок (заказы), ID пользователя, фото (документ, по желанию, для получателя); данные **связаны с пользователем**; **не используются для рекламы и трекинга**; передача третьим лицам — только провайдерам доставки/оплаты в рамках заказа; данные шифруются при передаче; пользователь может запросить удаление (в приложении и на `/delete-account`). Сбор обязателен для аккаунта, фото — необязательно.
6. Тестирование: внутренний трек → закрытый тест (Google требует 12 тестировщиков 14 дней для новых личных аккаунтов разработчиков, для организаций — нет).

**App Privacy в App Store Connect (должно совпасть с `PrivacyInfo.xcprivacy`):** Contact Info (Name, Email, Phone, Physical Address), Purchases (Purchase History), Identifiers (User ID), Photos (optional, user-selected documents) — все «Linked to you», ни один — «Used to track you», цель — App Functionality. Нет аналитики третьих лиц, нет рекламы.

**Возрастной рейтинг.** Политика конфиденциальности и оферта определяют Atlas как сервис для совершеннолетних (паспорт получателя для таможни, договор с дееспособным клиентом), поэтому рейтинг 4+ противоречит документам. Владелец выбирает рейтинг, соответствующий правилу «только для взрослых»: согласованный выбор — **17+ в App Store** и **18+ по IARC в Google Play**. В анкете App Store Connect причина — не «неограниченный доступ к вебу» (приложение открывает только собственный сайт), а условия использования только для совершеннолетних; в Google Play в анкете IARC указать то же и в декларации **Target audience and content** выбрать только взрослых (18+), не отмечая детей и подростков.

**Аккаунт для ревью.** Переменная `ATLAS_REVIEW_ACCOUNTS` — список пар `email=код` через запятую (`reviewer@example.com=000000,second@example.com=123456`), код — ровно шесть цифр; работает только для входа по почте, телефоны не поддерживаются (`parseReviewAccounts` в `lib/auth/core.ts`). Она включает демо-вход с фиксированным кодом для ревьюеров. Шаблон Review Notes (English):

```
Atlas is a purchasing-assistant and shipping agent for buyers in Uzbekistan: paste a link to a product
in a foreign online store, see the full estimated price in UZS (goods, international shipping, Atlas fee,
customs), and place an order that Atlas buys and ships on your behalf.

Reviewer account: email <review email from ATLAS_REVIEW_ACCOUNTS>, one-time code 000000 (fixed for this
account only). Sign in with Apple also works on iOS.

Payments in this build are simulated: no real card is charged and no real purchase is made (the balance
screen says so). Account deletion: Account -> Settings -> Delete account, or https://atlasmarket.uz/delete-account.
Privacy policy: https://atlasmarket.uz/privacy. Support: https://atlasmarket.uz/support.
The app loads https://atlasmarket.uz in a web view and adds native sign-in, deep links, share and status-bar
integration; the service does not exist outside the app's own site.
```

## 4. Сборка

**Общее.** `cd mobile && npm ci && npm run sync`. **Знак Atlas** (выбран владельцем 11.10.2026: слово «atlas» шрифтом Manrope 800 со стрелкой ↗, как в шапке сайта; тёмно-зелёный `#1f4d3b`, стрелка `#2f8a5f`, белый фон) хранится контурами в `scripts/brand-mark.mjs` — шрифт для сборки не нужен. При изменении знака — `npm run assets` (`mobile/scripts/icons.mjs`): PNG в `mobile/assets/` → `capacitor-assets generate` (иконка iOS, legacy-иконки Android 7, `splash.png`), затем векторы Android — `drawable/ic_launcher_foreground.xml`, `ic_launcher_monochrome.xml` (тематические иконки Android 13+), `ic_launcher_background.xml` (светлый градиент), `splash_icon.xml` — и `mipmap-anydpi-v26/ic_launcher*.xml` без PNG-слоёв; картинки Google Play в `mobile/store/`. Иконки сайта (`public/icon-*.png`, `apple-touch-icon.png`) — `node scripts/make-icons.mjs` из того же модуля; `favicon` остаётся стрелкой (слово в 16–32 px не читается). Результат коммитится.

**Android (Windows/macOS/Linux).** Android Studio Ladybug или новее, JDK 21, SDK 35. `npm run open:android` → Gradle sync → Run на эмуляторе или устройстве. Release: Build → Generate Signed App Bundle (.aab) с upload keystore. `versionCode` увеличивать в `android/app/build.gradle` на каждую загрузку. Из командной строки: `android/keystore.properties` (см. §1) и `./gradlew bundleRelease` (JDK 21, `ANDROID_HOME`). Проверка на эмуляторе против локального сайта: временно `server.url` → `http://localhost:8791` с `cleartext:true` и `usesCleartextTraffic="true"` (не коммитить; тест `tests/native.test.mjs` это ловит), `adb reverse tcp:8791 tcp:8791`.

**iOS (только macOS).** Xcode 16+ (SDK iOS 18), Apple Silicon или Intel. `npm run open:ios` → Xcode разрешит SPM-пакеты (`CapApp-SPM`, `capacitor-swift-pm` 8.5.2 с GitHub — нужна сеть) → Signing & Capabilities: выбрать Team; capabilities Sign in with Apple и Associated Domains уже в `App.entitlements` → Product → Archive → Distribute → App Store Connect. CocoaPods не нужен. Если Xcode не подхватит entitlements автоматически: Signing & Capabilities → «+ Capability» → Sign in with Apple и Associated Domains (`applinks:atlasmarket.uz`, `webcredentials:atlasmarket.uz`); Build Settings → Code Signing Entitlements = `App/App.entitlements`.

**iOS: расширение «Поделиться → Atlas» (один раз, на Mac).** Код лежит в `mobile/ios/App/AtlasShare/` (`ShareViewController.swift`, `Info.plist`), но цели в `project.pbxproj` нет: проект без Xcode не правится надёжно. В Xcode:
1. File → New → Target → **Share Extension**, имя `AtlasShare`, язык Swift, «Embed in Application» — App; на вопрос «Activate scheme» — Cancel.
2. Удалить из новой группы сгенерированные `ShareViewController.swift`, `MainInterface.storyboard` и `Info.plist` (Move to Trash), затем перетащить в группу файлы из `mobile/ios/App/AtlasShare/` (Target Membership — только AtlasShare).
3. Цель AtlasShare → Build Settings: Info.plist File = `AtlasShare/Info.plist`, Product Bundle Identifier = `uz.atlasmarket.app.share`, iOS Deployment Target 15.0, Marketing Version и Current Project Version — как у App. Signing — та же команда (App ID `uz.atlasmarket.app.share` Xcode создаст сам при Automatic).
4. Если Xcode пишет, что `open(_:options:completionHandler:)` недоступен в расширениях, поставить у AtlasShare «Require Only App-Extension-Safe API» = No. Расширение открывает приложение через цепочку ответчиков: `UIApplication.shared` в расширениях запрещён.
5. Проверка: запустить App на устройстве, в Safari или приложении магазина «Поделиться» → Atlas (при первом разе — «Ещё» → включить Atlas). Должен открыться заказ по ссылке с товаром; без ссылки в тексте — пустое поле с подсказкой. Пока сайт с `/share` не выкачен, приложение откроет 404.

**Локальная сборка сайта против приложения (только разработка).** Запустить `npm start` в корне (Wrangler на `127.0.0.1:8787`) или `npm run dev`; в `capacitor.config.ts` временно поставить `server: {url:'http://192.168.x.y:8787', cleartext:true}` и `android: {allowMixedContent:true}`; `npm run sync`. Cookie `__Host-` требует HTTPS, поэтому вход в такой конфигурации не работает — проверять только вёрстку. **Не коммитить** изменённый `server.url`.

**Эмулятор против локального сайта (так проверялось «Поделиться → Atlas» 10.10.2026).** JDK 21 и Android SDK (platform 36, build-tools, эмулятор, образ `android-35;google_apis_playstore;x86_64`) ставятся из командной строки; `sdkmanager` в новых cmdline-tools — прослойка над `android-cli.exe` (`android-cli --no-metrics sdk install platforms/android-36 …`). Сайт: `npm start -- --port 8791`; `adb reverse tcp:8791 tcp:8791`; временно `server: {url:'http://localhost:8791', cleartext:true}` в `capacitor.config.ts` и `android:usesCleartextTraffic="true"` в манифесте; `npm run sync`, `gradlew assembleDebug`, `adb install -r`. Ошибки страницы в WebView видны через DevTools: `adb forward tcp:9333 localabstract:webview_devtools_remote_<pid>`, затем `http://127.0.0.1:9333/json`. **Не коммитить** временные `server.url` и cleartext; `npm run sync` также меняет окончания строк в `capacitor.build.gradle` и `capacitor.settings.gradle` — вернуть их.

**Проверка deep links.**
- Android: `adb shell am start -W -a android.intent.action.VIEW -d "uz.atlasmarket.app://auth?code=TESTCODE0123456789" uz.atlasmarket.app`; app links: `adb shell am start -W -a android.intent.action.VIEW -d "https://atlasmarket.uz/catalog" uz.atlasmarket.app`; статус верификации: `adb shell pm get-app-links uz.atlasmarket.app` (ожидается `verified` после публикации assetlinks).
- «Поделиться → Atlas» на Android без приложения магазина: `adb shell am start -a android.intent.action.SEND -t text/plain --es android.intent.extra.TEXT "Look https://www.zara.com/uz/ru/x-p01234567.html" -n uz.atlasmarket.app/.MainActivity`. iOS: `xcrun simctl openurl booted "uz.atlasmarket.app://share?text=Look%20https%3A%2F%2Fwww.zara.com%2Fuz%2F"`.
- iOS: вставить ссылку в «Заметки» или «Сообщения» и нажать; universal links не срабатывают при вводе в адресной строке Safari. Диагностика AASA: Settings → Developer → Universal Links → Diagnostics (на устройстве с профилем разработчика). Custom scheme: `xcrun simctl openurl booted "uz.atlasmarket.app://auth?code=TESTCODE0123456789"`.

## 5. Переменные окружения (объявлены в `cloudflare-env.d.ts`)

| Переменная | Назначение |
| --- | --- |
| `APPLE_SERVICES_ID` | Services ID для веб-входа Apple (client_id) |
| `APPLE_APP_BUNDLE_ID` | `uz.atlasmarket.app`; aud нативного identity token; часть AASA |
| `APPLE_TEAM_ID` | Team ID; подпись client secret и AASA |
| `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` | ключ .p8 Sign in with Apple |
| `ATLAS_REVIEW_ACCOUNTS` | пары `email=шестизначный код` через запятую — аккаунты ревьюеров с фиксированным кодом входа по почте |
| `ANDROID_PACKAGE_NAME` | `uz.atlasmarket.app` для assetlinks |
| `ANDROID_CERT_SHA256` | SHA-256 сертификатов подписи через запятую (upload + Play App Signing) |

## 6. Версии и релиз

Версия приложения: `MARKETING_VERSION` в `ios/App/App.xcodeproj/project.pbxproj` и `versionName` в `android/app/build.gradle` — одинаковые (`1.0.0`); сборка — `CURRENT_PROJECT_VERSION` и `versionCode`, +1 на каждую загрузку в стор. Чек-лист релиза:

0. **Блокер.** Заполнить `siteContent.contacts` в `lib/market/site-content.ts` — как минимум `supportEmail` (а также Telegram поддержки, если есть) — и реквизиты юридического лица в правовых документах. Пока они `null`, `/support` не показывает ни одного контакта невошедшему посетителю, а сторы требуют рабочий контакт поддержки и реквизиты владельца; без этого на модерацию не отправлять.
1. `npm ci && npm run lint && node --experimental-strip-types --test tests/*.test.mjs && npm run build` в корне; сайт задеплоен (приложение показывает прод).
2. `cd mobile && npm ci && npm run sync`; `npm run doctor` без ошибок.
3. Проверить `/.well-known/apple-app-site-association` и `/.well-known/assetlinks.json` на проде (200, JSON).
4. Поднять версии, собрать .aab и архив Xcode, загрузить.
5. Пройти в тестовой сборке: вход по коду, Sign in with Apple (iOS), Google через системный браузер и возврат, внешняя ссылка магазина в системном браузере, офлайн-режим (авиарежим → «Повторить»), смена темы → статус-бар, удаление аккаунта, «Назад» на Android.
6. Заполнить Review Notes (шаблон выше), App Privacy / Data safety.

## 7. Известные ограничения

- Сборка iOS возможна только на macOS с Xcode; на Windows проект сгенерирован и проверен только текстово (SPM-пакеты не разрешались).
- Push-уведомлений нет; уведомления видны в `/notifications` и по почте/Telegram с сайта.
- Приложение не работает без сети (это обёртка живого сайта) — показывается офлайн-страница.
- `@capacitor-community/apple-sign-in` 7.1.0 формально собран для Capacitor 7; при первой сборке в Xcode проверить, что цель компилируется; при проблеме — заменить на форк с поддержкой 8 или на собственный плагин ASAuthorizationController (30 строк Swift).
- Риск Apple Guideline 4.2 (Minimum Functionality) и 4.2.2 (не просто сайт в обёртке). Смягчение: перечислить в Review Notes нативные функции (Sign in with Apple, universal links, share, haptics, статус-бар, офлайн-экран), показать экран настроек с нативными строками, подготовить скриншоты именно из приложения, в будущем добавить push и приём ссылок через share.
- Google Play: App Links верифицируются только после публикации `assetlinks.json` с актуальными отпечатками; до этого https-ссылки открываются в браузере, custom scheme работает всегда.
- Edge-to-edge на Android 15+: `SystemBars.insetsHandling:'native'` и `viewport-fit=cover`; если на конкретном устройстве контент уходит под статус-бар, переключить на `'css'` и проверить `env(safe-area-inset-top)` в `app/native.css`.
