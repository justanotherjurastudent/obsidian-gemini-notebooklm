import * as path from 'path';
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
} from '../types';
import {
	ArtifactConfigModal,
	CreateNotebookModal,
	VaultFileSuggestModal,
} from '../suggest/fileSuggestModal';
import { NOTEBOOKLM_ICON_ID } from '../icons/notebooklmLogo';
import { t, TranslationStrings } from '../i18n';

export const VIEW_TYPE_NOTEBOOKLM = 'gemini-notebooklm-sidebar-view';
const MAX_CHAT_MESSAGES = 50;

export class NotebookLMSidebarView extends ItemView {
	private plugin: NotebookLMPlugin;
	private notebooks: NotebookInfo[] = [];
	private sources: SourceInfo[] = [];
	private contextFiles: TFile[] = [];
	private includeActiveNote = true;
	private activeNoteFile: TFile | null = null;
	private isSourcesExpanded = false;
	private isLoadingNotebooks = false;
	private isSendingChat = false;
	private uploadQueue: Promise<unknown> = Promise.resolve();
	private healthStatus: NlmHealthStatus | null = null;

	// DOM references
	private onboardingBannerEl!: HTMLElement;
	private notebookSelectEl!: HTMLSelectElement;
	private sourcesContainerEl!: HTMLElement;
	private sourcesCountBadgeEl!: HTMLElement;
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
		});

		await this.loadNotebooksAndSources();
		this.renderChatFeed();
		this.renderArtifactsPanel();
	}

	async onClose(): Promise<void> {
		if (this.unsubscribeTracker) {
			this.unsubscribeTracker();
			this.unsubscribeTracker = null;
		}
	}

	public rebuildUI(): void {
		this.buildUI();
		this.renderOnboardingBanner();
		this.renderNotebookSelect();
		this.renderSourcesList();
		this.renderChatFeed();
		this.renderArtifactsPanel();
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
				await this.plugin.saveSettings();
				await this.loadSourcesForActiveNotebook();
				this.renderChatFeed();
				this.renderArtifactsPanel();
			})();
		});

		// Onboarding / Health Warning Banner (hidden when healthy)
		this.onboardingBannerEl = container.createDiv({
			cls: 'nlm-onboarding-banner is-hidden',
		});

		// 2. COLLAPSIBLE SOURCES DRAWER
		const sourcesSection = container.createDiv({ cls: 'nlm-sources-section' });
		const sourcesHeader = sourcesSection.createDiv({ cls: 'nlm-sources-header' });

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

		sourcesHeader.addEventListener('click', () => {
			this.isSourcesExpanded = !this.isSourcesExpanded;
			this.sourcesContainerEl.toggleClass('is-collapsed', !this.isSourcesExpanded);
			setIcon(chevron, this.isSourcesExpanded ? 'chevron-down' : 'chevron-right');
		});

		// 3. STUDIO ARTIFACT QUICK-BAR (responsive wrapping grid, no clipping)
		const studioBar = container.createDiv({ cls: 'nlm-studio-bar' });
		const studioGrid = studioBar.createDiv({ cls: 'nlm-studio-grid' });

		const studioButtons: Array<{ type: ArtifactType; icon: string; label: string }> = [
			{ type: 'audio', icon: 'headphones', label: i18n.studioAudio },
			{ type: 'report', icon: 'file-text', label: i18n.studioReport },
			{ type: 'quiz', icon: 'help-circle', label: i18n.studioQuiz },
			{ type: 'flashcards', icon: 'layers', label: i18n.studioFlashcards },
			{ type: 'mind_map', icon: 'git-fork', label: i18n.studioMindmap },
			{ type: 'slide_deck', icon: 'presentation', label: i18n.studioSlides },
			{ type: 'infographic', icon: 'image', label: i18n.studioInfographic },
		];

		for (const btnInfo of studioButtons) {
			const btn = studioGrid.createEl('button', {
				cls: 'nlm-studio-pill',
				attr: { 'aria-label': i18n.studioGenerateTooltip(btnInfo.label) },
			});
			const ic = btn.createSpan({ cls: 'nlm-studio-pill-icon' });
			setIcon(ic, btnInfo.icon);
			btn.createSpan({ text: btnInfo.label });
			btn.addEventListener('click', () => this.openArtifactModal(btnInfo.type));
		}

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
			this.sources = [];
			this.renderSourcesList();
			return;
		}

		try {
			this.sources = await this.plugin.bridge.listSources(nbId);
			if (!this.plugin.settings.uploadedFileMap[nbId]) {
				this.plugin.settings.uploadedFileMap[nbId] = {};
			}
			for (const src of this.sources) {
				this.plugin.settings.uploadedFileMap[nbId][src.title] = src.id;
			}
			await this.plugin.saveSettings();
			this.renderSourcesList();
		} catch (err) {
			console.warn('Failed to load notebook sources:', err);
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
		folderAbs: string;
		noteName: string;
		notePath: string;
	} {
		const adapter = this.app.vault.adapter;
		const basePath =
			adapter instanceof FileSystemAdapter ? adapter.getBasePath() : '';
		const file = this.app.workspace.getActiveFile() || this.activeNoteFile;

		if (file) {
			const folderRel =
				file.parent?.path && file.parent.path !== '/' ? file.parent.path : '';
			const folderAbs = folderRel ? path.join(basePath, folderRel) : basePath;
			return {
				folderRel,
				folderAbs,
				noteName: file.basename,
				notePath: file.path,
			};
		}

		return {
			folderRel: '',
			folderAbs: basePath,
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
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err);
			new Notice(i18n.noticeQueryError(msg));
		} finally {
			this.isSendingChat = false;
			this.sendBtnEl.disabled = false;
			this.setStatusBanner(null);
			this.renderChatFeed();
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
			folderAbs: string;
			noteName: string;
			notePath: string;
		}
	): Promise<void> {
		const i18n = this.i18n;
		const nbId = this.plugin.settings.activeNotebookId;
		if (!nbId) return;

		const nbObj = this.notebooks.find((n) => n.id === nbId);
		const nbTitle = nbObj ? nbObj.title : 'Notebook';

		const adapter = this.app.vault.adapter;
		const basePath =
			adapter instanceof FileSystemAdapter ? adapter.getBasePath() : '';

		const rawChosenRel =
			options.targetFolderRel !== undefined
				? options.targetFolderRel.replace(/^\/+|\/+$/g, '')
				: folderInfo.folderRel;
		const normalizedRel = rawChosenRel ? normalizePath(rawChosenRel) : '';
		const resolvedBase = path.resolve(basePath);
		const candidateAbs = normalizedRel
			? path.resolve(basePath, normalizedRel)
			: resolvedBase;
		const isInsideVault =
			candidateAbs === resolvedBase ||
			candidateAbs.startsWith(`${resolvedBase}${path.sep}`);
		const chosenFolderRel = isInsideVault ? normalizedRel : folderInfo.folderRel;
		const chosenFolderAbs = isInsideVault ? candidateAbs : folderInfo.folderAbs;

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
				targetFolderAbs: chosenFolderAbs,
				sourceNoteName: folderInfo.noteName,
				sourceNotePath: folderInfo.notePath,
				createdAt: Date.now(),
				status: 'queued',
				downloaded: false,
			};

			await this.plugin.tracker.addJob(job);
			new Notice(i18n.noticeArtifactStarted(typeLabel, chosenFolderRel));
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err);
			new Notice(i18n.noticeArtifactStartError(msg));
		} finally {
			this.setStatusBanner(null);
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
