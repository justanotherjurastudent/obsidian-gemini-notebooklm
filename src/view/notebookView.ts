import {
	FileSystemAdapter,
	ItemView,
	MarkdownRenderer,
	Notice,
	TFile,
	WorkspaceLeaf,
	normalizePath,
	setIcon,
} from 'obsidian';
import NotebookLMPlugin from '../main';
import {
	ArtifactCreateOptions,
	ArtifactJob,
	ArtifactType,
	ChatMessage,
	NlmHealthStatus,
	NotebookInfo,
	SourceInfo,
	StudioArtifactStatus,
} from '../types';
import {
	ArtifactConfigModal,
	CreateNotebookModal,
	VaultFileSuggestModal,
} from '../suggest/fileSuggestModal';
import { NOTEBOOKLM_ICON_ID } from '../icons/notebooklmLogo';
import { t, TranslationStrings } from '../i18n';
import { isSupportedArtifactType } from '../utils/artifactParser';

export const VIEW_TYPE_NOTEBOOKLM = 'gemini-notebooklm-sidebar-view';
const MAX_CHAT_MESSAGES = 50;

export class NotebookLMSidebarView extends ItemView {
	private plugin: NotebookLMPlugin;
	private notebooks: NotebookInfo[] = [];
	private sources: SourceInfo[] = [];
	private studioArtifacts: StudioArtifactStatus[] = [];
	private studioArtifactsLoaded = false;
	private contextFiles: TFile[] = [];
	private includeActiveNote = true;
	private activeNoteFile: TFile | null = null;
	private isSourcesExpanded = false;
	private isStudioDrawerExpanded = false;
	private isViewOpen = false;
	private postChatStudioCheckTimer: number | null = null;
	private playingArtifactId: string | null = null;
	private activeAudioEl: HTMLAudioElement | null = null;
	private activeAudioArtifactId: string | null = null;
	private currentLoadedNotebookId: string | null = null;
	private isLoadingNotebooks = false;
	private isSendingChat = false;
	private uploadQueue: Promise<unknown> = Promise.resolve();
	private healthStatus: NlmHealthStatus | null = null;

	// DOM references
	private onboardingBannerEl!: HTMLElement;
	private notebookSelectEl!: HTMLSelectElement;
	private sourcesContainerEl!: HTMLElement;
	private sourcesCountBadgeEl!: HTMLElement;
	private studioDrawerHeaderEl!: HTMLElement;
	private studioDrawerListEl!: HTMLElement;
	private studioDrawerBadgeEl!: HTMLElement;
	private studioDrawerChevronEl!: HTMLElement;
	private artifactsContainerEl!: HTMLElement;
	private chatFeedEl!: HTMLElement;
	private contextChipsEl!: HTMLElement;
	private promptInputEl!: HTMLTextAreaElement;
	private sendBtnEl!: HTMLButtonElement;
	private statusBannerEl!: HTMLElement;

