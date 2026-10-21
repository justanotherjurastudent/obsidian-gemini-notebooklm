import { getLanguage, moment } from 'obsidian';

export type UILanguage = 'auto' | 'de' | 'en';
export type ResolvedLanguage = 'de' | 'en';

export function resolveUILanguage(pref: UILanguage): ResolvedLanguage {
	if (pref === 'de' || pref === 'en') {
		return pref;
	}
	const obsLang = typeof getLanguage === 'function' ? getLanguage() : '';
	const loc = (obsLang || moment.locale() || 'en').toLowerCase();
	return loc.startsWith('de') ? 'de' : 'en';
}

export interface TranslationStrings {
	// Commands & Ribbon
	ribbonTooltip: string;
	cmdOpenSidebar: string;
	cmdUploadActiveNote: string;
	cmdCheckPendingArtifacts: string;
	noticeNoActiveFile: string;
	noticeCheckingArtifacts: string;

	// Sidebar Header
	sidebarTitle: string;
	btnUploadTitle: string;
	btnUploadLabel: string;
	btnNewNotebookTitle: string;
	btnRefreshTitle: string;
	btnClearChatTitle: string;
	noticeRefreshing: string;
	noNotebooksOption: string;

	// Onboarding / Missing NLM Banner
	nlmMissingTitle: string;
	nlmAuthMissingTitle: string;
	nlmMissingDesc: string;
	nlmAuthMissingDesc: string;
	btnOpenSettings: string;
	btnRunLogin: string;

	// Sources Drawer
	sourcesTitle: string;
	btnUploadActiveNote: (name: string) => string;
	sourcesEmpty: string;
	btnDeleteSourceTitle: string;
	statusDeletingSource: (title: string) => string;
	noticeSourceDeleted: (title: string) => string;
	noticeDeleteError: (msg: string) => string;

	// Studio Bar
	studioAudio: string;
	studioReport: string;
	studioQuiz: string;
	studioFlashcards: string;
	studioMindmap: string;
	studioSlides: string;
	studioInfographic: string;
	studioGenerateTooltip: (label: string) => string;

	// Artifacts Panel
	artifactsActiveTitle: (count: number) => string;
	artifactsCompletedTitle: (count: number) => string;
	btnPollNow: string;
	btnPollNowTooltip: string;
	btnClearDone: string;
	btnRemoveJobTooltip: string;
	artifactSavedPrefix: string;
	artifactFailed: string;
	artifactGeneratingTo: (folder: string) => string;

	// Chat Feed & Composer
	chatEmptyTitle: string;
	chatEmptyDesc: string;
	chatAuthorUser: string;
	chatAuthorAssistant: string;
	chatSourcesBadge: (count: number) => string;
	chatRefsSummary: (count: number) => string;
	chatSourceFallback: string;
	btnCopy: string;
	noticeCopied: string;
	btnInsertIntoNote: string;
	noticeInsertedIntoNote: (name: string) => string;
	chatThinking: string;
	chipActiveNoteOn: (path: string) => string;
	chipActiveNoteOff: string;
	btnAddContextFile: string;
	btnAddContextFileTooltip: string;
	promptPlaceholder: string;
	btnSendTooltip: string;

	// Status & Notices
	noticeSelectNotebookFirst: string;
	statusCreatingNotebook: (title: string) => string;
	noticeNotebookCreated: (title: string) => string;
	noticeCreateError: (msg: string) => string;
	statusUpdatingSource: (name: string) => string;
	statusUploadingSource: (name: string) => string;
	noticeSourceUploaded: (name: string) => string;
	noticeUploadFailed: (name: string, msg: string) => string;
	errorContextSyncFailed: (name: string) => string;
	statusQueryingNotebook: string;
	noticeQueryError: (msg: string) => string;
	statusStartingArtifact: (typeLabel: string) => string;
	noticeArtifactStarted: (typeLabel: string, folder: string) => string;
	noticeArtifactStartError: (msg: string) => string;
	noticeConnectionError: (msg: string) => string;
	noticeDownloadingArtifact: (fileName: string) => string;
	noticeArtifactSaved: (typeLabel: string, filePath: string) => string;
	noticeDownloadRetry: (label: string, msg: string) => string;
	noticeArtifactFailedRemote: (label: string) => string;

