export type StubTemplateId =
  | 'random'
  | '1-speedtest.html'
  | '2-cloud.html'
  | '3-memes.html'
  | '4-overloaded.html'
  | '5-tech.html'
  | '6-gitpage.html';

export interface StubTemplateItem {
  id: Exclude<StubTemplateId, 'random'>;
  index: number;
  emoji: string;
  title: string;
  description: string;
  html: string;
}

export const STUB_TEMPLATES: StubTemplateItem[] = [
  {
    id: '1-speedtest.html',
    index: 1,
    emoji: '🚀',
    title: '1-speedtest.html',
    description: 'Спидтест с анимированным гейджем и цифрами',
    html: `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Speedtest — проверка скорости интернета</title>
<style>
:root{--bg:#f4f6fa;--card:#fff;--text:#1a1f2b;--muted:#6b7380;--accent:#2563eb;--track:#e5e9f0}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:var(--bg);color:var(--text);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
.card{background:var(--card);border-radius:20px;box-shadow:0 10px 40px rgba(20,30,60,.08);padding:40px 32px;max-width:420px;width:100%;text-align:center}
.logo{font-weight:800;font-size:20px;letter-spacing:-.02em;margin-bottom:28px;display:flex;align-items:center;justify-content:center;gap:8px;color:var(--accent)}
.logo svg{width:22px;height:22px}
.gauge{position:relative;width:240px;height:240px;margin:0 auto 20px}
.gauge svg{width:100%;height:100%;transform:rotate(-90deg)}
.gauge circle{fill:none;stroke-width:14;stroke-linecap:round}
.gauge .track{stroke:var(--track)}
.gauge .fill{stroke:var(--accent);stroke-dasharray:565;stroke-dashoffset:565;animation:fill 1.8s ease-out forwards}
@keyframes fill{to{stroke-dashoffset:140}}
.value{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
.num{font-size:44px;font-weight:800;letter-spacing:-.02em}
.unit{font-size:13px;color:var(--muted);margin-top:2px}
.stats{display:flex;justify-content:center;gap:28px;margin:22px 0 8px}
.stat{text-align:center}
.stat .n{font-size:18px;font-weight:700}
.stat .l{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-top:2px}
.btn{margin-top:20px;background:var(--accent);color:#fff;border:none;border-radius:12px;padding:14px 32px;font-size:15px;font-weight:600;cursor:pointer;font-family:inherit}
.btn:hover{opacity:.9}
.meta{margin-top:18px;font-size:12px;color:var(--muted)}
</style>
</head>
<body>
<div class="card">
  <div class="logo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>Speedtest</div>
  <div class="gauge">
    <svg viewBox="0 0 200 200">
      <circle class="track" cx="100" cy="100" r="90"/>
      <circle class="fill" cx="100" cy="100" r="90"/>
    </svg>
    <div class="value"><div class="num">187</div><div class="unit">Мбит/с</div></div>
  </div>
  <div class="stats">
    <div class="stat"><div class="n">12 мс</div><div class="l">Пинг</div></div>
    <div class="stat"><div class="n">187</div><div class="l">Загрузка</div></div>
    <div class="stat"><div class="n">94</div><div class="l">Отдача</div></div>
  </div>
  <button class="btn">Начать заново</button>
  <div class="meta">Ваш IP: 185.23.xx.xx · Сервер: Москва</div>
</div>
</body>
</html>`,
  },
  {
    id: '2-cloud.html',
    index: 2,
    emoji: '☁️',
    title: '2-cloud.html',
    description: 'Облачное хранилище, сайдбар + сетка файлов',
    html: `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Cloud — ваше хранилище</title>
<style>
:root{--bg:#f7f8fa;--sidebar:#fff;--text:#20242c;--muted:#8a909c;--accent:#4f7cff;--border:#eceef2}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:var(--bg);color:var(--text);min-height:100vh;display:flex}
.sidebar{width:220px;background:var(--sidebar);border-right:1px solid var(--border);padding:24px 16px;flex-shrink:0}
.logo{font-weight:800;font-size:18px;margin-bottom:28px;display:flex;align-items:center;gap:8px;color:var(--accent)}
.logo svg{width:22px;height:22px}
.nav a{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;color:var(--muted);text-decoration:none;font-size:14px;margin-bottom:2px}
.nav a.active{background:#eef2ff;color:var(--accent);font-weight:600}
.nav svg{width:17px;height:17px;flex-shrink:0}
.storage{margin-top:24px;padding:14px;background:#f2f4f8;border-radius:12px}
.storage .bar{height:6px;background:var(--border);border-radius:4px;overflow:hidden;margin:8px 0}
.storage .bar i{display:block;width:38%;height:100%;background:var(--accent)}
.storage p{font-size:12px;color:var(--muted)}
.main{flex:1;padding:28px 36px}
.top{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px}
.top h1{font-size:22px;font-weight:700}
.upload{background:var(--accent);color:#fff;border:none;border-radius:10px;padding:10px 20px;font-size:14px;font-weight:600;cursor:pointer}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:16px}
.file{background:#fff;border:1px solid var(--border);border-radius:14px;padding:16px;text-align:center}
.file .icon{width:44px;height:44px;margin:0 auto 10px;border-radius:10px;display:flex;align-items:center;justify-content:center}
.file .icon svg{width:22px;height:22px;color:#fff}
.file p{font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.file span{font-size:11px;color:var(--muted)}
@media(max-width:600px){.sidebar{display:none}.main{padding:20px}}
</style>
</head>
<body>
<aside class="sidebar">
  <div class="logo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 18a4 4 0 0 1-1-7.9A5 5 0 0 1 16 8a4.5 4.5 0 0 1 1 8.9"/></svg>Cloud</div>
  <nav class="nav">
    <a class="active" href="#"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"/></svg>Мои файлы</a>
    <a href="#"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 2 3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z"/></svg>Избранное</a>
    <a href="#"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-9-9c2.5 0 4.7 1 6.3 2.7"/><path d="M21 3v6h-6"/></svg>Последние</a>
    <a href="#"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M3 12h18M3 18h18"/></svg>Корзина</a>
  </nav>
  <div class="storage"><p>38% занято</p><div class="bar"><i></i></div><p>5.7 ГБ из 15 ГБ</p></div>
</aside>
<main class="main">
  <div class="top"><h1>Мои файлы</h1><button class="upload">+ Загрузить</button></div>
  <div class="grid">
    <div class="file"><div class="icon" style="background:#60a5fa"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg></div><p>Отчёт.pdf</p><span>2.1 МБ</span></div>
    <div class="file"><div class="icon" style="background:#34d399"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg></div><p>Фото.jpg</p><span>4.8 МБ</span></div>
    <div class="file"><div class="icon" style="background:#f472b6"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg></div><p>Презентация.pptx</p><span>11 МБ</span></div>
    <div class="file"><div class="icon" style="background:#fbbf24"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg></div><p>Проект</p><span>папка</span></div>
  </div>
</main>
</body>
</html>`,
  },
  {
    id: '3-memes.html',
    index: 3,
    emoji: '😂',
    title: '3-memes.html',
    description: 'Лента с мемами (MemeDump), тёмная тема',
    html: `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>MemeDump — свежие мемы каждый день</title>
<style>
:root{--bg:#15161d;--card:#1e2029;--text:#f1f2f6;--muted:#8b8fa3;--accent:#ff5c5c}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:var(--bg);color:var(--text);min-height:100vh}
header{display:flex;align-items:center;justify-content:space-between;padding:16px 24px;border-bottom:1px solid #2a2c38;position:sticky;top:0;background:var(--bg);z-index:5}
.logo{font-weight:900;font-size:20px;letter-spacing:-.02em}
.logo span{color:var(--accent)}
.tabs{display:flex;gap:6px;font-size:13px}
.tabs a{padding:7px 14px;border-radius:999px;color:var(--muted);text-decoration:none}
.tabs a.active{background:var(--accent);color:#fff;font-weight:600}
.feed{max-width:560px;margin:0 auto;padding:20px 16px}
.post{background:var(--card);border-radius:16px;margin-bottom:18px;overflow:hidden}
.post .meta{display:flex;align-items:center;gap:10px;padding:14px 16px 10px}
.post .avatar{width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#ff5c5c,#ffb86c)}
.post .meta b{font-size:13px}
.post .meta span{font-size:12px;color:var(--muted);display:block}
.post .img{height:260px;background:linear-gradient(135deg,#2a2c38,#1a1c24);display:flex;align-items:center;justify-content:center}
.post .img svg{width:60px;height:60px;color:#3a3d4d}
.post .actions{display:flex;gap:18px;padding:12px 16px;font-size:13px;color:var(--muted)}
.post .actions b{color:var(--text)}
footer{text-align:center;color:var(--muted);font-size:12px;padding:24px}
</style>
</head>
<body>
<header>
  <div class="logo">Meme<span>Dump</span></div>
  <div class="tabs"><a class="active" href="#">Горячее</a><a href="#">Новое</a><a href="#">Топ</a></div>
</header>
<div class="feed">
  <div class="post">
    <div class="meta"><div class="avatar"></div><div><b>anon_228</b><span>14 мин назад</span></div></div>
    <div class="img"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg></div>
    <div class="actions"><span>▲ <b>4.2K</b></span><span>💬 <b>312</b></span><span>↗ Поделиться</span></div>
  </div>
  <div class="post">
    <div class="meta"><div class="avatar"></div><div><b>kekpatrol</b><span>1 ч назад</span></div></div>
    <div class="img"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg></div>
    <div class="actions"><span>▲ <b>1.8K</b></span><span>💬 <b>97</b></span><span>↗ Поделиться</span></div>
  </div>
  <div class="post">
    <div class="meta"><div class="avatar"></div><div><b>no_sleep_dev</b><span>3 ч назад</span></div></div>
    <div class="img"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg></div>
    <div class="actions"><span>▲ <b>8.9K</b></span><span>💬 <b>540</b></span><span>↗ Поделиться</span></div>
  </div>
</div>
<footer>MemeDump · смешно или вернём деньги</footer>
</body>
</html>`,
  },
  {
    id: '4-overloaded.html',
    index: 4,
    emoji: '⚠️',
    title: '4-overloaded.html',
    description: 'Страница "сервис перегружен" (503), с прогресс-баром',
    html: `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>503 — Сервис временно недоступен</title>
<style>
:root{--bg:#0e0f13;--text:#e8e9ee;--muted:#80808f;--accent:#ff9f43}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:var(--bg);color:var(--text);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
.wrap{text-align:center;max-width:460px}
.code{font-size:15px;color:var(--accent);font-weight:700;letter-spacing:.1em;margin-bottom:18px}
.icon{width:72px;height:72px;margin:0 auto 24px;color:var(--accent)}
h1{font-size:24px;font-weight:700;margin-bottom:12px}
p{color:var(--muted);font-size:15px;line-height:1.6;margin-bottom:28px}
.bar{height:4px;background:#1f2128;border-radius:4px;overflow:hidden;margin-bottom:10px}
.bar i{display:block;width:30%;height:100%;background:var(--accent);animation:load 1.6s ease-in-out infinite}
@keyframes load{0%{margin-left:0;width:20%}50%{margin-left:60%;width:35%}100%{margin-left:0;width:20%}}
.sub{font-size:12px;color:var(--muted)}
.btn{margin-top:24px;display:inline-block;border:1px solid #2a2c38;color:var(--text);padding:10px 24px;border-radius:10px;text-decoration:none;font-size:14px}
</style>
</head>
<body>
<div class="wrap">
  <div class="code">ОШИБКА 503</div>
  <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/></svg>
  <h1>Сервис временно перегружен</h1>
  <p>Сейчас наблюдается повышенная нагрузка. Мы уже работаем над восстановлением — попробуйте обновить страницу через пару минут.</p>
  <div class="bar"><i></i></div>
  <div class="sub">Повторная попытка автоматически через 60 сек</div>
  <a class="btn" href="#">Обновить страницу</a>
</div>
</body>
</html>`,
  },
  {
    id: '5-tech.html',
    index: 5,
    emoji: '💻',
    title: '5-tech.html',
    description: 'Технический лендинг (условный “Nexora Systems”)',
    html: `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Nexora Systems — инфраструктурные решения</title>
<style>
:root{--bg:#0a0c10;--card:#12141a;--text:#eef0f4;--muted:#848a99;--accent:#3ddc97;--border:#1f232c}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:var(--bg);color:var(--text)}
header{display:flex;align-items:center;justify-content:space-between;padding:20px 40px;border-bottom:1px solid var(--border)}
.logo{font-weight:800;font-size:18px;display:flex;align-items:center;gap:8px}
.logo svg{width:22px;height:22px;color:var(--accent)}
nav{display:flex;gap:28px;font-size:14px;color:var(--muted)}
nav a{text-decoration:none;color:inherit}
.cta{background:var(--accent);color:#06140f;padding:9px 18px;border-radius:8px;font-size:13px;font-weight:700;text-decoration:none}
.hero{max-width:780px;margin:0 auto;padding:90px 24px 60px;text-align:center}
.badge{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--accent);background:rgba(61,220,151,.1);padding:6px 14px;border-radius:999px;margin-bottom:22px}
h1{font-size:40px;font-weight:800;letter-spacing:-.02em;line-height:1.15;margin-bottom:18px}
h1 span{color:var(--accent)}
.sub{color:var(--muted);font-size:16px;max-width:560px;margin:0 auto 32px;line-height:1.6}
.actions{display:flex;gap:12px;justify-content:center}
.btn1{background:var(--accent);color:#06140f;padding:12px 26px;border-radius:9px;font-weight:700;text-decoration:none;font-size:14px}
.btn2{border:1px solid var(--border);color:var(--text);padding:12px 26px;border-radius:9px;text-decoration:none;font-size:14px}
.grid{max-width:960px;margin:40px auto 0;padding:0 24px;display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.feat{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:22px}
.feat svg{width:22px;height:22px;color:var(--accent);margin-bottom:12px}
.feat h3{font-size:15px;margin-bottom:6px}
.feat p{font-size:13px;color:var(--muted);line-height:1.5}
footer{text-align:center;padding:40px;color:var(--muted);font-size:12px;border-top:1px solid var(--border);margin-top:60px}
@media(max-width:700px){.grid{grid-template-columns:1fr}nav{display:none}h1{font-size:30px}}
</style>
</head>
<body>
<header>
  <div class="logo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2 2 7l10 5 10-5-10-5Z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/></svg>Nexora</div>
  <nav><a href="#">Продукт</a><a href="#">Инфраструктура</a><a href="#">Тарифы</a><a href="#">Документация</a></nav>
  <a class="cta" href="#">Войти в кабинет</a>
</header>
<div class="hero">
  <div class="badge">● Все системы работают штатно</div>
  <h1>Надёжная <span>инфраструктура</span><br>для вашего бизнеса</h1>
  <p class="sub">Управление серверами, сетями и развёртыванием в едином пространстве. Быстро, безопасно, с полным контролем.</p>
  <div class="actions"><a class="btn1" href="#">Начать бесплатно</a><a class="btn2" href="#">Связаться с нами</a></div>
</div>
<div class="grid">
  <div class="feat"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg><h3>Единая панель</h3><p>Все серверы и сервисы в одном интерфейсе, без переключения между вкладками.</p></div>
  <div class="feat"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg><h3>Безопасность</h3><p>Шифрование на всех уровнях и контроль доступа по ролям.</p></div>
  <div class="feat"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2 3 14h9l-1 8 10-12h-9z"/></svg><h3>Высокая скорость</h3><p>Развёртывание инфраструктуры за секунды, а не часы.</p></div>
</div>
<footer>© 2026 Nexora Systems. Все права защищены.</footer>
</body>
</html>`,
  },
  {
    id: '6-gitpage.html',
    index: 6,
    emoji: '🐙',
    title: '6-gitpage.html',
    description: 'Страница репозитория в стиле GitHub (GitPage)',
    html: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>wemk/core-infra · GitPage</title>
<style>
:root{--bg:#0d1117;--card:#161b22;--text:#c9d1d9;--muted:#8b949e;--accent:#58a6ff;--green:#3fb950;--border:#30363d}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:var(--bg);color:var(--text);font-size:14px}
header{display:flex;align-items:center;justify-content:space-between;padding:14px 24px;border-bottom:1px solid var(--border)}
.logo{display:flex;align-items:center;gap:10px;font-weight:700;font-size:16px}
.logo svg{width:26px;height:26px}
.search{background:#0d1117;border:1px solid var(--border);border-radius:6px;padding:6px 10px;color:var(--muted);font-size:13px;width:220px}
.wrap{max-width:900px;margin:0 auto;padding:24px}
.repo-head{display:flex;align-items:center;gap:8px;font-size:20px;margin-bottom:4px}
.repo-head svg{width:16px;height:16px;color:var(--muted)}
.repo-head .priv{font-size:11px;border:1px solid var(--border);border-radius:999px;padding:1px 8px;color:var(--muted);margin-left:6px}
.desc{color:var(--muted);margin-bottom:16px}
.tabs{display:flex;gap:4px;border-bottom:1px solid var(--border);margin-bottom:16px}
.tabs span{padding:8px 14px;font-size:13px;color:var(--muted);border-bottom:2px solid transparent}
.tabs span.active{color:var(--text);border-color:#f78166;font-weight:600}
.bar{display:flex;gap:8px;margin-bottom:16px}
.bar button{background:var(--card);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:5px 12px;font-size:12px}
.bar .code{background:var(--green);color:#0d1117;border:none;font-weight:700}
.filebox{border:1px solid var(--border);border-radius:8px;overflow:hidden;margin-bottom:20px}
.commit{display:flex;align-items:center;gap:10px;padding:12px 14px;background:var(--card);border-bottom:1px solid var(--border);font-size:13px}
.commit .av{width:20px;height:20px;border-radius:50%;background:linear-gradient(135deg,#58a6ff,#3fb950)}
.commit .msg{flex:1}
.commit .hash{color:var(--muted);font-family:monospace;font-size:12px}
.file{display:flex;align-items:center;gap:10px;padding:8px 14px;font-size:13px;border-top:1px solid var(--border)}
.file:first-child{border-top:none}
.file svg{width:15px;height:15px;color:var(--muted);flex-shrink:0}
.file .name{flex:1;color:var(--accent)}
.file .msg{color:var(--muted);flex:2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.file .time{color:var(--muted);font-size:12px}
.readme{border:1px solid var(--border);border-radius:8px;padding:20px}
.readme h2{font-size:15px;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid var(--border)}
.readme p{color:var(--muted);line-height:1.6;margin-bottom:10px;font-size:13px}
.readme code{background:#1f242c;padding:2px 6px;border-radius:4px;font-size:12px}
</style>
</head>
<body>
<header>
  <div class="logo"><svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/></svg>GitPage</div>
  <input class="search" placeholder="Поиск репозиториев...">
</header>
<div class="wrap">
  <div class="repo-head"><svg viewBox="0 0 16 16" fill="currentColor"><path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 1 1 0-1.5h1.75v-2H4.5a1 1 0 0 0-.9 1.45.75.75 0 1 1-1.34.67A2.5 2.5 0 0 1 2 11.5Z"/></svg>wemk / core-infra<span class="priv">Public</span></div>
  <div class="desc">Internal infrastructure utilities & deployment configs</div>
  <div class="tabs"><span class="active">Code</span><span>Issues 3</span><span>Pull requests 1</span><span>Actions</span><span>Settings</span></div>
  <div class="bar"><button>⎇ main</button><button>12 branches</button><button>5 tags</button><button class="code">Code ▾</button></div>
  <div class="filebox">
    <div class="commit"><div class="av"></div><div class="msg">chore: update deploy scripts and bump deps</div><div class="hash">a1f9c2e</div></div>
    <div class="file"><svg viewBox="0 0 16 16" fill="currentColor"><path d="M1.75 1h8.5l3.75 3.75v9.5A1.75 1.75 0 0 1 12.25 16h-10.5A1.75 1.75 0 0 1 0 14.25V2.75A1.75 1.75 0 0 1 1.75 1Z"/></svg><span class="name">src</span><span class="msg">refactor module layout</span><span class="time">3 дня назад</span></div>
    <div class="file"><svg viewBox="0 0 16 16" fill="currentColor"><path d="M1.75 1h8.5l3.75 3.75v9.5A1.75 1.75 0 0 1 12.25 16h-10.5A1.75 1.75 0 0 1 0 14.25V2.75A1.75 1.75 0 0 1 1.75 1Z"/></svg><span class="name">docker</span><span class="msg">add compose override</span><span class="time">6 дней назад</span></div>
    <div class="file"><svg viewBox="0 0 16 16" fill="currentColor"><path d="M8.75.75V2h.985c.304 0 .603.08.867.231l1.29.736c.038.022.08.033.124.033h2.234a.75.75 0 0 1 0 1.5h-.427l2.111 4.692a.75.75 0 0 1-.154.838l-.53-.53.529.531-.001.002-.002.002-.006.006-.016.015-.045.04a3.514 3.514 0 0 1-.686.45A4.492 4.492 0 0 1 13 11c-.818 0-1.511-.198-2.013-.46a3.512 3.512 0 0 1-.686-.45l-.045-.04-.016-.015-.006-.006-.002-.002.529-.531-.53.53a.75.75 0 0 1-.154-.838L12.19 4.5h-.427a.754.754 0 0 1-.124-.033l-1.29-.736a.75.75 0 0 0-.371-.097H8.75V13h2.5a.75.75 0 0 1 0 1.5h-6.5a.75.75 0 0 1 0-1.5h2.5V3.634h-.98c-.13 0-.258.032-.371.097l-1.29.736a.75.75 0 0 1-.124.033H3.81l2.111 4.692a.75.75 0 0 1-.154.838l-.53-.53.529.531-.001.002-.002.002-.006.006-.016.015-.045.04a3.514 3.514 0 0 1-.686.45A4.492 4.492 0 0 1 3 11c-.818 0-1.511-.198-2.013-.46a3.512 3.512 0 0 1-.686-.45l-.045-.04-.016-.015-.006-.006-.002-.002L.747 9.497a.75.75 0 0 1-.154-.838L2.705 4h-.427a.75.75 0 0 1 0-1.5h2.234a.249.249 0 0 0 .124-.033l1.29-.736c.264-.152.563-.231.867-.231h.985V.75a.75.75 0 0 1 1.5 0Z"/></svg><span class="name">LICENSE</span><span class="msg">initial commit</span><span class="time">2 месяца назад</span></div>
    <div class="file"><svg viewBox="0 0 16 16" fill="currentColor"><path d="M1.75 1h8.5l3.75 3.75v9.5A1.75 1.75 0 0 1 12.25 16h-10.5A1.75 1.75 0 0 1 0 14.25V2.75A1.75 1.75 0 0 1 1.75 1Z"/></svg><span class="name">README.md</span><span class="msg">update usage docs</span><span class="time">1 неделю назад</span></div>
  </div>
  <div class="readme">
    <h2>📄 README.md</h2>
    <p><b>core-infra</b> — набор внутренних скриптов для развёртывания и обслуживания серверной инфраструктуры.</p>
    <p>Установка: <code>git clone</code> → <code>./setup.sh</code> → готово.</p>
    <p>Лицензия: MIT</p>
  </div>
</div>
</body>
</html>`,
  },
];

export function getStubTemplateById(id: StubTemplateId): StubTemplateItem {
  if (id === 'random') {
    return STUB_TEMPLATES[0];
  }
  return STUB_TEMPLATES.find((t) => t.id === id) || STUB_TEMPLATES[0];
}

/**
 * Generates the Bash snippet that saves all 6 HTML templates into ${BASE_DIR}/html/templates/
 * and selects a random one (or the preselected one) into ${BASE_DIR}/html/index.html.
 */
export function generateBashTemplatesInstaller(selectedTemplate: StubTemplateId = 'random'): string {
  const heredocs = STUB_TEMPLATES.map(
    (tpl) => `cat > "\${BASE_DIR}/html/templates/${tpl.id}" <<'STUB_EOF_${tpl.index}'
${tpl.html}
STUB_EOF_${tpl.index}`
  ).join('\n\n');

  const selectionLogic =
    selectedTemplate === 'random'
      ? `STUB_FILES=(
  "1-speedtest.html"
  "2-cloud.html"
  "3-memes.html"
  "4-overloaded.html"
  "5-tech.html"
  "6-gitpage.html"
)
STUB_DESCRIPTIONS=(
  "🚀 1-speedtest.html — Спидтест с анимированным гейджем и цифрами"
  "☁️ 2-cloud.html     — Облачное хранилище, сайдбар + сетка файлов"
  "😂 3-memes.html     — Лента с мемами (MemeDump), тёмная тема"
  "⚠️ 4-overloaded.html— Страница 'Сервис перегружен' (503) с прогресс-баром"
  "💻 5-tech.html      — Технический лендинг (Nexora Systems)"
  "🐙 6-gitpage.html   — Страница репозитория в стиле GitHub (GitPage)"
)
RANDOM_IDX=\$(( RANDOM % \${#STUB_FILES[@]} ))
CHOSEN_STUB="\${STUB_FILES[\$RANDOM_IDX]}"
CHOSEN_DESC="\${STUB_DESCRIPTIONS[\$RANDOM_IDX]}"`
      : `CHOSEN_STUB="${selectedTemplate}"
CHOSEN_DESC="${getStubTemplateById(selectedTemplate).emoji} ${selectedTemplate} — ${getStubTemplateById(selectedTemplate).description}"`;

  return `mkdir -p "\${BASE_DIR}/html/templates"

${heredocs}

${selectionLogic}
cp -f "\${BASE_DIR}/html/templates/\${CHOSEN_STUB}" "\${BASE_DIR}/html/index.html"
echo "\${CHOSEN_STUB}" > "\${BASE_DIR}/html/.current_template"
echo -e "   🎲 Выбрана заглушка: \${GREEN}\${CHOSEN_DESC}\${NC}"
echo -e "   📂 Все 6 шаблонов сохранены в: \${CYAN}\${BASE_DIR}/html/templates/\${NC}"`;
}
