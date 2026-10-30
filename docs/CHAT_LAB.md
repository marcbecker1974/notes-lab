# Chatbot mit Gedächtnis – Erweiterung von Notes Lab

Autorisiert am 30.10.2026: Die neue Laboraufgabe erweitert das bestehende
Notes-Lab-Projekt. Die früheren Sprint-2-Anforderungen bleiben als Historie bestehen.
Der damalige Ausschluss von KI-Funktionen gilt für diese Erweiterung nicht.

## 1. OpenRouter anbinden

- Keine neue Bibliothek und kein Agent-Plugin nötig: der Server nutzt `fetch`.
- `lib/ai/config.ts` liest den geheimen Schlüssel und die zentrale Modellwahl.
- `lib/ai/openrouter.ts` enthält den einzigen OpenRouter-Aufruf. Beide Module
  importieren `server-only`: Next.js verbietet ihre Verwendung in Client-Komponenten.
- `POST /api/chat` prüft die bestehende Supabase-Sitzung auf dem Server und die
  Herkunft der Anfrage. Er akzeptiert nur begrenzte, abwechselnde Benutzer- und
  Assistentennachrichten; Systemanweisung und Modell werden auf dem Server bestimmt.
- Der Schlüssel wird weder geloggt noch im Ergebnis zurückgegeben. Ungefilterte
  Anbieterfehler werden nicht an den Browser weitergereicht.

In der bestehenden, Git-ignorierten `.env.local` ergänzen; Supabase-Werte behalten:

```dotenv
OPENROUTER_API_KEY=hier-den-eigenen-schluessel-eintragen
OPENROUTER_MODEL=google/gemini-2.5-flash
```

Kein `NEXT_PUBLIC_` vor dem OpenRouter-Schlüssel. Keine Schlüssel in Chat, Git oder
Screenshots kopieren. Nach Änderungen an der Datei den Entwicklungsserver neu starten.

```sh
npm run test:ai       # offline: keine OpenRouter-Aufrufe, keine Credits
npm run test:ai:live  # genau eine kurze echte Anfrage, benötigt Schlüssel/Credits
npm run dev          # http://127.0.0.1:3000
```

Die verfügbaren Modelle wurden am 30.10.2026 im offiziellen Modellverzeichnis
nachgeschlagen. Für den späteren Anbietervergleich eignet sich beispielsweise
`anthropic/claude-haiku-4.5`; dafür nur `OPENROUTER_MODEL` ändern und neu starten.
Ein automatisierter Test prüft die Umschaltung, vergleicht aber keine echten Antworten.

## Stand der Schritte (30.10.2026)

Umgesetzt: Schritt 1 (Verbindung), 2 (schwebendes Chat-Fenster auf `/notes`, Vollseite
`/chat`; die Antworten kennen die eigenen Notizen des Benutzers, serverseitig per RLS),
3 (Tabellen `conversations` und `messages`, Eigentümer-RLS, Migrationen
`20261030140000` und `20261030170000`) und 5 (Playwright mit Test-Ersatz auf separatem
Server: `npm run test:e2e:chat`; Ersatz nur mit `CHAT_TEST_STUB=1`). Offen: Schritt 4,
der echte Anbietervergleich (nur die Umschaltung über `OPENROUTER_MODEL` ist getestet).
Die folgende Liste ist der ursprüngliche Plan.

## Ursprünglicher Plan

2. Private Seite `/chat`: Nachrichten links/rechts, Eingabe unten, scrollbarer Verlauf;
   alle bisherigen Nachrichten bei Folgefragen mitsenden. Navigation aus Notes Lab.
3. Eigene Tabellen für Gespräche und Nachrichten in Supabase; strikte Eigentümer-RLS,
   minimale Rechte und geordnete Nachrichten. Aktuelles Gespräch beim Neuladen laden;
   „Neues Gespräch“ öffnet einen leeren Verlauf. Notiztabellen unverändert lassen.
   Die konkrete Migration wird vor Anwendung auf die verknüpfte Datenbank vorgelegt.
4. Dieselbe Frage in zwei neuen Gesprächen mit Modellen verschiedener Anbieter testen.
5. Playwright: Antwort, Folgefrage, Reload mit Reihenfolge, neues leeres Gespräch,
   Zugriffsschutz und Datenisolation. Ein nur im separaten Testserver aktivierter
   Ersatz beantwortet Anfragen deterministisch. Tests dürfen keine echten
   Modellanfragen machen und räumen nur ihre eigenen Gespräche auf.

## Quellen

- https://openrouter.ai/docs/quickstart – HTTP-API, Bearer-Authentifizierung, Nachrichten.
- https://openrouter.ai/api/v1/models – Modellkennungen und Verfügbarkeit.
- Installierte Next.js-Dokumentation:
  `node_modules/next/dist/docs/01-app/02-guides/environment-variables.md`
  und `01-app/01-getting-started/15-route-handlers.md`.

## Nachweise

Siehe die Statuszeilen in `docs/PROJECT_BRIEF.md`, Teil C. Echte Verbindung,
Chatoberfläche und Datenbankpersistenz werden erst nach Ausführung ihrer jeweiligen
Prüfungen als bestätigt markiert.


Stand 30.10.2026: 7 Offline-Tests und 2 Playwright-Tests bestanden; Anmeldung mit
dem bestehenden Testkonto und die Notizoberfläche wurden dabei erfolgreich geladen.
Zugriff ohne Anmeldung, fremde Herkunft, ungültiger Verlauf, Systemrollen, falsches
JSON/Format und zu große Anfragen geprüft. Keine Datensätze angelegt oder gelöscht,
keine echte OpenRouter-Anfrage ausgeführt. Auth-Regression, TypeScript, Lint, Build
und Browser-Prüfung mit künstlichem Testschlüssel bestanden. Die bestehende
Next.js-Konfiguration meldet weiterhin eine Warnung zu partialPrefetching; sie
blockiert den Build nicht. Details: `docs/evidence/chat-lab-stage1.md`.