	// Modals
	modalContextPickerPlaceholder: string;
	modalDirectUploadPlaceholder: string;
	modalCreateNotebookTitle: string;
	modalCreateNotebookName: string;
	modalCreateNotebookDesc: string;
	modalCreateNotebookPlaceholder: string;
	btnCancel: string;
	btnCreateNotebook: string;
	noticeEnterTitle: string;

	modalArtifactTitle: string;
	modalTargetFolderName: string;
	modalTargetFolderDesc: string;
	modalTargetFolderPlaceholder: string;
	btnResetToNoteFolder: string;
	modalArtifactTypeName: string;
	modalArtifactTypeDesc: string;
	optTypeAudio: string;
	optTypeReport: string;
	optTypeQuiz: string;
	optTypeFlashcards: string;
	optTypeMindmap: string;
	optTypeSlides: string;
	optTypeInfographic: string;
	modalAudioFormatName: string;
	modalAudioFormatDesc: string;
	optAudioDeepDive: string;
	optAudioBrief: string;
	optAudioCritique: string;
	optAudioDebate: string;
	modalAudioLengthName: string;
	modalAudioLengthDesc: string;
	optLengthShort: string;
	optLengthDefault: string;
	optLengthLong: string;
	modalReportFormatName: string;
	optReportStudyGuide: string;
	optReportBriefing: string;
	optReportBlog: string;
	optReportCustom: string;
	modalQuizCountName: string;
	modalQuizDiffName: string;
	modalFlashcardsDiffName: string;
	optDiffEasy: string;
	optDiffMedium: string;
	optDiffHard: string;
	modalLanguageName: string;
	modalLanguageDesc: string;
	modalFocusName: string;
	modalFocusDesc: string;
	modalFocusPlaceholder: string;
	btnStartGeneration: string;

	// Settings Tab
	settingsHeadingSetup: string;
	settingsSetupIntro: string;
	settingsStep1Title: string;
	settingsStep1Desc: string;
	settingsStep2Title: string;
	settingsStep2Desc: string;
	settingsStep3Title: string;
	settingsStep3Desc: string;
	settingsStatusChecking: string;
	settingsStatusOk: (version: string, account: string) => string;
	settingsStatusNoAuth: (version: string) => string;
	settingsStatusMissing: string;
	btnCheckConnection: string;
	btnAutoDetectPath: string;
	btnLoginBrowser: string;
	noticeLoginStarted: string;
	noticePathDetected: (detectedPath: string) => string;
	noticePathNotFound: string;

	settingsHeadingGeneral: string;
	settingsUILangName: string;
	settingsUILangDesc: string;
	optLangAuto: string;
	optLangDe: string;
	optLangEn: string;
	settingsNlmPathName: string;
	settingsNlmPathDesc: string;
	settingsNlmPathPlaceholder: string;
	settingsDefaultLangName: string;
	settingsDefaultLangDesc: string;
	settingsAutoIncludeName: string;
	settingsAutoIncludeDesc: string;
	settingsAutoLinkName: string;
	settingsAutoLinkDesc: string;
	settingsMindmapMermaidName: string;
	settingsMindmapMermaidDesc: string;
	settingsPollIntervalName: string;
	settingsPollIntervalDesc: string;
	settingsCheckNowName: string;
	settingsCheckNowDesc: string;
	btnCheckNow: string;
}

