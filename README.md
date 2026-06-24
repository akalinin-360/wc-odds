# wc-odds-cdn — кэфы ЧМ-2026 для баннеров

Здесь лежат кэфы (1/X/2) на матчи в виде статических JSON-файлов в папке `odds/`.
GitHub Action раз в 3 часа тянет The Odds API, усредняет кэфы по букмекерам и
перезаписывает эти файлы. Раздаются файлы через бесплатный CDN **jsDelivr** —
это выдерживает миллионы показов баннеров без всяких лимитов.

```
Баннер (Mondiad)  ──читает──>  jsDelivr CDN  ──отдаёт──>  odds/<матч>.json
                                                              ▲
                                       GitHub Action (раз в 3 ч) перезаписывает
```

URL файла на CDN:
```
https://cdn.jsdelivr.net/gh/<ЛОГИН>/<РЕПО>@main/odds/norway-france.json
```

## Разовая настройка

1. **Создай репозиторий** на github.com (например `wc-odds`), **публичный**
   (jsDelivr раздаёт только публичные репы).
2. **Залей сюда все файлы** из папки `wc-odds-cdn/` (можно через
   «Add file → Upload files» прямо в браузере): `update-odds.mjs`,
   `.github/workflows/update-odds.yml`, всю папку `odds/`.
3. **Добавь секрет с ключом The Odds API:**
   Settings → Secrets and variables → Actions → New repository secret
   - Name: `ODDS_API_KEY`
   - Value: твой ключ от the-odds-api.com (тот же, что в воркере; если не сохранён —
     возьми в личном кабинете the-odds-api.com).
4. **Запусти Action вручную первый раз:** вкладка Actions → update-odds →
   Run workflow. Проверь, что файлы в `odds/` обновились живыми кэфами.

Дальше всё само: каждые 3 часа Action обновляет кэфы, jsDelivr отдаёт свежие.

## Проверка

Открой в браузере (подставь свой логин/репо):
`https://cdn.jsdelivr.net/gh/<ЛОГИН>/<РЕПО>@main/odds/norway-france.json`
— должен отдаться JSON вида `{"home":5.01,"draw":4.22,"away":1.64,...}`.

## Локальный прогон (для отладки, без ключа просто проставит seed)

```
node update-odds.mjs
```
