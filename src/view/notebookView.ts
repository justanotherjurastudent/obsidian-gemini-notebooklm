import * as path from 'path';
import {
	FileSystemAdapter,
	ItemView,
	MarkdownRenderer,
	Notice,
	TFile,
	WorkspaceLeaf,
	setIcon,
} from 'obsidian';
import NotebookLMPlugin from '../main';
import {
	ArtifactCreateOptions,
	ArtifactJob,
	ArtifactType,
	ChatMessage,
	NotebookInfo,
	SourceInfo,
} from '../types';
import {
	ArtifactConfigModal,
	CreateNotebookModal,
	VaultFileSuggestModal,
} from '../suggest/fileSuggestModal';

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

	// DOM references
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

	getViewType(): string {
		return VIEW_TYPE_NOTEBOOKLM;
	}

	getDisplayText(): string {
		return 'NotebookLM Studio';
	}

	getIcon(): string {
		return 'headphones';
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

	private buildUI(): void {
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.addClass('nlm-sidebar-root');

		// 1. TOP HEADER (Brand + Actions)
		const header = container.createDiv({ cls: 'nlm-header' });
		const brandRow = header.createDiv({ cls: 'nlm-brand-row' });

		const titleGroup = brandRow.createDiv({ cls: 'nlm-brand-title-group' });
		const logoIcon = titleGroup.createSpan({ cls: 'nlm-brand-icon' });
		setIcon(logoIcon, 'sparkles');
		titleGroup.createSpan({ text: 'Gemini NotebookLM', cls: 'nlm-brand-title' });

		const headerActions = brandRow.createDiv({ cls: 'nlm-header-actions' });

		const uploadBtn = headerActions.createEl('button', {
			cls: 'nlm-icon-btn nlm-upload-header-btn',
			attr: { 'aria-label': 'Datei direkt ins Notebook hochladen' },
		});
		setIcon(uploadBtn, 'upload');
		uploadBtn.createSpan({ text: 'Upload', cls: 'nlm-btn-text' });
		uploadBtn.addEventListener('click', () => this.openDirectUploadModal());

		const newNbBtn = headerActions.createEl('button', {
			cls: 'nlm-icon-btn',
			attr: { 'aria-label': 'Neues Notebook erstellen' },
		});
		setIcon(newNbBtn, 'plus');
		newNbBtn.addEventListener('click', () => this.openCreateNotebookModal());

		const refreshBtn = headerActions.createEl('button', {
			cls: 'nlm-icon-btn',
			attr: { 'aria-label': 'Notebooks & Status aktualisieren' },
		});
		setIcon(refreshBtn, 'refresh-cw');
		refreshBtn.addEventListener('click', () => {
			new Notice('Aktualisiere NotebookLM...');
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

		// 2. COLLAPSIBLE SOURCES DRAWER
		const sourcesSection = container.createDiv({ cls: 'nlm-sources-section' });
		const sourcesHeader = sourcesSection.createDiv({ cls: 'nlm-sources-header' });

		const sourcesHeaderLeft = sourcesHeader.createDiv({ cls: 'nlm-sources-header-left' });
		const chevron = sourcesHeaderLeft.createSpan({ cls: 'nlm-chevron' });
		setIcon(chevron, 'chevron-right');
		sourcesHeaderLeft.createSpan({ text: 'Notebook-Quellen', cls: 'nlm-sources-title' });
		this.sourcesCountBadgeEl = sourcesHeaderLeft.createSpan({
			text: '0',
			cls: 'nlm-badge',
		});

		const sourcesQuickUpload = sourcesHeader.createEl('button', {
			cls: 'nlm-sources-add-btn',
			text: '+ Datei hochladen',
		});
		sourcesQuickUpload.addEventListener('click', (e) => {
			e.stopPropagation();
			this.openDirectUploadModal();
		});

		this.sourcesContainerEl = sourcesSection.createDiv({
			cls: 'nlm-sources-list is-collapsed',
		});

		sourcesHeader.addEventListener('click', () => {
			this.isSourcesExpanded = !this.isSourcesExpanded;
			this.sourcesContainerEl.toggleClass('is-collapsed', !this.isSourcesExpanded);
			setIcon(chevron, this.isSourcesExpanded ? 'chevron-down' : 'chevron-right');
		});

		// 3. STUDIO ARTIFACT QUICK-BAR
		const studioBar = container.createDiv({ cls: 'nlm-studio-bar' });
		studioBar.createSpan({ text: 'Studio:', cls: 'nlm-studio-label' });

		const studioButtons: Array<{ type: ArtifactType; icon: string; label: string }> = [
			{ type: 'audio', icon: 'headphones', label: 'Audio' },
			{ type: 'report', icon: 'file-text', label: 'Report' },
			{ type: 'quiz', icon: 'help-circle', label: 'Quiz' },
			{ type: 'flashcards', icon: 'layers', label: 'Cards' },
			{ type: 'mind_map', icon: 'git-fork', label: 'Mindmap' },
		];

		for (const btnInfo of studioButtons) {
			const btn = studioBar.createEl('button', {
				cls: 'nlm-studio-pill',
				attr: { 'aria-label': `${btnInfo.label} generieren` },
			});
			const ic = btn.createSpan({ cls: 'nlm-studio-pill-icon' });
			setIcon(ic, btnInfo.icon);
			btn.createSpan({ text: btnInfo.label });
			btn.addEventListener('click', () => this.openArtifactModal(btnInfo.type));
		}

		// 4. ACTIVE / COMPLETED ARTIFACT JOBS PANEL
		this.artifactsContainerEl = container.createDiv({ cls: 'nlm-artifacts-panel' });

		// Status banner for uploads / syncs
		this.statusBannerEl = container.createDiv({ cls: 'nlm-status-banner is-hidden' });

		// 5. CHAT FEED
		this.chatFeedEl = container.createDiv({ cls: 'nlm-chat-feed' });

		// 6. COMPOSER (Context Chips + Input + Send)
		const composer = container.createDiv({ cls: 'nlm-composer' });

		const contextHeader = composer.createDiv({ cls: 'nlm-context-bar' });
		this.contextChipsEl = contextHeader.createDiv({ cls: 'nlm-context-chips' });

		const addContextBtn = contextHeader.createEl('button', {
			cls: 'nlm-add-context-btn',
			text: '@ Datei',
			attr: { 'aria-label': 'Weitere Datei per @ zum Kontext hinzufügen' },
		});
		addContextBtn.addEventListener('click', () => this.openContextFilePicker());

		const inputWrapper = composer.createDiv({ cls: 'nlm-input-wrapper' });
		this.promptInputEl = inputWrapper.createEl('textarea', {
			cls: 'nlm-prompt-textarea',
			attr: {
				placeholder:
					'Frage ans Notebook stellen... (Tippe @ zum Hinzufügen von Dateien)',
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
			attr: { 'aria-label': 'Chat-Verlauf leeren' },
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
			attr: { 'aria-label': 'Frage senden (Enter)' },
		});
		setIcon(this.sendBtnEl, 'send');
		this.sendBtnEl.addEventListener('click', () => {
			void this.handleSendPrompt();
		});

		this.renderContextChips();
	}

	private setStatusBanner(text: string | null): void {
		if (!this.statusBannerEl) return;
		if (!text) {
			this.statusBannerEl.addClass('is-hidden');
			this.statusBannerEl.empty();
		} else {
			this.statusBannerEl.removeClass('is-hidden');
			this.statusBannerEl.setText(text);
		}
	}

	public async loadNotebooksAndSources(): Promise<void> {
		if (this.isLoadingNotebooks) return;
		this.isLoadingNotebooks = true;
		try {
			this.notebooks = await this.plugin.bridge.listNotebooks();
			this.renderNotebookSelect();
			if (this.plugin.settings.activeNotebookId) {
				await this.loadSourcesForActiveNotebook();
			}
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err);
			new Notice(`NotebookLM Verbindungsfehler: ${msg}`);
		} finally {
			this.isLoadingNotebooks = false;
		}
	}

	private renderNotebookSelect(): void {
		if (!this.notebookSelectEl) return;
		this.notebookSelectEl.empty();

		if (this.notebooks.length === 0) {
			this.notebookSelectEl.createEl('option', {
				value: '',
				text: 'Keine Notebooks gefunden — Bitte + klicken',
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
			console.warn('Quellen konnten nicht geladen werden:', err);
		}
	}

	private renderSourcesList(): void {
		if (!this.sourcesContainerEl || !this.sourcesCountBadgeEl) return;
		this.sourcesCountBadgeEl.setText(String(this.sources.length));
		this.sourcesContainerEl.empty();

		const activeFile = this.app.workspace.getActiveFile();
		if (activeFile) {
			const quickActiveRow = this.sourcesContainerEl.createDiv({
				cls: 'nlm-source-quick-active',
			});
			const uploadActiveBtn = quickActiveRow.createEl('button', {
				cls: 'nlm-upload-active-note-btn',
				text: `📄 Aktive Notiz („${activeFile.basename}“) jetzt hochladen`,
			});
			uploadActiveBtn.addEventListener('click', () => {
				void this.uploadVaultFileToNotebook(activeFile, true);
			});
		}

		if (this.sources.length === 0) {
			this.sourcesContainerEl.createDiv({
				cls: 'nlm-sources-empty',
				text: 'Noch keine Quellen in diesem Notebook.',
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
				attr: { 'aria-label': 'Quelle aus Notebook entfernen' },
			});
			setIcon(delBtn, 'x');
			delBtn.addEventListener('click', () => {
				void (async () => {
					try {
						this.setStatusBanner(`Entferne Quelle „${src.title}“...`);
						await this.plugin.bridge.deleteSource(src.id);
						await this.loadSourcesForActiveNotebook();
						new Notice(`Quelle entfernt: ${src.title}`);
					} catch (err: unknown) {
						const msg = err instanceof Error ? err.message : String(err);
						new Notice(`Fehler beim Löschen: ${msg}`);
					} finally {
						this.setStatusBanner(null);
					}
				})();
			});
		}
	}

	private renderContextChips(): void {
		if (!this.contextChipsEl) return;
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
						? `Aktive Notiz im Kontext (${activeFile.path}) – Klicken zum Deaktivieren`
						: `Aktive Notiz ignoriert – Klicken zum Aktivieren`,
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
			'@-Datei zum Kontext hinzufügen (Markdown, PDF, etc.)...'
		).open();
	}

	private openDirectUploadModal(): void {
		if (!this.plugin.settings.activeNotebookId) {
			new Notice('Bitte wähle zuerst ein Notebook aus oder erstelle eines.');
			return;
		}
		new VaultFileSuggestModal(
			this.app,
			(file) => {
				void this.uploadVaultFileToNotebook(file, true);
			},
			'📤 Datei auswählen, um sie direkt ins Notebook hochzuladen...'
		).open();
	}

	private openCreateNotebookModal(): void {
		const activeFile = this.app.workspace.getActiveFile();
		const defaultTitle = activeFile ? activeFile.basename : '';
		new CreateNotebookModal(this.app, defaultTitle, (title) => {
			void (async () => {
				try {
					this.setStatusBanner(`Erstelle Notebook „${title}“...`);
					const res = await this.plugin.bridge.createNotebook(title);
					this.plugin.settings.activeNotebookId = res.notebook_id;
					await this.plugin.saveSettings();
					await this.loadNotebooksAndSources();
					this.renderChatFeed();
					this.renderArtifactsPanel();
					new Notice(`✅ Notebook erstellt: ${title}`);
				} catch (err: unknown) {
					const msg = err instanceof Error ? err.message : String(err);
					new Notice(`Fehler beim Erstellen: ${msg}`);
				} finally {
					this.setStatusBanner(null);
				}
			})();
		}).open();
	}

	private getAbsolutePathForVaultFile(file: TFile): string {
		const adapter = this.app.vault.adapter;
		if (adapter instanceof FileSystemAdapter) {
			return adapter.getFullPath(file.path);
		}
		throw new Error('Dateisystem-Adapter nicht verfügbar.');
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
		const nbId = this.plugin.settings.activeNotebookId;
		if (!nbId) {
			new Notice('Kein aktives Notebook ausgewählt.');
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
			// If note was modified locally or forceUpload is requested, replace old source to avoid duplicates
			if (foundInSources && (isNoteModified || forceUpload)) {
				this.setStatusBanner(`🔄 Aktualisiere „${file.name}“ in NotebookLM...`);
				try {
					await this.plugin.bridge.deleteSource(foundInSources.id);
				} catch {
					// Ignore if already deleted remotely
				}
			} else {
				this.setStatusBanner(`📤 Lade „${file.name}“ zu NotebookLM hoch...`);
			}

			const absPath = this.getAbsolutePathForVaultFile(file);
			const res = await this.plugin.bridge.addFileSource(nbId, absPath, true);
			map[file.path] = res.source_id;
			map[file.name] = res.source_id;
			mtimes[file.path] = file.stat.mtime;
			await this.plugin.saveSettings();
			await this.loadSourcesForActiveNotebook();
			new Notice(`✅ Quelle in NotebookLM hinterlegt: ${file.name}`);
			return res.source_id;
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err);
			new Notice(`❌ Upload fehlgeschlagen (${file.name}): ${msg}`);
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
				// Skip empty 0-byte notes so queries against existing notebook sources still work
				continue;
			}
			const srcId = await this.uploadVaultFileToNotebook(file, false);
			if (!srcId) {
				throw new Error(`Kontext-Datei „${file.name}“ konnte nicht synchronisiert werden.`);
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

		const nbId = this.plugin.settings.activeNotebookId;
		if (!nbId) {
			new Notice('Bitte wähle zuerst oben ein Notebook aus.');
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

			this.setStatusBanner('🤔 NotebookLM analysiert deine Quellen...');

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
				content: result.answer || '(Keine Antwort erhalten)',
				timestamp: Date.now(),
				references: result.references || [],
			};
			history.messages.push(assistantMsg);
			if (history.messages.length > MAX_CHAT_MESSAGES) {
				history.messages = history.messages.slice(-MAX_CHAT_MESSAGES);
			}
			await this.plugin.saveSettings();
			this.renderChatFeed();
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err);
			new Notice(`Fehler bei der Anfrage: ${msg}`);
		} finally {
			this.isSendingChat = false;
			this.sendBtnEl.disabled = false;
			this.setStatusBanner(null);
		}
	}

	private renderChatFeed(): void {
		if (!this.chatFeedEl) return;
		this.chatFeedEl.empty();

		const nbId = this.plugin.settings.activeNotebookId;
		const history = nbId ? this.plugin.settings.chatHistories[nbId] : undefined;
		const messages = history?.messages || [];

		if (messages.length === 0) {
			const emptyState = this.chatFeedEl.createDiv({ cls: 'nlm-chat-empty' });
			const emptyIcon = emptyState.createDiv({ cls: 'nlm-chat-empty-icon' });
			setIcon(emptyIcon, 'message-square-plus');
			emptyState.createEl('h4', { text: 'Bereit für deine Fragen & Artefakte' });
			emptyState.createEl('p', {
				text: 'Die aktive Notiz wird automatisch einbezogen. Tippe @ im Eingabefeld, um weitere Dateien (z. B. Vorlesungs-PDFs) hinzuzufügen, oder starte oben ein Audio-Overview.',
			});
			return;
		}

		for (const msg of messages) {
			const bubble = this.chatFeedEl.createDiv({
				cls: `nlm-chat-bubble nlm-chat-${msg.role}`,
			});

			const metaRow = bubble.createDiv({ cls: 'nlm-chat-meta' });
			metaRow.createSpan({
				text: msg.role === 'user' ? 'Du' : '✨ NotebookLM',
				cls: 'nlm-chat-author',
			});

			if (msg.contextFiles && msg.contextFiles.length > 0) {
				metaRow.createSpan({
					cls: 'nlm-chat-ctx-badge',
					text: `📎 ${msg.contextFiles.length} Quelle(n)`,
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
					text: `📚 ${msg.references.length} Quellenbeleg(e) anzeigen`,
				});
				const refsList = refsDetails.createDiv({ cls: 'nlm-chat-refs-list' });
				for (const ref of msg.references) {
					const srcObj = this.sources.find((s) => s.id === ref.source_id);
					const srcTitle = srcObj ? srcObj.title : 'Quelle';
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
					text: 'Kopieren',
				});
				copyBtn.addEventListener('click', () => {
					void navigator.clipboard.writeText(msg.content);
					new Notice('Antwort in die Zwischenablage kopiert.');
				});

				const insertBtn = actionsRow.createEl('button', {
					cls: 'nlm-msg-action-btn',
					text: 'In Notiz einfügen',
				});
				insertBtn.addEventListener('click', () => {
					void (async () => {
						const activeFile = this.app.workspace.getActiveFile();
						if (!activeFile) {
							new Notice('Keine aktive Notiz geöffnet.');
							return;
						}
						await this.app.vault.append(activeFile, `\n\n${msg.content}\n`);
						new Notice(`In „${activeFile.name}“ eingefügt.`);
					})();
				});
			}
		}

		this.chatFeedEl.scrollTop = this.chatFeedEl.scrollHeight;
	}

	private openArtifactModal(initialType: ArtifactType): void {
		const nbId = this.plugin.settings.activeNotebookId;
		if (!nbId) {
			new Notice('Bitte wähle zuerst oben ein Notebook aus.');
			return;
		}

		const folderInfo = this.getActiveNoteFolderInfo();
		new ArtifactConfigModal(
			this.app,
			initialType,
			this.plugin.settings.defaultLanguage,
			folderInfo.folderRel,
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
		const nbId = this.plugin.settings.activeNotebookId;
		if (!nbId) return;

		const nbObj = this.notebooks.find((n) => n.id === nbId);
		const nbTitle = nbObj ? nbObj.title : 'Notebook';

		try {
			const { sourceIds } = await this.ensureContextFilesUploaded();
			if (sourceIds.length > 0) {
				options.sourceIds = sourceIds;
			}

			const typeLabel = this.plugin.tracker.getTypeLabel(options.type);
			this.setStatusBanner(`🚀 Starte ${typeLabel}-Generierung in NotebookLM...`);

			const res = await this.plugin.bridge.createArtifact(nbId, options);

			const job: ArtifactJob = {
				id: res.artifact_id,
				notebookId: nbId,
				notebookTitle: nbTitle,
				type: options.type,
				label: `${typeLabel} (${folderInfo.noteName})`,
				focusPrompt: options.focus,
				targetFolderRel: folderInfo.folderRel,
				targetFolderAbs: folderInfo.folderAbs,
				sourceNoteName: folderInfo.noteName,
				sourceNotePath: folderInfo.notePath,
				createdAt: Date.now(),
				status: 'queued',
				downloaded: false,
			};

			await this.plugin.tracker.addJob(job);
			new Notice(
				`✨ ${typeLabel} wurde gestartet!\nSobald es fertig ist, wird es automatisch in „${
					folderInfo.folderRel || '/'
				}“ heruntergeladen.`
			);
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err);
			new Notice(`❌ Fehler beim Starten des Artefakts: ${msg}`);
		} finally {
			this.setStatusBanner(null);
		}
	}

	public renderArtifactsPanel(): void {
		if (!this.artifactsContainerEl) return;
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
					? `⏳ Artefakte (${pendingCount} aktiv)`
					: `✅ Artefakt-Downloads (${allJobs.length})`,
			cls: 'nlm-artifacts-title',
		});

		const actionsGroup = headerRow.createDiv({ cls: 'nlm-artifacts-actions' });

		const pollNowBtn = actionsGroup.createEl('button', {
			cls: 'nlm-artifacts-mini-btn',
			text: 'Prüfen',
			attr: { title: 'Status jetzt sofort abfragen' },
		});
		pollNowBtn.addEventListener('click', () => {
			void this.plugin.tracker.checkPendingJobs();
		});

		const clearDoneBtn = actionsGroup.createEl('button', {
			cls: 'nlm-artifacts-mini-btn',
			text: 'Erledigte ausblenden',
		});
		clearDoneBtn.addEventListener('click', () => {
			void this.plugin.tracker.clearCompletedJobs();
		});

		const listEl = this.artifactsContainerEl.createDiv({ cls: 'nlm-artifacts-list' });

		for (const job of allJobs.slice(0, 8)) {
			const card = listEl.createDiv({
				cls: `nlm-artifact-card is-${job.status}`,
			});

			const topRow = card.createDiv({ cls: 'nlm-artifact-card-top' });
			topRow.createSpan({
				cls: `nlm-status-dot is-${job.status}`,
			});

			topRow.createSpan({
				text: job.label,
				cls: 'nlm-artifact-label',
				attr: { title: job.focusPrompt || job.label },
			});

			const removeBtn = topRow.createEl('button', {
				cls: 'nlm-artifact-remove-btn',
				text: '×',
				attr: { title: 'Eintrag entfernen' },
			});
			removeBtn.addEventListener('click', () => {
				void this.plugin.tracker.removeJob(job.id);
			});

			const subRow = card.createDiv({ cls: 'nlm-artifact-card-sub' });
			if (job.downloaded && job.downloadedFilePath) {
				const openLink = subRow.createEl('a', {
					cls: 'nlm-artifact-open-link',
					text: `📂 Gespeichert: ${job.downloadedFilePath}`,
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
					text: job.error || 'Fehlgeschlagen',
					cls: 'nlm-artifact-error',
				});
			} else {
				subRow.createSpan({
					text: `Wird generiert → Ziel: ${job.targetFolderRel || '/'}`,
					cls: 'nlm-artifact-pending-info',
				});
			}
		}
	}
}
