# Silero Xenia / Kseniya — локальный ПК-мост

Это **не облачный сервис**. Python-процесс слушает только `127.0.0.1:17865`.
Текст идёт из браузера на тот же компьютер и синтезируется локальной Silero TTS.

Почему нужен мост: официальные Silero TTS Xenia/Kseniya — PyTorch-модели.
Стабильного прямого browser-runtime для нашей статической GitHub Pages PWA
сейчас нет. Поэтому на Android/iPhone используется Piper Irina, а на Windows
можно подключить реальные Silero Xenia/Kseniya.

## Windows
1. Установите Python 3.11/3.12, если его нет.
2. Запустите `INSTALL_AND_RUN_WINDOWS.bat`.
3. Первый запуск установит PyTorch и скачает Silero-модель; это может занять время.
4. Не закрывайте окно, пока хотите использовать Silero.
5. В Kitsune выберите `Silero Xenia` или `Silero Kseniya`.

Сервер приложения/Cloudflare к этой озвучке не имеет отношения.
