import { TranslationStrings } from './types';

export const EN_STRINGS: TranslationStrings = {
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
	settingsPrivacyNote:
		'Privacy disclosure: When you upload sources, ask questions, or generate artifacts, the selected vault files and prompts are sent via nlm to Google NotebookLM (notebooklm.google.com).',
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
