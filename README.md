# Gemini NotebookLM Studio (Obsidian Plugin)

Nahtlose Integration von **Google NotebookLM** (über `nlm` / `notebooklm-mcp-cli`) in die rechte Seitenleiste von Obsidian.

## Features

- **Rechte Seitenleiste (`ItemView`)**: Direkte Auswahl und Erstellung von Google NotebookLM Notebooks.
- **Automatischer Datei-Sync & `@`-Kontext**:
  - Die aktuell geöffnete Notiz wird automatisch als Kontext erkannt.
  - Über `@` im Eingabefeld (oder den `@ Datei`-Button) lassen sich beliebige weitere Vault-Dateien (`.md`, `.pdf`, `.docx`, `.txt`, `.pptx`, Bilder, Audio) hinzufügen.
  - Existiert die aktive Notiz oder eine `@`-Datei noch nicht im gewählten Notebook (oder wurde die Notiz lokal bearbeitet), lädt das Plugin sie vor dem Stellen der Frage oder der Artefakt-Erstellung **automatisch** zu NotebookLM hoch.
- **Direkter Datei-Upload**: Dedizierter `Upload`-Button in der Kopfzeile, um Dateien jederzeit manuell ins Notebook hochzuladen.
- **Quellen-Chat mit Belegen**: Antworten von NotebookLM werden inkl. ausklappbarer Original-Zitate (`Citations`) gerendert und können per Klick in die aktive Notiz eingefügt werden.
- **Studio-Artefakte & Auto-Download ins Notiz-Verzeichnis**:
  - Generierung von **Audio Overviews (Podcasts)**, **Reports / Study Guides**, **Quizzes**, **Flashcards**, **Mindmaps**, **Slides** und **Infografiken**.
  - Ein Hintergrund-Tracker überwacht laufende Generierungen und speichert fertige Dateien automatisch in dem Ordner, in dem die aktive Notiz beim Starten lag.
  - **Offline-/Neustart-Resume**: Wird Obsidian während der Generierung geschlossen, prüft das Plugin beim nächsten Start alle offenen Aufträge und lädt fertiggestellte Artefakte automatisch nach.

## Entwicklung & Build

```bash
npm install
npm run build
```
