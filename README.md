# Gemini NotebookLM Studio for Obsidian

[**🇬🇧 English**](#-english) | [**🇩🇪 Deutsch**](#-deutsch)

---

## 🇬🇧 English

**Gemini NotebookLM Studio** integrates [Google NotebookLM](https://notebooklm.google.com/) into Obsidian's right sidebar via the open-source CLI tool [`notebooklm-mcp-cli` (`nlm`)](https://github.com/jacob-bd/notebooklm-mcp-cli).

### ✨ Key Features

- **Right Sidebar Studio & Custom NotebookLM Icon**: Manage notebooks, inspect or upload sources, chat with your documents, and generate Studio artifacts without leaving Obsidian.
- **Bilingual Interface (`de` / `en` / `auto`)**: Automatically adapts to your Obsidian language or lets you switch between English and German in Settings.
- **Automatic Context & `@` File Picker**: Includes the currently active note automatically (toggleable with one click) and lets you attach any Vault file (`.md`, `.pdf`, `.docx`, `.pptx`, `.txt`, audio, images) by typing `@` in the chat box.
- **Smart Auto-Sync (Modified Note Detection)**: If a note or context file is not yet in the selected NotebookLM notebook—or if a local Markdown/text note was edited since its last upload—the plugin automatically uploads or refreshes it before running your query or Studio job.
- **Persistent Auto-Download Queue & Selectable Target Folder**: Start long-running Studio artifacts (**Audio Overviews / Podcasts**, **Reports / Study Guides**, **Quizzes**, **Flashcards**, **Mind Maps**, **Slide Decks**, **Infographics**). The target download folder defaults to the active note's folder, or you can pick any folder in your vault with autocomplete. Even if you close Obsidian while an artifact is generating, the plugin automatically downloads it on the next launch.
- **Automatic Mind Map JSON → Mermaid Conversion**: Downloaded NotebookLM mind maps (`.json`) are automatically converted into native Obsidian Markdown notes (`.md`) containing a rendered **Mermaid `flowchart LR` diagram**, a **Mermaid `mindmap` diagram**, a hierarchical Markdown outline, and a collapsible raw JSON backup.

---

### 🛠️ Prerequisite & Setup (`notebooklm-mcp-cli` / `nlm`)

This plugin communicates with Google NotebookLM through the open-source [`notebooklm-mcp-cli`](https://github.com/jacob-bd/notebooklm-mcp-cli) package (`nlm` command).

#### 1. Install `notebooklm-mcp-cli`
Requires Python 3.10+. Install globally via [`uv`](https://docs.astral.sh/uv/) (recommended) or `pipx`:

```bash
# Option A: Using uv (recommended)
uv tool install notebooklm-mcp-cli

# Option B: Using pipx
pipx install notebooklm-mcp-cli
```

#### 2. Authenticate with Google NotebookLM
Run the following command once in your terminal (or click **"Sign in via browser (nlm login)"** directly inside the plugin settings):

```bash
nlm login
```
A browser window will open so you can sign in to your Google account.

#### 3. Configure in Obsidian
1. Open **Settings → Community plugins → Gemini NotebookLM Studio**.
2. The plugin automatically detects `nlm` in standard locations (`~/.local/bin/nlm`, `%USERPROFILE%\.local\bin\nlm.exe`, or system `PATH`).
3. You can also select **Auto-detect path**, **Test connection**, or manually enter a custom path to the `nlm` executable.

---

### 🔒 Privacy & External Service Disclosure

- **No Hidden Telemetry**: This plugin does not collect analytics, usage telemetry, or background tracking data.
- **Google NotebookLM Transmission**: When you explicitly upload a Vault file, ask a question with active/attached `@` context files, or start a Studio artifact, the selected files and prompts are transmitted via the local `nlm` CLI to your authenticated **Google NotebookLM** account (`https://notebooklm.google.com/`).
- **Local Vault Scope**: Downloaded artifacts and settings are stored strictly inside your local Obsidian vault.

---

### 📦 Installation in Obsidian

#### From Release / Manual Installation
1. Copy `main.js`, `manifest.json`, and `styles.css` into your vault's plugin directory:
   `<Vault>/.obsidian/plugins/gemini-notebooklm/`
2. Reload Obsidian and enable **Gemini NotebookLM Studio** under **Settings → Community Plugins**.

#### Building from Source
```bash
npm install
npm run build
npm run lint
```

---

## 🇩🇪 Deutsch

**Gemini NotebookLM Studio** integriert [Google NotebookLM](https://notebooklm.google.com/) direkt in die rechte Seitenleiste von Obsidian über das Open-Source-Tool [`notebooklm-mcp-cli` (`nlm`)](https://github.com/jacob-bd/notebooklm-mcp-cli).

### ✨ Funktionen im Überblick

- **Rechte Sidebar & NotebookLM-Logo**: Notebooks auswählen oder neu erstellen, Quellen verwalten, Dateien direkt hochladen, Fragen stellen und Studio-Artefakte starten.
- **Zweisprachige Oberfläche (`Deutsch` / `Englisch` / `Automatisch`)**: Passt sich automatisch der Obsidian-Sprache an oder lässt sich in den Einstellungen fest auf Deutsch oder Englisch einstellen.
- **Aktive Notiz & `@`-Dateikontext**: Die gerade geöffnete Notiz wird automatisch als Kontext einbezogen (per Klick auf den Chip jederzeit stummschaltbar). Über `@` im Eingabefeld lassen sich beliebige weitere Dateien aus dem Vault (`.md`, `.pdf`, `.docx`, `.pptx`, `.txt`, Audio, Bilder) hinzufügen.
- **Intelligenter Auto-Sync**: Fehlt eine ausgewählte Kontext-Datei im Notebook oder wurde eine lokale Notiz seit dem letzten Upload geändert, lädt das Plugin sie vor der Frage oder Artefakt-Generierung automatisch hoch bzw. aktualisiert sie.
- **Persistenter Auto-Download & freie Zielordner-Wahl**: Starte **Audio Overviews (Podcasts)**, **Reports / Study Guides**, **Quizze**, **Karteikarten**, **Mindmaps**, **Präsentationen (PDF)** oder **Infografiken (PNG)**. Als Zielordner ist automatisch der Ordner der aktiven Notiz vorausgewählt – im Dialog kannst du jedoch per Autocomplete jeden beliebigen Vault-Ordner wählen. Schließt du Obsidian während der Generierung, lädt das Plugin fertige Artefakte beim nächsten Start automatisch herunter.
- **Automatische Mindmap-Umwandlung (JSON → Mermaid-Diagramm)**: Heruntergeladene Mindmaps werden automatisch von JSON in eine Markdown-Datei (`.md`) mit direkt in Obsidian gerendertem **Mermaid-Flowchart (`flowchart LR`)**, **Mermaid-Mindmap**, strukturierter Gliederung sowie eingeklapptem Original-JSON umgewandelt.

---

### 🛠️ Voraussetzung & Einrichtung (`notebooklm-mcp-cli` / `nlm`)

Dieses Plugin nutzt das Open-Source-CLI-Tool [`notebooklm-mcp-cli`](https://github.com/jacob-bd/notebooklm-mcp-cli) (Befehl `nlm`).

#### 1. Installation von `nlm`
Voraussetzung ist Python 3.10+. Installiere das Tool über [`uv`](https://docs.astral.sh/uv/) (empfohlen) oder `pipx`:

```bash
# Option A: Mit uv (empfohlen)
uv tool install notebooklm-mcp-cli

# Option B: Mit pipx
pipx install notebooklm-mcp-cli
```

#### 2. Einmalige Anmeldung bei Google
Führe im Terminal folgenden Befehl aus (oder klicke direkt in den Plugin-Einstellungen auf **„Im Browser anmelden (nlm login)“**):

```bash
nlm login
```
Es öffnet sich ein Browserfenster zur Anmeldung bei deinem Google-Konto.

#### 3. Integration im Plugin prüfen
1. Öffne in Obsidian **Einstellungen → Community-Plugins → Gemini NotebookLM Studio**.
2. Das Plugin erkennt `nlm` in den Standardpfaden (`~/.local/bin/nlm` bzw. `%USERPROFILE%\.local\bin\nlm.exe`) automatisch.
3. Über die Status-Karte in den Einstellungen kannst du jederzeit **Verbindung prüfen**, **Pfad automatisch erkennen** oder manuell einen eigenen Pfad zu `nlm` / `nlm.exe` eintragen.

---

### 🔒 Datenschutz & Hinweis zu externen Diensten

- **Keine Telemetrie**: Das Plugin erhebt keinerlei Nutzungsstatistiken, Tracking-Daten oder Telemetrie.
- **Datenübertragung an Google NotebookLM**: Wenn du aktiv Dateien hochlädst, Fragen mit einbezogenen Notizen/`@`-Kontextdateien stellst oder Studio-Artefakte startest, werden die ausgewählten Vault-Dateien und Prompts lokal über das `nlm`-CLI-Tool an dein angemeldetes **Google NotebookLM**-Konto (`https://notebooklm.google.com/`) übertragen.
- **Lokaler Dateizugriff**: Heruntergeladene Artefakte werden ausschließlich innerhalb deines aktuellen Obsidian-Vaults gespeichert.

---

### 📦 Installation & Entwicklung

#### Manuelle Installation im Vault
Kopiere die drei Produktionsdateien `main.js`, `manifest.json` und `styles.css` in den Plugin-Ordner deines Vaults:
`<Vault>/.obsidian/plugins/gemini-notebooklm/`

#### Build & Linting aus dem Quellcode
```bash
npm install
npm run build
npm run lint
```