const DE_STRINGS: TranslationStrings = {
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

const EN_STRINGS: TranslationStrings = {
	ribbonTooltip: 'Open Gemini NotebookLM Studio',
	cmdOpenSidebar: 'Open NotebookLM Studio in right sidebar',
	cmdUploadActiveNote: 'Upload active note to selected NotebookLM notebook',
	cmdCheckPendingArtifacts: 'Check and download pending NotebookLM artifacts',
	noticeNoActiveFile: 'No active file open.',
	noticeCheckingArtifacts: 'Checking pending NotebookLM artifacts...',

	sidebarTitle: 'Gemini NotebookLM',
	btnUploadTitle: 'Upload file directly to notebook',
	btnUploadLabel: 'Upload',
	btnNewNotebookTitle: 'Create new notebook',
	btnRefreshTitle: 'Refresh notebooks & status',
	btnClearChatTitle: 'Clear chat history',
	noticeRefreshing: 'Refreshing NotebookLM...',
	noNotebooksOption: 'No notebooks found — click + to create one',

	nlmMissingTitle: 'nlm CLI not found',
	nlmAuthMissingTitle: 'NotebookLM sign-in required',
	nlmMissingDesc:
		'This plugin requires "notebooklm-mcp-cli" (nlm). Please install it and verify the path in settings.',
	nlmAuthMissingDesc:
		'nlm is installed, but not yet authenticated with Google NotebookLM.',
	btnOpenSettings: 'Open settings & setup guide',
	btnRunLogin: 'Sign in now (nlm login)',

	sourcesTitle: 'Notebook sources',
	btnUploadActiveNote: (name) => `📄 Upload active note ("${name}")`,
	sourcesEmpty: 'No sources in this notebook yet.',
	btnDeleteSourceTitle: 'Remove source from notebook',
	statusDeletingSource: (title) => `Removing source "${title}"...`,
	noticeSourceDeleted: (title) => `Source removed: ${title}`,
	noticeDeleteError: (msg) => `Failed to delete source: ${msg}`,

	studioAudio: 'Audio',
	studioReport: 'Report',
	studioQuiz: 'Quiz',
	studioFlashcards: 'Cards',
	studioMindmap: 'Mindmap',
	studioSlides: 'Slides',
	studioInfographic: 'Infographic',
	studioGenerateTooltip: (label) => `Generate ${label}`,

	artifactsActiveTitle: (count) => `Artifacts (${count} running)`,
	artifactsCompletedTitle: (count) => `Artifact downloads (${count})`,
	btnPollNow: 'Check now',
	btnPollNowTooltip: 'Check status immediately',
	btnClearDone: 'Clear completed',
	btnRemoveJobTooltip: 'Remove entry',
	artifactSavedPrefix: 'Saved:',
	artifactFailed: 'Failed',
	artifactGeneratingTo: (folder) => `Generating → target: ${folder || '/'}`,

	chatEmptyTitle: 'Ready for your questions & artifacts',
	chatEmptyDesc:
		'The active note is included automatically. Type @ in the input box to attach additional files (e.g. PDFs), or launch a studio artifact above.',
	chatAuthorUser: 'You',
	chatAuthorAssistant: 'NotebookLM',
	chatSourcesBadge: (count) => `📎 ${count} source(s)`,
	chatRefsSummary: (count) => `📚 Show ${count} citation(s)`,
	chatSourceFallback: 'Source',
	btnCopy: 'Copy',
	noticeCopied: 'Response copied to clipboard.',
	btnInsertIntoNote: 'Insert into note',
	noticeInsertedIntoNote: (name) => `Inserted into "${name}".`,
	chatThinking: 'NotebookLM is analyzing your sources...',
	chipActiveNoteOn: (p) => `Active note included (${p}) – click to mute`,
	chipActiveNoteOff: 'Active note muted – click to include',
	btnAddContextFile: '@ File',
	btnAddContextFileTooltip: 'Add another file to context via @',
	promptPlaceholder: 'Ask your notebook... (Type @ to attach files)',
	btnSendTooltip: 'Send question (Enter)',

	noticeSelectNotebookFirst: 'Please select or create a notebook first.',
	statusCreatingNotebook: (title) => `Creating notebook "${title}"...`,
	noticeNotebookCreated: (title) => `✅ Notebook created: ${title}`,
	noticeCreateError: (msg) => `Failed to create notebook: ${msg}`,
	statusUpdatingSource: (name) => `🔄 Updating "${name}" in NotebookLM...`,
	statusUploadingSource: (name) => `📤 Uploading "${name}" to NotebookLM...`,
	noticeSourceUploaded: (name) => `✅ Source added to NotebookLM: ${name}`,
	noticeUploadFailed: (name, msg) => `❌ Upload failed (${name}): ${msg}`,
	errorContextSyncFailed: (name) => `Failed to synchronize context file "${name}".`,
	statusQueryingNotebook: 'NotebookLM is analyzing your sources...',
	noticeQueryError: (msg) => `Query failed: ${msg}`,
	statusStartingArtifact: (typeLabel) =>
		`🚀 Starting ${typeLabel} generation in NotebookLM...`,
	noticeArtifactStarted: (typeLabel, folder) =>
		`✨ ${typeLabel} started!\nIt will be downloaded automatically to "${
			folder || '/'
		}" once ready.`,
	noticeArtifactStartError: (msg) => `❌ Failed to start artifact: ${msg}`,
	noticeConnectionError: (msg) => `NotebookLM connection error: ${msg}`,
	noticeDownloadingArtifact: (fileName) =>
		`⏬ Downloading completed artifact: ${fileName}...`,
	noticeArtifactSaved: (typeLabel, filePath) =>
		`✅ ${typeLabel} saved to:\n${filePath}`,
	noticeDownloadRetry: (label, msg) =>
		`⚠️ Download failed for ${label} (will retry): ${msg}`,
	noticeArtifactFailedRemote: (label) => `❌ Artifact generation failed: ${label}`,

	modalContextPickerPlaceholder: 'Attach @-file to context (Markdown, PDF, etc.)...',
	modalDirectUploadPlaceholder: '📤 Select a file to upload directly to the notebook...',
	modalCreateNotebookTitle: 'Create new NotebookLM notebook',
	modalCreateNotebookName: 'Notebook title',
	modalCreateNotebookDesc: 'Name of the new notebook in Google NotebookLM',
	modalCreateNotebookPlaceholder: 'e.g. Information Systems - Lecture 2',
	btnCancel: 'Cancel',
	btnCreateNotebook: 'Create notebook',
	noticeEnterTitle: 'Please enter a title.',

	modalArtifactTitle: 'Create NotebookLM Studio artifact',
	modalTargetFolderName: 'Target folder for auto-download',
	modalTargetFolderDesc:
		'Defaults to the folder of the active note. You can pick any folder in your vault.',
	modalTargetFolderPlaceholder: 'Vault root (/)',
	btnResetToNoteFolder: 'Use active note folder',
	modalArtifactTypeName: 'Artifact type',
	modalArtifactTypeDesc: 'What kind of studio artifact should NotebookLM generate?',
	optTypeAudio: '🎧 Audio overview (podcast)',
	optTypeReport: '📄 Report / study guide (Markdown)',
	optTypeQuiz: '❓ Quiz (Markdown)',
	optTypeFlashcards: '🗂️ Flashcards (Markdown)',
	optTypeMindmap: '🧠 Mind map (Mermaid diagram / JSON)',
	optTypeSlides: '📊 Slide deck (PDF)',
	optTypeInfographic: '🖼️ Infographic (PNG)',
	modalAudioFormatName: 'Podcast format',
	modalAudioFormatDesc: 'Style of the audio overview',
	optAudioDeepDive: 'Deep dive (in-depth conversation)',
	optAudioBrief: 'Brief (compact overview)',
	optAudioCritique: 'Critique (critical review)',
	optAudioDebate: 'Debate (two-sided debate)',
	modalAudioLengthName: 'Length',
	modalAudioLengthDesc: 'Target duration (Long ≈ 12–18 min)',
	optLengthShort: 'Short (~5 min)',
	optLengthDefault: 'Default (~10 min)',
	optLengthLong: 'Long (~15+ min)',
	modalReportFormatName: 'Report format',
	optReportStudyGuide: 'Study Guide',
	optReportBriefing: 'Briefing Doc',
	optReportBlog: 'Blog Post',
	optReportCustom: 'Custom prompt (Create Your Own)',
	modalQuizCountName: 'Number of questions',
	modalQuizDiffName: 'Difficulty (1–5)',
	modalFlashcardsDiffName: 'Difficulty',
	optDiffEasy: 'Easy',
	optDiffMedium: 'Medium',
	optDiffHard: 'Hard',
	modalLanguageName: 'Language',
	modalLanguageDesc: 'BCP-47 language code (e.g. de, en)',
	modalFocusName: 'Focus / custom instructions (optional)',
	modalFocusDesc:
		'What should NotebookLM focus on? (e.g. examples, models, exam preparation)',
	modalFocusPlaceholder:
		'e.g. Explain information systems, socio-technical systems, and the shell model using concrete examples...',
	btnStartGeneration: 'Start generation',

	settingsHeadingSetup: 'Prerequisite & setup (Gemini Notebook MCP / nlm)',
	settingsSetupIntro:
		'This plugin communicates with Google NotebookLM via the open-source CLI tool "notebooklm-mcp-cli" (command: nlm).',
	settingsStep1Title: '1. Install nlm',
	settingsStep1Desc:
		'Install via Python (uv or pipx): uv tool install notebooklm-mcp-cli  or  pipx install notebooklm-mcp-cli',
	settingsStep2Title: '2. Authenticate with Google',
	settingsStep2Desc:
		'Run "nlm login" in your terminal (or click the login button below) to authenticate your session in the browser.',
	settingsStep3Title: '3. Configure path in plugin',
	settingsStep3Desc:
		'The plugin automatically detects nlm in standard locations (~/.local/bin/nlm). You can also set a custom executable path below.',
	settingsStatusChecking: '⏳ Checking nlm installation and authentication...',
	settingsStatusOk: (version, account) =>
		`✅ Connected (${version}) — Signed in as: ${account}`,
	settingsStatusNoAuth: (version) =>
		`⚠️ nlm found (${version}), but not signed in yet. Please run "nlm login".`,
	settingsStatusMissing:
		'❌ nlm was not found at the current path. Please install it or adjust the path below.',
	btnCheckConnection: 'Test connection',
	btnAutoDetectPath: 'Auto-detect path',
	btnLoginBrowser: 'Sign in via browser (nlm login)',
	noticeLoginStarted:
		'Browser login (nlm login) launched. Please complete sign-in in the opened browser window.',
	noticePathDetected: (p) => `✅ Found nlm at: ${p}`,
	noticePathNotFound: '⚠️ Could not automatically find nlm on this system.',

	settingsHeadingGeneral: 'Connection & behavior',
	settingsUILangName: 'Interface language (Sprache)',
	settingsUILangDesc: 'Language used for the sidebar, dialogs, and settings.',
	optLangAuto: 'Automatic (Obsidian language)',
	optLangDe: 'Deutsch',
	optLangEn: 'English',
	settingsNlmPathName: 'Path to nlm executable (optional override)',
	settingsNlmPathDesc:
		'Leave empty for automatic detection, or enter an absolute path to nlm / nlm.exe.',
	settingsNlmPathPlaceholder: 'Auto-detect (e.g. ~/.local/bin/nlm)',
	settingsDefaultLangName: 'Default language for generated artifacts',
	settingsDefaultLangDesc: 'BCP-47 language code for audio overviews & reports (e.g. de, en).',
	settingsAutoIncludeName: 'Include active note by default',
	settingsAutoIncludeDesc:
		'Automatically selects the currently open note as a context source in the sidebar.',
	settingsAutoLinkName: 'Automatically link downloaded artifacts in note',
	settingsAutoLinkDesc:
		'Appends a ![[Link]] at the end of the source note when an artifact finishes downloading.',
	settingsMindmapMermaidName: 'Convert downloaded mind maps to Mermaid diagrams (.md)',
	settingsMindmapMermaidDesc:
		'Automatically converts downloaded JSON mind maps into a Markdown file with a rendered Mermaid diagram and outline.',
	settingsPollIntervalName: 'Background polling interval (seconds)',
	settingsPollIntervalDesc:
		'How often the plugin checks whether pending NotebookLM artifacts have finished.',
	settingsCheckNowName: 'Check pending artifact downloads now',
	settingsCheckNowDesc:
		'Immediately checks all pending artifact jobs and downloads completed files.',
	btnCheckNow: 'Check & download now',
};

export function t(pref: UILanguage): TranslationStrings {
	return resolveUILanguage(pref) === 'de' ? DE_STRINGS : EN_STRINGS;
}
