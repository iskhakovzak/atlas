# Atlas Mobile (Capacitor)

Нативная оболочка Atlas для iOS и Android. WebView загружает живой сайт `https://atlasmarket.uz`; в репозитории лежат только конфигурация, офлайн-страница и сгенерированные проекты `android/` и `ios/`. Подробности, чек-лист сторов и задачи владельца — в `../MOBILE.md`.

```powershell
cd mobile
npm ci                      # зависимости оболочки (отдельный package.json)
npm run sync                # cap sync: копирует www/ и конфиг в android/ и ios/
npm run assets              # иконки и splash из ../public/icon-512.png (@capacitor/assets)
npm run open:android        # Android Studio (Windows/macOS/Linux)
npm run open:ios            # Xcode (только macOS)
npm run run:android         # собрать и запустить на подключённом устройстве/эмуляторе
npm run doctor              # проверка окружения Capacitor
```

Capacitor 8.5.2; iOS-зависимости подключаются через Swift Package Manager (`ios/App/CapApp-SPM`), CocoaPods не нужен. Для разработки против локальной сборки сайта меняйте `server.url` в `capacitor.config.ts` только локально и не коммитьте.

Проверка deep links:

```powershell
adb shell am start -W -a android.intent.action.VIEW -d "uz.atlasmarket.app://auth?code=TESTCODE0123456789" uz.atlasmarket.app
adb shell am start -W -a android.intent.action.VIEW -d "https://atlasmarket.uz/catalog" uz.atlasmarket.app
```

На iOS вставьте ссылку в «Заметки» и нажмите на неё (universal links не срабатывают из Safari-адресной строки).