	private unsubscribeTracker: (() => void) | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: NotebookLMPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.includeActiveNote = this.plugin.settings.autoIncludeActiveNote;
	}

	private get i18n(): TranslationStrings {
		return t(this.plugin.settings.uiLanguage);
	}

	getViewType(): string {
		return VIEW_TYPE_NOTEBOOKLM;
	}

	getDisplayText(): string {
		return this.i18n.sidebarTitle;
	}

	getIcon(): string {
		return NOTEBOOKLM_ICON_ID;
	}

	async onOpen(): Promise<void> {
		this.isViewOpen = true;
		this.activeNoteFile = this.app.workspace.getActiveFile();
		this.buildUI();

		this.registerEvent(
			this.app.workspace.on('active-leaf-change', () => {
				const file = this.app.workspace.getActiveFile();
				if (file && file !== this.activeNoteFile) {
					this.activeNoteFile = file;
					this.renderContextChips();
					this.renderSourcesList();
				}
			})
		);

		this.unsubscribeTracker = this.plugin.tracker.onUpdate(() => {
			this.renderArtifactsPanel();
			this.renderStudioDrawerList();
		});

		await this.loadNotebooksAndSources();
		this.renderChatFeed();
		this.renderArtifactsPanel();
		this.renderStudioDrawerList();
	}

	async onClose(): Promise<void> {
		this.isViewOpen = false;
		if (this.postChatStudioCheckTimer !== null) {
			window.clearTimeout(this.postChatStudioCheckTimer);
			this.postChatStudioCheckTimer = null;
		}
		this.stopAudioPlayback();
		if (this.unsubscribeTracker) {
			this.unsubscribeTracker();
			this.unsubscribeTracker = null;
		}
	}

	private stopAudioPlayback(): void {
		this.playingArtifactId = null;
		if (this.activeAudioEl) {
			this.activeAudioEl.pause();
			this.activeAudioEl.removeAttribute('src');
			this.activeAudioEl = null;
		}
		this.activeAudioArtifactId = null;
	}

	public rebuildUI(): void {
		const wasPlaying = Boolean(
			this.activeAudioEl && !this.activeAudioEl.paused
		);
		const savedTime = this.activeAudioEl ? this.activeAudioEl.currentTime : 0;

		this.buildUI();
		this.renderOnboardingBanner();
		this.renderNotebookSelect();
		this.renderSourcesList();
		this.renderStudioDrawerList();
		this.renderChatFeed();
		this.renderArtifactsPanel();

		if (this.activeAudioEl) {
			if (this.activeAudioEl.currentTime === 0 && savedTime > 0) {
				this.activeAudioEl.currentTime = savedTime;
			}
			if (wasPlaying && this.activeAudioEl.paused) {
				void this.activeAudioEl.play().catch(() => {
					// Ignore autoplay interruption
				});
			}
		}
	}

	private buildUI(): void {
		const i18n = this.i18n;
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.addClass('nlm-sidebar-root');

		// 1. TOP HEADER (Brand + Actions)
		const header = container.createDiv({ cls: 'nlm-header' });
		const brandRow = header.createDiv({ cls: 'nlm-brand-row' });

		const titleGroup = brandRow.createDiv({ cls: 'nlm-brand-title-group' });
		const logoIcon = titleGroup.createSpan({ cls: 'nlm-brand-icon' });
		setIcon(logoIcon, NOTEBOOKLM_ICON_ID);
		titleGroup.createSpan({ text: i18n.sidebarTitle, cls: 'nlm-brand-title' });

		const headerActions = brandRow.createDiv({ cls: 'nlm-header-actions' });

		const uploadBtn = headerActions.createEl('button', {
			cls: 'nlm-icon-btn nlm-upload-header-btn',
			attr: { 'aria-label': i18n.btnUploadTitle },
		});
		setIcon(uploadBtn, 'upload');
		uploadBtn.createSpan({ text: i18n.btnUploadLabel, cls: 'nlm-btn-text' });
		uploadBtn.addEventListener('click', () => this.openDirectUploadModal());

		const newNbBtn = headerActions.createEl('button', {
			cls: 'nlm-icon-btn',
			attr: { 'aria-label': i18n.btnNewNotebookTitle },
		});
		setIcon(newNbBtn, 'plus');
		newNbBtn.addEventListener('click', () => this.openCreateNotebookModal());

		const refreshBtn = headerActions.createEl('button', {
			cls: 'nlm-icon-btn',
			attr: { 'aria-label': i18n.btnRefreshTitle },
		});
		setIcon(refreshBtn, 'refresh-cw');
		refreshBtn.addEventListener('click', () => {
			new Notice(i18n.noticeRefreshing);
			void this.loadNotebooksAndSources().then(() =>
				this.plugin.tracker.checkPendingJobs()
			);
		});

		// Notebook Selector Row
		const selectorRow = header.createDiv({ cls: 'nlm-notebook-selector-row' });
		this.notebookSelectEl = selectorRow.createEl('select', {
			cls: 'nlm-notebook-select',
		});
		this.notebookSelectEl.addEventListener('change', () => {
			void (async () => {
				this.plugin.settings.activeNotebookId = this.notebookSelectEl.value;
				this.stopAudioPlayback();
				this.renderChatFeed();
				this.renderArtifactsPanel();
				await this.plugin.saveSettings();
				await this.loadSourcesForActiveNotebook();
			})();
		});

		// Onboarding / Health Warning Banner (hidden when healthy)
		this.onboardingBannerEl = container.createDiv({
			cls: 'nlm-onboarding-banner is-hidden',
		});

		// 2. COLLAPSIBLE SOURCES DRAWER
		const sourcesSection = container.createDiv({ cls: 'nlm-sources-section' });
		const sourcesHeader = sourcesSection.createDiv({
			cls: 'nlm-sources-header',
			attr: {
				role: 'button',
				tabindex: '0',
				'aria-expanded': String(this.isSourcesExpanded),
			},
		});

		const sourcesHeaderLeft = sourcesHeader.createDiv({ cls: 'nlm-sources-header-left' });
		const chevron = sourcesHeaderLeft.createSpan({ cls: 'nlm-chevron' });
		setIcon(chevron, this.isSourcesExpanded ? 'chevron-down' : 'chevron-right');
		sourcesHeaderLeft.createSpan({ text: i18n.sourcesTitle, cls: 'nlm-sources-title' });
		this.sourcesCountBadgeEl = sourcesHeaderLeft.createSpan({
			text: '0',
			cls: 'nlm-badge',
		});

		const sourcesQuickUpload = sourcesHeader.createEl('button', {
			cls: 'nlm-sources-add-btn',
			text: `+ ${i18n.btnUploadLabel}`,
		});
		sourcesQuickUpload.addEventListener('click', (e) => {
			e.stopPropagation();
			this.openDirectUploadModal();
		});

		this.sourcesContainerEl = sourcesSection.createDiv({
			cls: `nlm-sources-list ${this.isSourcesExpanded ? '' : 'is-collapsed'}`,
		});

		const toggleSourcesDrawer = () => {
			this.isSourcesExpanded = !this.isSourcesExpanded;
			this.sourcesContainerEl.toggleClass('is-collapsed', !this.isSourcesExpanded);
			sourcesHeader.setAttr('aria-expanded', String(this.isSourcesExpanded));
			setIcon(chevron, this.isSourcesExpanded ? 'chevron-down' : 'chevron-right');
		};
		sourcesHeader.addEventListener('click', toggleSourcesDrawer);
		sourcesHeader.addEventListener('keydown', (e) => {
			if (e.target !== sourcesHeader) return;
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				toggleSourcesDrawer();
			}
		});

		// 3. STUDIO ARTIFACT QUICK-BAR (responsive wrapping grid, no clipping)
		const studioBar = container.createDiv({ cls: 'nlm-studio-bar' });
		const studioGrid = studioBar.createDiv({ cls: 'nlm-studio-grid' });

		const studioButtons: Array<{ type: ArtifactType; label: string }> = [
			{ type: 'audio', label: i18n.studioAudio },
			{ type: 'report', label: i18n.studioReport },
			{ type: 'quiz', label: i18n.studioQuiz },
			{ type: 'flashcards', label: i18n.studioFlashcards },
			{ type: 'mind_map', label: i18n.studioMindmap },
			{ type: 'slide_deck', label: i18n.studioSlides },
			{ type: 'infographic', label: i18n.studioInfographic },
		];

		for (const btnInfo of studioButtons) {
			const btn = studioGrid.createEl('button', {
				cls: 'nlm-studio-pill',
				attr: { 'aria-label': i18n.studioGenerateTooltip(btnInfo.label) },
			});
			const ic = btn.createSpan({ cls: 'nlm-studio-pill-icon' });
			setIcon(ic, this.getIconForArtifactType(btnInfo.type));
			btn.createSpan({ text: btnInfo.label });
			btn.addEventListener('click', () => this.openArtifactModal(btnInfo.type));
		}

		// 3b. COLLAPSIBLE STUDIO ARTIFACTS BROWSER DRAWER
		const studioDrawerSection = container.createDiv({ cls: 'nlm-studio-drawer-section' });
		this.studioDrawerHeaderEl = studioDrawerSection.createDiv({
			cls: 'nlm-studio-drawer-header',
			attr: {
				role: 'button',
				tabindex: '0',
				'aria-expanded': String(this.isStudioDrawerExpanded),
			},
		});

		const studioHeaderLeft = this.studioDrawerHeaderEl.createDiv({
			cls: 'nlm-studio-drawer-header-left',
		});
		this.studioDrawerChevronEl = studioHeaderLeft.createSpan({ cls: 'nlm-chevron' });
		setIcon(
			this.studioDrawerChevronEl,
			this.isStudioDrawerExpanded ? 'chevron-down' : 'chevron-right'
		);
		const studioIcon = studioHeaderLeft.createSpan({ cls: 'nlm-studio-drawer-icon' });
		setIcon(studioIcon, 'sparkles');
		studioHeaderLeft.createSpan({
			text: i18n.studioArtifactsDrawerTitle,
			cls: 'nlm-studio-drawer-title',
		});
		this.studioDrawerBadgeEl = studioHeaderLeft.createSpan({
			text: '0',
			cls: 'nlm-badge',
		});

		const studioRefreshBtn = this.studioDrawerHeaderEl.createEl('button', {
			cls: 'nlm-studio-drawer-refresh-btn',
			attr: { 'aria-label': i18n.btnRefreshStudioTitle },
		});
		setIcon(studioRefreshBtn, 'refresh-cw');
		studioRefreshBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			new Notice(i18n.noticeRefreshing);
			void this.loadStudioArtifactsForActiveNotebook().then(() =>
				this.plugin.tracker.checkPendingJobs()
			);
		});

		this.studioDrawerListEl = studioDrawerSection.createDiv({
			cls: `nlm-studio-drawer-list ${
				this.isStudioDrawerExpanded ? '' : 'is-collapsed'
			}`,
		});

		const toggleStudioDrawer = () => {
			this.isStudioDrawerExpanded = !this.isStudioDrawerExpanded;
			this.studioDrawerListEl.toggleClass(
				'is-collapsed',
				!this.isStudioDrawerExpanded
			);
			this.studioDrawerHeaderEl.setAttr(
				'aria-expanded',
				String(this.isStudioDrawerExpanded)
			);
			setIcon(
				this.studioDrawerChevronEl,
				this.isStudioDrawerExpanded ? 'chevron-down' : 'chevron-right'
			);
			if (this.isStudioDrawerExpanded) {
				void this.loadStudioArtifactsForActiveNotebook();
			}
		};
		this.studioDrawerHeaderEl.addEventListener('click', toggleStudioDrawer);
		this.studioDrawerHeaderEl.addEventListener('keydown', (e) => {
			if (e.target !== this.studioDrawerHeaderEl) return;
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				toggleStudioDrawer();
			}
		});

		// 4. ACTIVE / COMPLETED ARTIFACT JOBS PANEL
		this.artifactsContainerEl = container.createDiv({ cls: 'nlm-artifacts-panel' });

		// Status banner for uploads / syncs (with animated shimmer)
		this.statusBannerEl = container.createDiv({ cls: 'nlm-status-banner is-hidden' });

		// 5. CHAT FEED
		this.chatFeedEl = container.createDiv({ cls: 'nlm-chat-feed' });

		// 6. COMPOSER (Context Chips + Input + Send)
		const composer = container.createDiv({ cls: 'nlm-composer' });

		const contextHeader = composer.createDiv({ cls: 'nlm-context-bar' });
		this.contextChipsEl = contextHeader.createDiv({ cls: 'nlm-context-chips' });

		const addContextBtn = contextHeader.createEl('button', {
			cls: 'nlm-add-context-btn',
			text: i18n.btnAddContextFile,
			attr: { 'aria-label': i18n.btnAddContextFileTooltip },
		});
		addContextBtn.addEventListener('click', () => this.openContextFilePicker());

		const inputWrapper = composer.createDiv({ cls: 'nlm-input-wrapper' });
		this.promptInputEl = inputWrapper.createEl('textarea', {
			cls: 'nlm-prompt-textarea',
			attr: {
				placeholder: i18n.promptPlaceholder,
				rows: '2',
			},
		});

		this.promptInputEl.addEventListener('input', () => {
			const val = this.promptInputEl.value;
			const cursorPos = this.promptInputEl.selectionStart || 0;
			const charBefore = val.slice(cursorPos - 1, cursorPos);
			const prevChar = cursorPos >= 2 ? val.slice(cursorPos - 2, cursorPos - 1) : ' ';

			if (charBefore === '@' && (prevChar === ' ' || prevChar === '\n')) {
				this.promptInputEl.value =
					val.slice(0, cursorPos - 1) + val.slice(cursorPos);
				this.openContextFilePicker();
			}

			this.promptInputEl.setCssProps({ '--nlm-ta-height': 'auto' });
			const nextHeight = Math.min(120, this.promptInputEl.scrollHeight);
			this.promptInputEl.setCssProps({ '--nlm-ta-height': `${nextHeight}px` });
		});

		this.promptInputEl.addEventListener('keydown', (e) => {
			if (e.key === 'Enter' && !e.shiftKey) {
				e.preventDefault();
				void this.handleSendPrompt();
			}
		});

		const composerActions = inputWrapper.createDiv({ cls: 'nlm-composer-actions' });

		const clearChatBtn = composerActions.createEl('button', {
			cls: 'nlm-icon-btn nlm-clear-chat-btn',
			attr: { 'aria-label': i18n.btnClearChatTitle },
		});
		setIcon(clearChatBtn, 'trash-2');
		clearChatBtn.addEventListener('click', () => {
			const nbId = this.plugin.settings.activeNotebookId;
			if (nbId && this.plugin.settings.chatHistories[nbId]) {
				this.plugin.settings.chatHistories[nbId] = { messages: [] };
				void this.plugin.saveSettings();
				this.renderChatFeed();
			}
		});

		this.sendBtnEl = composerActions.createEl('button', {
			cls: 'nlm-send-btn mod-cta',
			attr: { 'aria-label': i18n.btnSendTooltip },
		});
		setIcon(this.sendBtnEl, 'send');
		this.sendBtnEl.addEventListener('click', () => {
			void this.handleSendPrompt();
		});

		this.renderContextChips();
	}

	private renderOnboardingBanner(): void {
		if (!this.onboardingBannerEl) return;
		this.onboardingBannerEl.empty();

		if (!this.healthStatus || (this.healthStatus.installed && this.healthStatus.authenticated)) {
			this.onboardingBannerEl.addClass('is-hidden');
			return;
		}

		const i18n = this.i18n;
		this.onboardingBannerEl.removeClass('is-hidden');

		const titleRow = this.onboardingBannerEl.createDiv({
			cls: 'nlm-onboarding-title',
		});
		const warnIcon = titleRow.createSpan({ cls: 'nlm-onboarding-icon' });
		setIcon(warnIcon, 'alert-triangle');
		titleRow.createSpan({
			text: !this.healthStatus.installed
				? i18n.nlmMissingTitle
				: i18n.nlmAuthMissingTitle,
		});

		this.onboardingBannerEl.createDiv({
			cls: 'nlm-onboarding-desc',
			text: !this.healthStatus.installed
				? i18n.nlmMissingDesc
				: i18n.nlmAuthMissingDesc,
		});

		const btnRow = this.onboardingBannerEl.createDiv({
			cls: 'nlm-onboarding-actions',
		});

		const settingsBtn = btnRow.createEl('button', {
			cls: 'nlm-onboarding-btn',
			text: i18n.btnOpenSettings,
		});
		settingsBtn.addEventListener('click', () => {
			this.plugin.openPluginSettings();
		});

		if (this.healthStatus.installed && !this.healthStatus.authenticated) {
			const loginBtn = btnRow.createEl('button', {
				cls: 'nlm-onboarding-btn mod-cta',
				text: i18n.btnRunLogin,
			});
			loginBtn.addEventListener('click', () => {
				let loginFailed = false;
				this.plugin.bridge.launchBrowserLogin((err) => {
					loginFailed = true;
					new Notice(i18n.noticeConnectionError(err.message));
				});
				if (!loginFailed) {
					new Notice(i18n.noticeLoginStarted, 8000);
				}
			});
		}
	}

	private setStatusBanner(text: string | null): void {
		if (!this.statusBannerEl) return;
		if (!text) {
			this.statusBannerEl.addClass('is-hidden');
			this.statusBannerEl.empty();
		} else {
			this.statusBannerEl.removeClass('is-hidden');
			this.statusBannerEl.empty();
			this.statusBannerEl.createSpan({ cls: 'nlm-status-spinner' });
			this.statusBannerEl.createSpan({ text });
		}
	}

	public async loadNotebooksAndSources(): Promise<void> {
		if (this.isLoadingNotebooks) return;
		this.isLoadingNotebooks = true;
		try {
			this.notebooks = await this.plugin.bridge.listNotebooks();
			this.healthStatus = {
				installed: true,
				authenticated: true,
				version: '',
				account: '',
				resolvedPath: this.plugin.bridge.getEffectivePath(),
			};
			this.renderOnboardingBanner();
			this.renderNotebookSelect();
			if (this.plugin.settings.activeNotebookId) {
				await this.loadSourcesForActiveNotebook();
			}
		} catch (err: unknown) {
			this.healthStatus = await this.plugin.bridge.checkHealth();
			this.renderOnboardingBanner();
			const msg = err instanceof Error ? err.message : String(err);
			new Notice(this.i18n.noticeConnectionError(msg));
		} finally {
			this.isLoadingNotebooks = false;
		}
	}

	private renderNotebookSelect(): void {
		if (!this.notebookSelectEl) return;
		this.notebookSelectEl.empty();

		if (this.notebooks.length === 0) {
			if (this.plugin.settings.activeNotebookId) {
				this.plugin.settings.activeNotebookId = '';
				void this.plugin.saveSettings();
			}
			this.notebookSelectEl.createEl('option', {
				value: '',
				text: this.i18n.noNotebooksOption,
			});
			return;
		}

		const currentId = this.plugin.settings.activeNotebookId;
		const exists = this.notebooks.some((n) => n.id === currentId);
		if (!exists && this.notebooks[0]) {
			this.plugin.settings.activeNotebookId = this.notebooks[0].id;
			void this.plugin.saveSettings();
		}

		for (const nb of this.notebooks) {
			const opt = this.notebookSelectEl.createEl('option', {
				value: nb.id,
				text: `📓 ${nb.title} (${nb.source_count})`,
			});
			if (nb.id === this.plugin.settings.activeNotebookId) {
				opt.selected = true;
			}
		}
	}

	public async loadSourcesForActiveNotebook(): Promise<void> {
		const nbId = this.plugin.settings.activeNotebookId;
		if (!nbId) {
			this.currentLoadedNotebookId = null;
			this.sources = [];
			this.studioArtifacts = [];
			this.studioArtifactsLoaded = false;
			this.stopAudioPlayback();
			this.renderSourcesList();
			this.renderStudioDrawerList();
			return;
		}

		if (this.currentLoadedNotebookId !== nbId) {
			this.currentLoadedNotebookId = nbId;
			this.sources = [];
			this.studioArtifacts = [];
			this.studioArtifactsLoaded = false;
			this.stopAudioPlayback();
			this.renderSourcesList();
			this.renderStudioDrawerList();
		}

		try {
			const [sourcesList, studioResult] = await Promise.all([
				this.plugin.bridge.listSources(nbId),
				this.plugin.bridge
					.getStudioStatus(nbId, true)
					.then((list) => ({ ok: true, list }))
					.catch(() => ({ ok: false, list: [] as StudioArtifactStatus[] })),
			]);
			if (this.plugin.settings.activeNotebookId !== nbId) {
				return;
			}
			this.sources = sourcesList;
			this.studioArtifacts = studioResult.list;
			this.studioArtifactsLoaded = studioResult.ok;

			if (!this.plugin.settings.uploadedFileMap[nbId]) {
				this.plugin.settings.uploadedFileMap[nbId] = {};
			}
			for (const src of this.sources) {
				this.plugin.settings.uploadedFileMap[nbId][src.title] = src.id;
			}
			await this.plugin.saveSettings();
			if (this.plugin.settings.activeNotebookId !== nbId) {
				return;
			}
			this.renderSourcesList();
			this.renderStudioDrawerList();
		} catch (err) {
			console.warn('Failed to load notebook sources:', err);
		}
	}

	public async loadStudioArtifactsForActiveNotebook(): Promise<void> {
		const nbId = this.plugin.settings.activeNotebookId;
		if (!nbId) {
			this.studioArtifacts = [];
			this.studioArtifactsLoaded = false;
			this.stopAudioPlayback();
			this.renderStudioDrawerList();
			return;
		}
		try {
			const artifacts = await this.plugin.bridge.getStudioStatus(nbId, true);
			if (this.plugin.settings.activeNotebookId !== nbId) {
				return;
			}
			this.studioArtifacts = artifacts;
			this.studioArtifactsLoaded = true;
			this.renderStudioDrawerList();
		} catch (err) {
			console.warn('Failed to load studio artifacts:', err);
		}
	}

	private renderSourcesList(): void {
		if (!this.sourcesContainerEl || !this.sourcesCountBadgeEl) return;
		const i18n = this.i18n;
		this.sourcesCountBadgeEl.setText(String(this.sources.length));
		this.sourcesContainerEl.empty();

		const activeFile = this.app.workspace.getActiveFile();
		if (activeFile) {
			const quickActiveRow = this.sourcesContainerEl.createDiv({
				cls: 'nlm-source-quick-active',
			});
			const uploadActiveBtn = quickActiveRow.createEl('button', {
				cls: 'nlm-upload-active-note-btn',
				text: i18n.btnUploadActiveNote(activeFile.basename),
			});
			uploadActiveBtn.addEventListener('click', () => {
				void this.uploadVaultFileToNotebook(activeFile, true);
			});
		}

		if (this.sources.length === 0) {
			this.sourcesContainerEl.createDiv({
				cls: 'nlm-sources-empty',
				text: i18n.sourcesEmpty,
			});
			return;
		}

		for (const src of this.sources) {
			const item = this.sourcesContainerEl.createDiv({ cls: 'nlm-source-item' });
			const iconEl = item.createSpan({ cls: 'nlm-source-icon' });
			setIcon(iconEl, src.type === 'pdf' ? 'file-type' : 'file-text');

			item.createSpan({
				text: src.title,
				cls: 'nlm-source-name',
				attr: { title: src.title },
			});

			const delBtn = item.createEl('button', {
				cls: 'nlm-source-del-btn',
				attr: { 'aria-label': i18n.btnDeleteSourceTitle },
			});
			setIcon(delBtn, 'x');
			delBtn.addEventListener('click', () => {
				void (async () => {
					try {
						this.setStatusBanner(i18n.statusDeletingSource(src.title));
						await this.plugin.bridge.deleteSource(src.id);
						await this.loadSourcesForActiveNotebook();
						new Notice(i18n.noticeSourceDeleted(src.title));
					} catch (err: unknown) {
						const msg = err instanceof Error ? err.message : String(err);
						new Notice(i18n.noticeDeleteError(msg));
					} finally {
						this.setStatusBanner(null);
					}
				})();
			});
		}
	}

	private renderContextChips(): void {
		if (!this.contextChipsEl) return;
		const i18n = this.i18n;
		this.contextChipsEl.empty();

		const activeFile = this.app.workspace.getActiveFile();
		this.activeNoteFile = activeFile;

		if (activeFile) {
			const activeChip = this.contextChipsEl.createDiv({
				cls: `nlm-chip nlm-chip-active-note ${
					this.includeActiveNote ? 'is-active' : 'is-muted'
				}`,
				attr: {
					title: this.includeActiveNote
						? i18n.chipActiveNoteOn(activeFile.path)
						: i18n.chipActiveNoteOff,
				},
			});
			const ic = activeChip.createSpan({ cls: 'nlm-chip-icon' });
			setIcon(ic, this.includeActiveNote ? 'check-circle-2' : 'circle');
			activeChip.createSpan({
				text: activeFile.name,
				cls: 'nlm-chip-label',
			});
			activeChip.addEventListener('click', () => {
				this.includeActiveNote = !this.includeActiveNote;
				this.renderContextChips();
			});
		}

		for (const file of this.contextFiles) {
			if (activeFile && file.path === activeFile.path && this.includeActiveNote) {
				continue;
			}
			const chip = this.contextChipsEl.createDiv({
				cls: 'nlm-chip nlm-chip-extra is-active',
				attr: { title: file.path },
			});
			const ic = chip.createSpan({ cls: 'nlm-chip-icon' });
			setIcon(ic, 'paperclip');
			chip.createSpan({ text: file.name, cls: 'nlm-chip-label' });

			const removeSpan = chip.createSpan({ cls: 'nlm-chip-remove', text: '×' });
			removeSpan.addEventListener('click', (e) => {
				e.stopPropagation();
				this.contextFiles = this.contextFiles.filter((f) => f.path !== file.path);
				this.renderContextChips();
			});
		}
	}

	private openContextFilePicker(): void {
		new VaultFileSuggestModal(
			this.app,
			(file) => {
				if (!this.contextFiles.some((f) => f.path === file.path)) {
					this.contextFiles.push(file);
					this.renderContextChips();
				}
				this.promptInputEl?.focus();
			},
			this.i18n.modalContextPickerPlaceholder
		).open();
	}

	private openDirectUploadModal(): void {
		const i18n = this.i18n;
		if (!this.plugin.settings.activeNotebookId) {
			new Notice(i18n.noticeSelectNotebookFirst);
			return;
		}
		new VaultFileSuggestModal(
			this.app,
			(file) => {
				void this.uploadVaultFileToNotebook(file, true);
			},
			i18n.modalDirectUploadPlaceholder
		).open();
	}

	private openCreateNotebookModal(): void {
		const i18n = this.i18n;
		const activeFile = this.app.workspace.getActiveFile();
		const defaultTitle = activeFile ? activeFile.basename : '';
		new CreateNotebookModal(
			this.app,
			defaultTitle,
			this.plugin.settings.uiLanguage,
			(title) => {
				void (async () => {
					try {
						this.setStatusBanner(i18n.statusCreatingNotebook(title));
						const res = await this.plugin.bridge.createNotebook(title);
						this.plugin.settings.activeNotebookId = res.notebook_id;
						await this.plugin.saveSettings();
						await this.loadNotebooksAndSources();
						this.renderChatFeed();
						this.renderArtifactsPanel();
						new Notice(i18n.noticeNotebookCreated(title));
					} catch (err: unknown) {
						const msg = err instanceof Error ? err.message : String(err);
						new Notice(i18n.noticeCreateError(msg));
					} finally {
						this.setStatusBanner(null);
					}
				})();
			}
		).open();
	}

	private getAbsolutePathForVaultFile(file: TFile): string {
		const adapter = this.app.vault.adapter;
		if (adapter instanceof FileSystemAdapter) {
			return adapter.getFullPath(file.path);
		}
		throw new Error('FileSystemAdapter unavailable.');
	}

	private getActiveNoteFolderInfo(): {
		folderRel: string;
		noteName: string;
		notePath: string;
	} {
		const file = this.app.workspace.getActiveFile() || this.activeNoteFile;

		if (file) {
			const folderRel =
				file.parent?.path && file.parent.path !== '/' ? file.parent.path : '';
			return {
				folderRel,
				noteName: file.basename,
				notePath: file.path,
			};
		}

		return {
			folderRel: '',
			noteName: 'NotebookLM',
			notePath: '',
		};
	}

	public uploadVaultFileToNotebook(
		file: TFile,
		forceUpload = false
	): Promise<string | null> {
		const task = this.uploadQueue.then(() =>
			this.performUploadVaultFile(file, forceUpload)
		);
		this.uploadQueue = task.catch(() => null);
		return task;
	}

	private async performUploadVaultFile(
		file: TFile,
		forceUpload: boolean
	): Promise<string | null> {
		const i18n = this.i18n;
		const nbId = this.plugin.settings.activeNotebookId;
		if (!nbId) {
			new Notice(i18n.noticeSelectNotebookFirst);
			return null;
		}

		if (!this.plugin.settings.uploadedFileMap[nbId]) {
			this.plugin.settings.uploadedFileMap[nbId] = {};
		}
		if (!this.plugin.settings.uploadedFileMtimes[nbId]) {
			this.plugin.settings.uploadedFileMtimes[nbId] = {};
		}

		const map = this.plugin.settings.uploadedFileMap[nbId];
		const mtimes = this.plugin.settings.uploadedFileMtimes[nbId];

		const existingByPath = map[file.path];
		const existingByName = map[file.name];
		const foundInSources = this.sources.find(
			(s) =>
				s.id === existingByPath ||
				s.id === existingByName ||
				s.title === file.name
		);

		const lastUploadedMtime = mtimes[file.path] || 0;
		const isNoteModified =
			(file.extension === 'md' || file.extension === 'txt') &&
			lastUploadedMtime > 0 &&
			file.stat.mtime > lastUploadedMtime;

		if (!forceUpload && foundInSources && !isNoteModified) {
			return foundInSources.id;
		}

		try {
			if (foundInSources && (isNoteModified || forceUpload)) {
				this.setStatusBanner(i18n.statusUpdatingSource(file.name));
				try {
					await this.plugin.bridge.deleteSource(foundInSources.id);
				} catch {
					// Ignore if already deleted remotely
				}
			} else {
				this.setStatusBanner(i18n.statusUploadingSource(file.name));
			}

			const absPath = this.getAbsolutePathForVaultFile(file);
			const res = await this.plugin.bridge.addFileSource(nbId, absPath, true);
			map[file.path] = res.source_id;
			map[file.name] = res.source_id;
			mtimes[file.path] = file.stat.mtime;
			await this.plugin.saveSettings();
			await this.loadSourcesForActiveNotebook();
			new Notice(i18n.noticeSourceUploaded(file.name));
			return res.source_id;
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err);
			new Notice(i18n.noticeUploadFailed(file.name, msg));
			return null;
		} finally {
			this.setStatusBanner(null);
		}
	}

	private async ensureContextFilesUploaded(): Promise<{
		sourceIds: string[];
		fileNames: string[];
	}> {
		const filesToSync: TFile[] = [];
		const activeFile = this.app.workspace.getActiveFile() || this.activeNoteFile;

		if (this.includeActiveNote && activeFile) {
			filesToSync.push(activeFile);
		}
		for (const f of this.contextFiles) {
			if (!filesToSync.some((existing) => existing.path === f.path)) {
				filesToSync.push(f);
			}
		}

		const sourceIds: string[] = [];
		const fileNames: string[] = [];

		for (const file of filesToSync) {
			if (file.stat.size === 0) {
				continue;
			}
			const srcId = await this.uploadVaultFileToNotebook(file, false);
			if (!srcId) {
				throw new Error(this.i18n.errorContextSyncFailed(file.name));
			}
			fileNames.push(file.name);
			sourceIds.push(srcId);
		}

		return { sourceIds, fileNames };
	}

	private async handleSendPrompt(): Promise<void> {
		if (this.isSendingChat) return;
		const question = this.promptInputEl.value.trim();
		if (!question) return;

		const i18n = this.i18n;
		const nbId = this.plugin.settings.activeNotebookId;
		if (!nbId) {
			new Notice(i18n.noticeSelectNotebookFirst);
			return;
		}

		this.isSendingChat = true;
		this.promptInputEl.value = '';
		this.promptInputEl.setCssProps({ '--nlm-ta-height': 'auto' });
		this.sendBtnEl.disabled = true;

		try {
			const { sourceIds, fileNames } = await this.ensureContextFilesUploaded();

			if (!this.plugin.settings.chatHistories[nbId]) {
				this.plugin.settings.chatHistories[nbId] = { messages: [] };
			}
			const history = this.plugin.settings.chatHistories[nbId];

			const userMsg: ChatMessage = {
				id: `user-${Date.now()}`,
				role: 'user',
				content: question,
				timestamp: Date.now(),
				contextFiles: fileNames,
			};
			history.messages.push(userMsg);
			if (history.messages.length > MAX_CHAT_MESSAGES) {
				history.messages = history.messages.slice(-MAX_CHAT_MESSAGES);
			}
			await this.plugin.saveSettings();
			this.renderChatFeed();

			this.setStatusBanner(i18n.statusQueryingNotebook);

			const queryStartedAt = Date.now();
			const hadPreStudioSnapshot = this.studioArtifactsLoaded;
			const preStudioIds = new Set(
				this.studioArtifacts.map((a) => a.artifact_id || a.id)
			);

			const result = await this.plugin.bridge.queryNotebook(nbId, question, {
				conversationId: history.conversationId,
				sourceIds: sourceIds.length > 0 ? sourceIds : undefined,
			});

			if (result.conversation_id) {
				history.conversationId = result.conversation_id;
			}

			const assistantMsg: ChatMessage = {
				id: `assistant-${Date.now()}`,
				role: 'assistant',
				content: result.answer || '—',
				timestamp: Date.now(),
				references: result.references || [],
			};
			history.messages.push(assistantMsg);
			if (history.messages.length > MAX_CHAT_MESSAGES) {
				history.messages = history.messages.slice(-MAX_CHAT_MESSAGES);
			}
			await this.plugin.saveSettings();

			this.isSendingChat = false;
			this.sendBtnEl.disabled = false;
			this.setStatusBanner(null);
			this.renderChatFeed();

			// Wait ~3 seconds before checking studio status so Gemini NotebookLM has time
			// to spawn any server-side Studio artifact triggered by the chat response.
			if (this.postChatStudioCheckTimer !== null) {
				window.clearTimeout(this.postChatStudioCheckTimer);
			}
			this.postChatStudioCheckTimer = window.setTimeout(() => {
				this.postChatStudioCheckTimer = null;
				if (!this.isViewOpen) return;
				void this.detectAndTrackChatArtifacts(
					nbId,
					question,
					preStudioIds,
					hadPreStudioSnapshot,
					queryStartedAt
				);
			}, 3000);
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err);
			new Notice(i18n.noticeQueryError(msg));
		} finally {
			if (this.isSendingChat) {
				this.isSendingChat = false;
				this.sendBtnEl.disabled = false;
				this.setStatusBanner(null);
				this.renderChatFeed();
			}
		}
	}

	private renderChatFeed(): void {
		if (!this.chatFeedEl) return;
		const i18n = this.i18n;
		this.chatFeedEl.empty();

		const nbId = this.plugin.settings.activeNotebookId;
		const history = nbId ? this.plugin.settings.chatHistories[nbId] : undefined;
		const messages = history?.messages || [];

		if (messages.length === 0 && !this.isSendingChat) {
			const emptyState = this.chatFeedEl.createDiv({ cls: 'nlm-chat-empty' });
			const emptyIcon = emptyState.createDiv({ cls: 'nlm-chat-empty-icon' });
			setIcon(emptyIcon, NOTEBOOKLM_ICON_ID);
			emptyState.createEl('h4', { text: i18n.chatEmptyTitle });
			emptyState.createEl('p', {
				text: i18n.chatEmptyDesc,
			});
			return;
		}

		for (const msg of messages) {
			const bubble = this.chatFeedEl.createDiv({
				cls: `nlm-chat-bubble nlm-chat-${msg.role}`,
			});

			const metaRow = bubble.createDiv({ cls: 'nlm-chat-meta' });
			metaRow.createSpan({
				text:
					msg.role === 'user'
						? i18n.chatAuthorUser
						: `✨ ${i18n.chatAuthorAssistant}`,
				cls: 'nlm-chat-author',
			});

			if (msg.contextFiles && msg.contextFiles.length > 0) {
				metaRow.createSpan({
					cls: 'nlm-chat-ctx-badge',
					text: i18n.chatSourcesBadge(msg.contextFiles.length),
					attr: { title: msg.contextFiles.join(', ') },
				});
			}

			const contentDiv = bubble.createDiv({
				cls: 'nlm-chat-content markdown-rendered',
			});
			void MarkdownRenderer.render(this.app, msg.content, contentDiv, '', this);

			if (msg.references && msg.references.length > 0) {
				const refsDetails = bubble.createEl('details', { cls: 'nlm-chat-refs' });
				refsDetails.createEl('summary', {
					text: i18n.chatRefsSummary(msg.references.length),
				});
				const refsList = refsDetails.createDiv({ cls: 'nlm-chat-refs-list' });
				for (const ref of msg.references) {
					const srcObj = this.sources.find((s) => s.id === ref.source_id);
					const srcTitle = srcObj ? srcObj.title : i18n.chatSourceFallback;
					const refItem = refsList.createDiv({ cls: 'nlm-chat-ref-item' });
					refItem.createEl('strong', {
						text: `[${ref.citation_number}] ${srcTitle}: `,
					});
					refItem.createSpan({
						text:
							ref.cited_text.length > 260
								? `${ref.cited_text.slice(0, 260)}...`
								: ref.cited_text,
					});
				}
			}

			if (msg.role === 'assistant') {
				const actionsRow = bubble.createDiv({ cls: 'nlm-chat-msg-actions' });

				const copyBtn = actionsRow.createEl('button', {
					cls: 'nlm-msg-action-btn',
					text: i18n.btnCopy,
				});
				copyBtn.addEventListener('click', () => {
					void navigator.clipboard.writeText(msg.content);
					new Notice(i18n.noticeCopied);
				});

				const insertBtn = actionsRow.createEl('button', {
					cls: 'nlm-msg-action-btn',
					text: i18n.btnInsertIntoNote,
				});
				insertBtn.addEventListener('click', () => {
					void (async () => {
						const activeFile = this.app.workspace.getActiveFile();
						if (!activeFile) {
							new Notice(i18n.noticeNoActiveFile);
							return;
						}
						await this.app.vault.append(activeFile, `\n\n${msg.content}\n`);
						new Notice(i18n.noticeInsertedIntoNote(activeFile.name));
					})();
				});
			}
		}

		if (this.isSendingChat) {
			const thinkingBubble = this.chatFeedEl.createDiv({
				cls: 'nlm-chat-bubble nlm-chat-assistant nlm-chat-thinking-bubble',
			});
			const dots = thinkingBubble.createDiv({ cls: 'nlm-thinking-dots' });
			dots.createSpan();
			dots.createSpan();
			dots.createSpan();
			thinkingBubble.createSpan({
				text: i18n.chatThinking,
				cls: 'nlm-thinking-text',
			});
		}

		this.chatFeedEl.scrollTop = this.chatFeedEl.scrollHeight;
	}

	private openArtifactModal(initialType: ArtifactType): void {
		const i18n = this.i18n;
		const nbId = this.plugin.settings.activeNotebookId;
		if (!nbId) {
			new Notice(i18n.noticeSelectNotebookFirst);
			return;
		}

		const folderInfo = this.getActiveNoteFolderInfo();
		new ArtifactConfigModal(
			this.app,
			initialType,
			this.plugin.settings.defaultLanguage,
			folderInfo.folderRel,
			this.plugin.settings.uiLanguage,
			(options) => {
				void this.startArtifactGeneration(options, folderInfo);
			}
		).open();
	}

	private async startArtifactGeneration(
		options: ArtifactCreateOptions,
		folderInfo: {
			folderRel: string;
			noteName: string;
			notePath: string;
		}
	): Promise<void> {
		const i18n = this.i18n;
		const nbId = this.plugin.settings.activeNotebookId;
		if (!nbId) return;

		const nbObj = this.notebooks.find((n) => n.id === nbId);
		const nbTitle = nbObj ? nbObj.title : 'Notebook';

		const rawChosenRel =
			options.targetFolderRel !== undefined
				? options.targetFolderRel.replace(/^\/+|\/+$/g, '')
				: folderInfo.folderRel;
		const chosenFolderRel = rawChosenRel ? normalizePath(rawChosenRel) : '';

		try {
			const { sourceIds } = await this.ensureContextFilesUploaded();
			if (sourceIds.length > 0) {
				options.sourceIds = sourceIds;
			}

			const typeLabel = this.plugin.tracker.getTypeLabel(options.type);
			this.setStatusBanner(i18n.statusStartingArtifact(typeLabel));

			const res = await this.plugin.bridge.createArtifact(nbId, options);

			const job: ArtifactJob = {
				id: res.artifact_id,
				notebookId: nbId,
				notebookTitle: nbTitle,
				type: options.type,
				label: `${typeLabel} (${folderInfo.noteName})`,
				focusPrompt: options.focus,
				targetFolderRel: chosenFolderRel,
				sourceNoteName: folderInfo.noteName,
				sourceNotePath: folderInfo.notePath,
				createdAt: Date.now(),
				status: 'queued',
				downloaded: false,
			};

			await this.plugin.tracker.addJob(job);
			await this.loadStudioArtifactsForActiveNotebook();
			new Notice(i18n.noticeArtifactStarted(typeLabel, chosenFolderRel));
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err);
			new Notice(i18n.noticeArtifactStartError(msg));
		} finally {
			this.setStatusBanner(null);
		}
	}

	private expandStudioDrawer(): void {
		if (this.isStudioDrawerExpanded) return;
		this.isStudioDrawerExpanded = true;
		if (this.studioDrawerListEl) {
			this.studioDrawerListEl.removeClass('is-collapsed');
		}
		if (this.studioDrawerHeaderEl) {
			this.studioDrawerHeaderEl.setAttr('aria-expanded', 'true');
		}
		if (this.studioDrawerChevronEl) {
			setIcon(this.studioDrawerChevronEl, 'chevron-down');
		}
	}

	private async detectAndTrackChatArtifacts(
		nbId: string,
		question: string,
		preStudioIds: Set<string>,
		hadPreStudioSnapshot: boolean,
		queryStartedAt: number
	): Promise<void> {
		const i18n = this.i18n;
		const folderInfo = this.getActiveNoteFolderInfo();
		const nbObj = this.notebooks.find((n) => n.id === nbId);
		const nbTitle = nbObj ? nbObj.title : 'Notebook';
		const chosenFolderRel = folderInfo.folderRel
			? normalizePath(folderInfo.folderRel)
			: '';

		try {
			const latestStudio = await this.plugin.bridge.getStudioStatus(nbId, true);
			if (!this.isViewOpen) return;
			if (this.plugin.settings.activeNotebookId === nbId) {
				this.studioArtifacts = latestStudio;
				this.studioArtifactsLoaded = true;
				this.renderStudioDrawerList();
			}

			const existingJobIds = new Set(
				(this.plugin.settings.artifactJobs || []).map((j) => j.id)
			);
			const newlyCreatedRemote = latestStudio.filter((item) => {
				const artId = item.artifact_id || item.id;
				if (
					!artId ||
					!isSupportedArtifactType(item.type) ||
					existingJobIds.has(artId) ||
					preStudioIds.has(artId)
				) {
					return false;
				}
				const createdMs = item.created_at ? Date.parse(item.created_at) : NaN;
				if (!Number.isNaN(createdMs)) {
					return createdMs >= queryStartedAt - 30000;
				}
				return hadPreStudioSnapshot && item.status !== 'completed';
			});

			if (newlyCreatedRemote.length > 0) {
				if (this.plugin.settings.activeNotebookId === nbId) {
					this.expandStudioDrawer();
				}
				for (const remote of newlyCreatedRemote) {
					const artId = remote.artifact_id || remote.id;
					const normType = this.plugin.tracker.normalizeArtifactType(remote.type);
					const typeLabel = this.plugin.tracker.getTypeLabel(normType);
					const displayTitle =
						remote.title?.trim() || `${typeLabel} (${folderInfo.noteName})`;

					const job: ArtifactJob = {
						id: artId,
						notebookId: nbId,
						notebookTitle: nbTitle,
						type: normType,
						label: displayTitle,
						focusPrompt: remote.custom_instructions || question,
						targetFolderRel: chosenFolderRel,
						sourceNoteName: folderInfo.noteName,
						sourceNotePath: folderInfo.notePath,
						createdAt: Date.now(),
						status: remote.status === 'completed' ? 'completed' : 'processing',
						downloaded: false,
					};
					await this.plugin.tracker.addJob(job);
					if (remote.status === 'completed') {
						await this.plugin.tracker.downloadCompletedJob(job);
						await this.plugin.saveSettings();
						this.renderArtifactsPanel();
						this.renderStudioDrawerList();
					} else {
						new Notice(i18n.noticeArtifactStarted(typeLabel, chosenFolderRel));
					}
				}
			}
		} catch (err) {
			console.warn('Chat artifact studio status check error:', err);
		}
	}

	private getIconForArtifactType(type: ArtifactType): string {
		switch (type) {
			case 'audio':
				return 'headphones';
			case 'report':
				return 'file-text';
			case 'quiz':
				return 'help-circle';
			case 'flashcards':
				return 'layers';
			case 'mind_map':
				return 'git-fork';
			case 'slide_deck':
				return 'presentation';
			case 'infographic':
				return 'image';
		}
	}

	private async importStudioArtifactToVault(
		remote: StudioArtifactStatus
	): Promise<string | null> {
		const nbId = this.plugin.settings.activeNotebookId;
		if (!nbId || !isSupportedArtifactType(remote.type)) return null;

		const artId = remote.artifact_id || remote.id;
		const existingJob = (this.plugin.settings.artifactJobs || []).find(
			(j) => j.id === artId
		);
		if (existingJob && existingJob.downloaded) {
			if (existingJob.downloadedFilePath) {
				const existsInVault = await this.app.vault.adapter.exists(
					existingJob.downloadedFilePath
				);
				if (existsInVault) {
					return existingJob.downloadedFilePath;
				}
			}
			existingJob.downloaded = false;
			existingJob.downloadedFilePath = undefined;
		}

		const folderInfo = this.getActiveNoteFolderInfo();
		const nbObj = this.notebooks.find((n) => n.id === nbId);
		const nbTitle = nbObj ? nbObj.title : 'Notebook';
		const normType = this.plugin.tracker.normalizeArtifactType(remote.type);
		const typeLabel = this.plugin.tracker.getTypeLabel(normType);
		const chosenFolderRel = folderInfo.folderRel
			? normalizePath(folderInfo.folderRel)
			: '';

		const wasNewlyAdded = !existingJob;
		let job = existingJob;
		if (!job) {
			job = {
				id: artId,
				notebookId: nbId,
				notebookTitle: nbTitle,
				type: normType,
				label: remote.title?.trim() || `${typeLabel} (${folderInfo.noteName})`,
				focusPrompt: remote.custom_instructions || undefined,
				targetFolderRel: chosenFolderRel,
				sourceNoteName: remote.title?.trim() || folderInfo.noteName,
				sourceNotePath: folderInfo.notePath,
				createdAt: remote.created_at
					? Date.parse(remote.created_at) || Date.now()
					: Date.now(),
				status: 'completed',
				downloaded: false,
			};
			await this.plugin.tracker.addJob(job);
		}

		const ok = await this.plugin.tracker.downloadCompletedJob(job);
		if (ok && job.downloadedFilePath) {
			await this.plugin.saveSettings();
			this.renderArtifactsPanel();
			this.renderStudioDrawerList();
			return job.downloadedFilePath;
		}
		if (wasNewlyAdded) {
			await this.plugin.tracker.removeJob(job.id);
		}
		return null;
	}

	private renderStudioDrawerList(): void {
		if (!this.studioDrawerListEl || !this.studioDrawerBadgeEl) return;
		const i18n = this.i18n;
		this.studioDrawerBadgeEl.setText(String(this.studioArtifacts.length));

		const preservedAudioEl =
			this.activeAudioEl &&
			this.playingArtifactId &&
			this.activeAudioArtifactId === this.playingArtifactId
				? this.activeAudioEl
				: null;
		const wasAudioPlaying = preservedAudioEl ? !preservedAudioEl.paused : false;
		const savedAudioTime = preservedAudioEl ? preservedAudioEl.currentTime : 0;

		this.studioDrawerListEl.empty();

		if (this.studioArtifacts.length === 0) {
			if (this.activeAudioEl || this.playingArtifactId) {
				this.stopAudioPlayback();
			}
			this.studioDrawerListEl.createDiv({
				cls: 'nlm-sources-empty',
				text: i18n.studioArtifactsEmpty,
			});
			return;
		}

		const allJobs = this.plugin.settings.artifactJobs || [];
		let reattachedActiveAudio = false;

		for (const item of this.studioArtifacts) {
			const artId = item.artifact_id || item.id;
			const isSupported = isSupportedArtifactType(item.type);
			const normType = this.plugin.tracker.normalizeArtifactType(item.type);
			const typeLabel = isSupported
				? this.plugin.tracker.getTypeLabel(normType)
				: item.type || 'Artifact';
			const matchingJob = allJobs.find((j) => j.id === artId);
			const isCompleted =
				item.status === 'completed' ||
				matchingJob?.status === 'completed' ||
				Boolean(matchingJob?.downloaded);
			const isFailed =
				!isCompleted &&
				(item.status === 'failed' || matchingJob?.status === 'failed');
			const isRunning = !isCompleted && !isFailed;
			const isDownloaded = Boolean(
				matchingJob?.downloaded && matchingJob.downloadedFilePath
			);
			const isDownloadingThis = this.plugin.tracker.isDownloading(artId);

			const card = this.studioDrawerListEl.createDiv({
				cls: `nlm-studio-item-card ${isRunning ? 'is-running' : ''}`,
			});

			const topRow = card.createDiv({ cls: 'nlm-studio-item-top' });
			const iconSpan = topRow.createSpan({ cls: 'nlm-studio-item-icon' });
			setIcon(iconSpan, this.getIconForArtifactType(normType));

			const titleText = item.title?.trim() || typeLabel;
			topRow.createSpan({
				text: titleText,
				cls: 'nlm-studio-item-title',
				attr: {
					title: item.custom_instructions
						? `${titleText}\n\n${item.custom_instructions}`
						: titleText,
				},
			});

			const statusBadge = topRow.createSpan({
				cls: `nlm-studio-status-pill is-${isCompleted ? 'completed' : isFailed ? 'failed' : 'running'}`,
				text: isCompleted
					? typeLabel
					: isFailed
						? i18n.artifactFailed
						: `⏳ ${i18n.artifactProcessing}`,
			});
			if (isRunning) {
				statusBadge.setAttr('title', item.status);
			}

			const actionsRow = card.createDiv({ cls: 'nlm-studio-item-actions' });

			// Play button for completed audio artifacts
			if (isSupported && isCompleted && normType === 'audio') {
				const isPlayingThis = this.playingArtifactId === artId;
				const playBtn = actionsRow.createEl('button', {
					cls: `nlm-studio-action-btn ${isPlayingThis ? 'is-active' : ''}`,
					text: isPlayingThis
						? `⏹ ${i18n.btnPauseArtifact}`
						: `▶ ${i18n.btnPlayArtifact}`,
				});
				playBtn.disabled = isDownloadingThis;
				playBtn.addEventListener('click', () => {
					void (async () => {
						if (this.playingArtifactId === artId) {
							this.stopAudioPlayback();
							this.renderStudioDrawerList();
							return;
						}
						const currentNbId = this.plugin.settings.activeNotebookId;
						playBtn.disabled = true;
						try {
							// Ensure downloaded locally so it plays reliably inside Obsidian without Google cookie CORS issues
							const localRelPath = await this.importStudioArtifactToVault(item);
							if (
								!this.isViewOpen ||
								this.plugin.settings.activeNotebookId !== currentNbId
							) {
								return;
							}
							if (localRelPath) {
								this.stopAudioPlayback();
								this.playingArtifactId = artId;
								this.renderStudioDrawerList();
							}
						} finally {
							if (playBtn.isConnected) {
								playBtn.disabled = this.plugin.tracker.isDownloading(artId);
							}
						}
					})();
				});
			}

			// Download / Open in Vault button for all completed supported artifacts
			if (isSupported && isCompleted) {
				const dlOrOpenBtn = actionsRow.createEl('button', {
					cls: 'nlm-studio-action-btn',
					text: isDownloaded
						? `📂 ${i18n.btnOpenVaultArtifact}`
						: `⬇ ${i18n.btnDownloadStudioArtifact}`,
				});
				dlOrOpenBtn.disabled = isDownloadingThis;
				dlOrOpenBtn.addEventListener('click', () => {
					void (async () => {
						const currentNbId = this.plugin.settings.activeNotebookId;
						dlOrOpenBtn.disabled = true;
						try {
							const localRelPath = await this.importStudioArtifactToVault(item);
							if (
								!this.isViewOpen ||
								this.plugin.settings.activeNotebookId !== currentNbId
							) {
								return;
							}
							if (localRelPath) {
								await this.app.workspace.openLinkText(localRelPath, '', false);
							}
						} finally {
							if (dlOrOpenBtn.isConnected) {
								dlOrOpenBtn.disabled = this.plugin.tracker.isDownloading(artId);
							}
						}
					})();
				});
			} else if (isSupported && isRunning) {
				// Allow tracking this running remote job if not already in tracker
				if (!matchingJob) {
					const trackBtn = actionsRow.createEl('button', {
						cls: 'nlm-studio-action-btn',
						text: `⏬ ${i18n.btnDownloadStudioArtifact}`,
					});
					trackBtn.addEventListener('click', () => {
						void (async () => {
							const folderInfo = this.getActiveNoteFolderInfo();
							const nbId = this.plugin.settings.activeNotebookId;
							const nbObj = this.notebooks.find((n) => n.id === nbId);
							const job: ArtifactJob = {
								id: artId,
								notebookId: nbId,
								notebookTitle: nbObj ? nbObj.title : 'Notebook',
								type: normType,
								label: `${titleText} (${folderInfo.noteName})`,
								focusPrompt: item.custom_instructions || undefined,
								targetFolderRel: folderInfo.folderRel
									? normalizePath(folderInfo.folderRel)
									: '',
								sourceNoteName: folderInfo.noteName,
								sourceNotePath: folderInfo.notePath,
								createdAt: Date.now(),
								status: 'processing',
								downloaded: false,
							};
							await this.plugin.tracker.addJob(job);
							this.renderStudioDrawerList();
							new Notice(
								i18n.noticeArtifactStarted(typeLabel, job.targetFolderRel)
							);
						})();
					});
				}
			}

			// Delete from NotebookLM studio button
			const delBtn = actionsRow.createEl('button', {
				cls: 'nlm-studio-del-btn',
				attr: { 'aria-label': i18n.btnDeleteStudioArtifactTitle },
			});
			setIcon(delBtn, 'trash-2');
			delBtn.addEventListener('click', () => {
				void (async () => {
					const nbId = this.plugin.settings.activeNotebookId;
					if (!nbId) return;
					delBtn.disabled = true;
					try {
						this.setStatusBanner(i18n.statusDeletingArtifact(titleText));
						await this.plugin.bridge.deleteStudioArtifact(nbId, artId);
						if (this.playingArtifactId === artId) {
							this.stopAudioPlayback();
						}
						await this.plugin.tracker.removeJob(artId);
						await this.loadStudioArtifactsForActiveNotebook();
						new Notice(i18n.noticeStudioArtifactDeleted(titleText));
					} catch (err: unknown) {
						const msg = err instanceof Error ? err.message : String(err);
						new Notice(i18n.noticeDeleteError(msg));
					} finally {
						if (delBtn.isConnected) {
							delBtn.disabled = false;
						}
						this.setStatusBanner(null);
					}
				})();
			});

			// Embedded audio player if currently playing
			if (this.playingArtifactId === artId && isCompleted && normType === 'audio') {
				if (preservedAudioEl && this.activeAudioArtifactId === artId) {
					const playerWrap = card.createDiv({ cls: 'nlm-studio-audio-player-wrap' });
					playerWrap.appendChild(preservedAudioEl);
					if (preservedAudioEl.currentTime === 0 && savedAudioTime > 0) {
						preservedAudioEl.currentTime = savedAudioTime;
					}
					if (wasAudioPlaying && preservedAudioEl.paused) {
						void preservedAudioEl.play().catch(() => {
							// Ignore autoplay interruption
						});
					}
					reattachedActiveAudio = true;
				} else {
					const updatedJob = (this.plugin.settings.artifactJobs || []).find(
						(j) => j.id === artId
					);
					let audioSrc = '';
					if (updatedJob?.downloadedFilePath) {
						const normPath = normalizePath(updatedJob.downloadedFilePath);
						const af = this.app.vault.getAbstractFileByPath(normPath);
						if (af instanceof TFile) {
							audioSrc = this.app.vault.getResourcePath(af);
						} else {
							audioSrc = this.app.vault.adapter.getResourcePath(normPath);
						}
					}
					if (!audioSrc && item.audio_url) {
						audioSrc = item.audio_url;
					}
					if (audioSrc) {
						const playerWrap = card.createDiv({ cls: 'nlm-studio-audio-player-wrap' });
						const audioEl = playerWrap.createEl('audio', {
							cls: 'nlm-studio-audio-player',
							attr: {
								controls: 'true',
								autoplay: 'true',
								src: audioSrc,
							},
						});
						audioEl.addEventListener(
							'error',
							() => {
								if (item.audio_url && audioEl.src !== item.audio_url) {
									audioEl.src = item.audio_url;
								}
							},
							{ once: true }
						);
						this.activeAudioEl = audioEl;
						this.activeAudioArtifactId = artId;
						reattachedActiveAudio = true;
					}
				}
			}
		}

		if (!reattachedActiveAudio && (this.activeAudioEl || this.playingArtifactId)) {
			this.stopAudioPlayback();
		}
	}

	public renderArtifactsPanel(): void {
		if (!this.artifactsContainerEl) return;
		const i18n = this.i18n;
		this.artifactsContainerEl.empty();

		const allJobs = this.plugin.settings.artifactJobs || [];
		if (allJobs.length === 0) {
			this.artifactsContainerEl.addClass('is-empty');
			return;
		}
		this.artifactsContainerEl.removeClass('is-empty');

		const headerRow = this.artifactsContainerEl.createDiv({
			cls: 'nlm-artifacts-header',
		});
		const pendingCount = allJobs.filter(
			(j) => !j.downloaded && j.status !== 'failed'
		).length;

		headerRow.createSpan({
			text:
				pendingCount > 0
					? `⏳ ${i18n.artifactsActiveTitle(pendingCount)}`
					: `✅ ${i18n.artifactsCompletedTitle(allJobs.length)}`,
			cls: 'nlm-artifacts-title',
		});

		const actionsGroup = headerRow.createDiv({ cls: 'nlm-artifacts-actions' });

		const pollNowBtn = actionsGroup.createEl('button', {
			cls: 'nlm-artifacts-mini-btn',
			text: i18n.btnPollNow,
			attr: { title: i18n.btnPollNowTooltip },
		});
		pollNowBtn.addEventListener('click', () => {
			void this.plugin.tracker.checkPendingJobs();
		});

		const clearDoneBtn = actionsGroup.createEl('button', {
			cls: 'nlm-artifacts-mini-btn',
			text: i18n.btnClearDone,
		});
		clearDoneBtn.addEventListener('click', () => {
			void this.plugin.tracker.clearCompletedJobs();
		});

		const listEl = this.artifactsContainerEl.createDiv({ cls: 'nlm-artifacts-list' });

		for (const job of allJobs.slice(0, 8)) {
			const isRunning = !job.downloaded && job.status !== 'failed';
			const card = listEl.createDiv({
				cls: `nlm-artifact-card is-${job.status} ${isRunning ? 'is-running' : ''}`,
			});

			const topRow = card.createDiv({ cls: 'nlm-artifact-card-top' });
			if (isRunning) {
				const eq = topRow.createDiv({ cls: 'nlm-equalizer' });
				eq.createSpan();
				eq.createSpan();
				eq.createSpan();
			} else {
				topRow.createSpan({
					cls: `nlm-status-dot is-${job.status}`,
				});
			}

			topRow.createSpan({
				text: job.label,
				cls: 'nlm-artifact-label',
				attr: { title: job.focusPrompt || job.label },
			});

			const removeBtn = topRow.createEl('button', {
				cls: 'nlm-artifact-remove-btn',
				text: '×',
				attr: { title: i18n.btnRemoveJobTooltip },
			});
			removeBtn.addEventListener('click', () => {
				void this.plugin.tracker.removeJob(job.id);
			});

			const subRow = card.createDiv({ cls: 'nlm-artifact-card-sub' });
			if (job.downloaded && job.downloadedFilePath) {
				const openLink = subRow.createEl('a', {
					cls: 'nlm-artifact-open-link',
					text: `📂 ${i18n.artifactSavedPrefix} ${job.downloadedFilePath}`,
				});
				openLink.addEventListener('click', (e) => {
					e.preventDefault();
					if (job.downloadedFilePath) {
						void this.app.workspace.openLinkText(
							job.downloadedFilePath,
							'',
							false
						);
					}
				});
			} else if (job.status === 'failed') {
				subRow.createSpan({
					text: job.error || i18n.artifactFailed,
					cls: 'nlm-artifact-error',
				});
			} else {
				subRow.createSpan({
					text: i18n.artifactGeneratingTo(job.targetFolderRel),
					cls: 'nlm-artifact-pending-info',
				});
			}
		}
	}
}
