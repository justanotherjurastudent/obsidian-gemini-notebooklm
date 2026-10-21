import { TranslationStrings } from './types';

export const DE_STRINGS: TranslationStrings = {
	ribbonTooltip: 'Gemini NotebookLM Studio öffnen',
	cmdOpenSidebar: 'NotebookLM Studio in rechter Seitenleiste öffnen',
	cmdUploadActiveNote: 'Aktive Notiz direkt ins gewählte NotebookLM-Notebook hochladen',
	cmdCheckPendingArtifacts: 'Ausstehende NotebookLM-Artefakte prüfen & herunterladen',
	noticeNoActiveFile: 'Keine aktive Datei geöffnet.',
	noticeCheckingArtifacts: 'Prüfe ausstehende NotebookLM-Artefakte...',

	sidebarTitle: 'Gemini NotebookLM',
	btnUploadTitle: 'Datei direkt ins Notebook hochladen',
	btnUploadLabel: 'Upload',
	btnNewNotebookTitle: 'Neues Notebook erstellen',
	btnRefreshTitle: 'Notebooks & Status aktualisieren',
	btnClearChatTitle: 'Chat-Verlauf leeren',
	noticeRefreshing: 'Aktualisiere NotebookLM...',
	noNotebooksOption: 'Keine Notebooks gefunden — Bitte + klicken',

	nlmMissingTitle: 'nlm CLI nicht gefunden',
	nlmAuthMissingTitle: 'NotebookLM-Anmeldung erforderlich',
	nlmMissingDesc:
		'Dieses Plugin benötigt „notebooklm-mcp-cli“ (nlm). Bitte installiere es und prüfe den Pfad in den Einstellungen.',
	nlmAuthMissingDesc:
		'nlm ist installiert, aber noch nicht mit Google NotebookLM verbunden.',
	btnOpenSettings: 'Einstellungen & Setup öffnen',
	btnRunLogin: 'Jetzt anmelden (nlm login)',

	sourcesTitle: 'Notebook-Quellen',
	btnUploadActiveNote: (name) => `📄 Aktive Notiz („${name}“) hochladen`,
	sourcesEmpty: 'Noch keine Quellen in diesem Notebook.',
	btnDeleteSourceTitle: 'Quelle aus Notebook entfernen',
	statusDeletingSource: (title) => `Entferne Quelle „${title}“...`,
	noticeSourceDeleted: (title) => `Quelle entfernt: ${title}`,
	noticeDeleteError: (msg) => `Fehler beim Löschen: ${msg}`,

	studioAudio: 'Audio',
	studioReport: 'Report',
	studioQuiz: 'Quiz',
	studioFlashcards: 'Cards',
	studioMindmap: 'Mindmap',
	studioSlides: 'Slides',
	studioInfographic: 'Infografik',
	studioGenerateTooltip: (label) => `${label} generieren`,

	artifactsActiveTitle: (count) => `Artefakte (${count} in Arbeit)`,
	artifactsCompletedTitle: (count) => `Artefakt-Downloads (${count})`,
	btnPollNow: 'Prüfen',
	btnPollNowTooltip: 'Status jetzt sofort abfragen',
	btnClearDone: 'Erledigte ausblenden',
	btnRemoveJobTooltip: 'Eintrag entfernen',
	artifactSavedPrefix: 'Gespeichert:',
	artifactFailed: 'Fehlgeschlagen',
	artifactGeneratingTo: (folder) => `Generiert → Ziel: ${folder || '/'}`,

	chatEmptyTitle: 'Bereit für deine Fragen & Artefakte',
	chatEmptyDesc:
		'Die aktive Notiz wird automatisch einbezogen. Tippe @ im Eingabefeld, um weitere Dateien (z. B. PDFs) hinzuzufügen, oder starte oben ein Studio-Artefakt.',
	chatAuthorUser: 'Du',
	chatAuthorAssistant: 'NotebookLM',
	chatSourcesBadge: (count) => `📎 ${count} Quelle(n)`,
	chatRefsSummary: (count) => `📚 ${count} Quellenbeleg(e) anzeigen`,
	chatSourceFallback: 'Quelle',
	btnCopy: 'Kopieren',
	noticeCopied: 'Antwort in die Zwischenablage kopiert.',
	btnInsertIntoNote: 'In Notiz einfügen',
	noticeInsertedIntoNote: (name) => `In „${name}“ eingefügt.`,
	chatThinking: 'NotebookLM analysiert deine Quellen...',
	chipActiveNoteOn: (p) => `Aktive Notiz im Kontext (${p}) – Klicken zum Deaktivieren`,
	chipActiveNoteOff: 'Aktive Notiz ignoriert – Klicken zum Aktivieren',
	btnAddContextFile: '@ Datei',
	btnAddContextFileTooltip: 'Weitere Datei per @ zum Kontext hinzufügen',
	promptPlaceholder: 'Frage ans Notebook stellen... (Tippe @ für Dateien)',
	btnSendTooltip: 'Frage senden (Enter)',

	noticeSelectNotebookFirst: 'Bitte wähle zuerst ein Notebook aus oder erstelle eines.',
	statusCreatingNotebook: (title) => `Erstelle Notebook „${title}“...`,
	noticeNotebookCreated: (title) => `✅ Notebook erstellt: ${title}`,
	noticeCreateError: (msg) => `Fehler beim Erstellen: ${msg}`,
	statusUpdatingSource: (name) => `🔄 Aktualisiere „${name}“ in NotebookLM...`,
	statusUploadingSource: (name) => `📤 Lade „${name}“ zu NotebookLM hoch...`,
	noticeSourceUploaded: (name) => `✅ Quelle in NotebookLM hinterlegt: ${name}`,
	noticeUploadFailed: (name, msg) => `❌ Upload fehlgeschlagen (${name}): ${msg}`,
	errorContextSyncFailed: (name) =>
		`Kontext-Datei „${name}“ konnte nicht synchronisiert werden.`,
	statusQueryingNotebook: 'NotebookLM analysiert deine Quellen...',
	noticeQueryError: (msg) => `Fehler bei der Anfrage: ${msg}`,
	statusStartingArtifact: (typeLabel) =>
		`🚀 Starte ${typeLabel}-Generierung in NotebookLM...`,
	noticeArtifactStarted: (typeLabel, folder) =>
		`✨ ${typeLabel} gestartet!\nWird nach Fertigstellung automatisch in „${
			folder || '/'
		}“ gespeichert.`,
	noticeArtifactStartError: (msg) => `❌ Fehler beim Starten des Artefakts: ${msg}`,
	noticeConnectionError: (msg) => `NotebookLM Verbindungsfehler: ${msg}`,
	noticeDownloadingArtifact: (fileName) =>
		`⏬ Lade fertiges Artefakt herunter: ${fileName}...`,
	noticeArtifactSaved: (typeLabel, filePath) =>
		`✅ ${typeLabel} gespeichert in:\n${filePath}`,
	noticeDownloadRetry: (label, msg) =>
		`⚠️ Download für ${label} fehlgeschlagen (wird erneut versucht): ${msg}`,
	noticeArtifactFailedRemote: (label) => `❌ Artefakt fehlgeschlagen: ${label}`,

	modalContextPickerPlaceholder: '@-Datei zum Kontext hinzufügen (Markdown, PDF, etc.)...',
	modalDirectUploadPlaceholder:
		'📤 Datei auswählen, um sie direkt ins Notebook hochzuladen...',
	modalCreateNotebookTitle: 'Neues NotebookLM-Notebook erstellen',
	modalCreateNotebookName: 'Notebook-Titel',
	modalCreateNotebookDesc: 'Name des neuen Notebooks in Google NotebookLM',
	modalCreateNotebookPlaceholder: 'z. B. Wirtschaftsinformatik - Vorlesung 2',
	btnCancel: 'Abbrechen',
	btnCreateNotebook: 'Notebook erstellen',
	noticeEnterTitle: 'Bitte gib einen Titel ein.',

	modalArtifactTitle: 'NotebookLM Studio Artefakt erstellen',
	modalTargetFolderName: 'Zielordner für Auto-Download',
	modalTargetFolderDesc:
		'Vorausgewählt ist der Ordner der aktiven Notiz. Du kannst jeden beliebigen Vault-Ordner wählen.',
	modalTargetFolderPlaceholder: 'Vault-Wurzelverzeichnis (/)',
	btnResetToNoteFolder: 'Ordner der aktiven Notiz',
	modalArtifactTypeName: 'Artefakt-Typ',
	modalArtifactTypeDesc: 'Welche Art von Ausarbeitung soll NotebookLM generieren?',
	optTypeAudio: '🎧 Audio Overview (Podcast)',
	optTypeReport: '📄 Report / Zusammenfassung (Markdown)',
	optTypeQuiz: '❓ Quiz (Markdown)',
	optTypeFlashcards: '🗂️ Karteikarten / Flashcards (Markdown)',
	optTypeMindmap: '🧠 Mindmap (Mermaid-Diagramm / JSON)',
	optTypeSlides: '📊 Präsentation / Slide Deck (PDF)',
	optTypeInfographic: '🖼️ Infografik (PNG)',
	modalAudioFormatName: 'Podcast-Format',
	modalAudioFormatDesc: 'Stil der Audiozusammenfassung',
	optAudioDeepDive: 'Deep Dive (Ausführliches Gespräch)',
	optAudioBrief: 'Brief (Kompakter Überblick)',
	optAudioCritique: 'Critique (Kritische Analyse)',
	optAudioDebate: 'Debate (Pro & Contra Debatte)',
	modalAudioLengthName: 'Länge',
	modalAudioLengthDesc: 'Angestrebte Dauer (Lang ≈ 12–18 Min.)',
	optLengthShort: 'Kurz (~5 Min.)',
	optLengthDefault: 'Standard (~10 Min.)',
	optLengthLong: 'Lang (~15+ Min.)',
	modalReportFormatName: 'Report-Format',
	optReportStudyGuide: 'Study Guide (Lernleitfaden)',
	optReportBriefing: 'Briefing Doc (Kompaktbericht)',
	optReportBlog: 'Blog Post (Artikelform)',
	optReportCustom: 'Eigener Prompt (Create Your Own)',
	modalQuizCountName: 'Anzahl Fragen',
	modalQuizDiffName: 'Schwierigkeitsgrad (1–5)',
	modalFlashcardsDiffName: 'Schwierigkeitsgrad',
	optDiffEasy: 'Leicht',
	optDiffMedium: 'Mittel',
	optDiffHard: 'Schwer',
	modalLanguageName: 'Sprache',
	modalLanguageDesc: 'BCP-47 Sprachcode (z. B. de, en)',
	modalFocusName: 'Fokus / Spezielle Anweisungen (optional)',
	modalFocusDesc:
		'Worauf soll besonders eingegangen werden? (z. B. Beispiele, Modelle, Prüfungsfokus)',
	modalFocusPlaceholder:
		'z. B. Erläutere insbesondere Informationssysteme, sozio-technische Systeme und das Schalenmodell anhand von Beispielen...',
	btnStartGeneration: 'Generierung starten',

	settingsHeadingSetup: 'Voraussetzung & Einrichtung (Gemini Notebook MCP / nlm)',
	settingsSetupIntro:
		'Dieses Plugin kommuniziert über das Open-Source-Tool „notebooklm-mcp-cli“ (Befehl: nlm) mit Google NotebookLM.',
	settingsPrivacyNote:
		'Datenschutz-Hinweis: Beim Hochladen von Quellen, Stellen von Fragen oder Generieren von Artefakten werden die ausgewählten Vault-Dateien und Prompts über nlm an Google NotebookLM (notebooklm.google.com) übertragen.',
	settingsStep1Title: '1. Installation von nlm',
	settingsStep1Desc:
		'Installiere das Paket über Python (uv oder pipx): uv tool install notebooklm-mcp-cli  oder  pipx install notebooklm-mcp-cli',
	settingsStep2Title: '2. Einmalige Anmeldung bei Google',
	settingsStep2Desc:
		'Führe im Terminal „nlm login“ aus (oder klicke unten auf den Login-Button), um deine Sitzung im Browser zu authentifizieren.',
	settingsStep3Title: '3. Pfad-Integration im Plugin',
	settingsStep3Desc:
		'Das Plugin erkennt nlm im Standardpfad (~/.local/bin/nlm) automatisch. Alternativ kannst du unten einen eigenen Pfad setzen.',
	settingsStatusChecking: '⏳ Prüfe nlm-Installation und Authentifizierung...',
	settingsStatusOk: (version, account) =>
		`✅ Verbunden (${version}) — Angemeldet als: ${account}`,
	settingsStatusNoAuth: (version) =>
		`⚠️ nlm gefunden (${version}), aber noch nicht angemeldet. Bitte „nlm login“ ausführen.`,
	settingsStatusMissing:
		'❌ nlm wurde unter dem aktuellen Pfad nicht gefunden. Bitte installieren oder Pfad anpassen.',
	btnCheckConnection: 'Verbindung prüfen',
	btnAutoDetectPath: 'Pfad automatisch erkennen',
	btnLoginBrowser: 'Im Browser anmelden (nlm login)',
	noticeLoginStarted:
		'Browser-Login (nlm login) wurde gestartet. Bitte schließe die Anmeldung im geöffneten Browserfenster ab.',
	noticePathDetected: (p) => `✅ nlm gefunden unter: ${p}`,
	noticePathNotFound: '⚠️ nlm konnte nicht automatisch im System gefunden werden.',

	settingsHeadingGeneral: 'Verbindung & Verhalten',
	settingsUILangName: 'Sprache der Benutzeroberfläche (UI language)',
	settingsUILangDesc: 'Sprache für Seitenleiste, Dialoge und Einstellungen.',
	optLangAuto: 'Automatisch (Obsidian-Sprache)',
	optLangDe: 'Deutsch',
	optLangEn: 'English',
	settingsNlmPathName: 'Pfad zur nlm-CLI (optional überschreiben)',
	settingsNlmPathDesc:
		'Leer lassen für automatische Erkennung, oder absoluten Pfad zu nlm / nlm.exe eintragen.',
	settingsNlmPathPlaceholder: 'Automatisch erkennen (z. B. ~/.local/bin/nlm)',
	settingsDefaultLangName: 'Standard-Sprache für generierte Artefakte',
	settingsDefaultLangDesc: 'BCP-47 Sprachcode für Audio-Overviews & Reports (z. B. de, en).',
	settingsAutoIncludeName: 'Aktive Notiz standardmäßig einbeziehen',
	settingsAutoIncludeDesc:
		'Wenn aktiviert, ist die gerade geöffnete Notiz in der Sidebar automatisch als Kontextquelle ausgewählt.',
	settingsAutoLinkName: 'Fertige Artefakte automatisch in der Notiz verlinken',
	settingsAutoLinkDesc:
		'Fügt nach dem Download eines Artefakts automatisch einen ![[Link]] am Ende der ursprünglichen Notiz ein.',
	settingsMindmapMermaidName: 'Mindmaps automatisch in Mermaid-Diagramme (.md) umwandeln',
	settingsMindmapMermaidDesc:
		'Wandelt heruntergeladene JSON-Mindmaps automatisch in eine Markdown-Datei mit gerendertem Mermaid-Diagramm und Gliederung um.',
	settingsPollIntervalName: 'Hintergrund-Prüfintervall (Sekunden)',
	settingsPollIntervalDesc:
		'Wie oft das Plugin prüft, ob laufende Artefakte in NotebookLM fertiggestellt wurden.',
	settingsCheckNowName: 'Ausstehende Artefakt-Downloads jetzt prüfen',
	settingsCheckNowDesc:
		'Prüft sofort alle noch offenen Artefakt-Jobs und lädt fertiggestellte Dateien herunter.',
	btnCheckNow: 'Jetzt prüfen & herunterladen',
};
