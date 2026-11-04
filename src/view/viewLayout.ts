import { Notice, setIcon } from 'obsidian';
import { NOTEBOOKLM_ICON_ID } from '../icons/notebooklmLogo';
import { ArtifactType } from '../types';
import { iconForArtifactType, NotebookViewHost } from './notebookState';

export function buildUI(host: NotebookViewHost): void {
	const i18n = host.i18n;
	const container = host.containerEl.children[1] as HTMLElement;
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
	uploadBtn.addEventListener('click', () => host.openDirectUploadModal());

	const newNbBtn = headerActions.createEl('button', {
		cls: 'nlm-icon-btn',
		attr: { 'aria-label': i18n.btnNewNotebookTitle },
	});
	setIcon(newNbBtn, 'plus');
	newNbBtn.addEventListener('click', () => host.openCreateNotebookModal());

	const refreshBtn = headerActions.createEl('button', {
		cls: 'nlm-icon-btn',
		attr: { 'aria-label': i18n.btnRefreshTitle },
	});
	setIcon(refreshBtn, 'refresh-cw');
	refreshBtn.addEventListener('click', () => {
		new Notice(i18n.noticeRefreshing);
		void host
			.loadNotebooksAndSources()
			.then(() => host.plugin.tracker.checkPendingJobs());
	});

	// Notebook Selector Row
	const selectorRow = header.createDiv({ cls: 'nlm-notebook-selector-row' });
	const notebookSelectEl = selectorRow.createEl('select', {
		cls: 'nlm-notebook-select',
	});
	host.dom.notebookSelectEl = notebookSelectEl;
	notebookSelectEl.addEventListener('change', () => {
		void (async () => {
			host.plugin.settings.activeNotebookId = notebookSelectEl.value;
			host.stopAudioPlayback();
			host.renderChatFeed();
			host.renderArtifactsPanel();
			await host.plugin.saveSettings();
			await host.loadSourcesForActiveNotebook();
		})();
	});

	// Onboarding / Health Warning Banner (hidden when healthy)
	host.dom.onboardingBannerEl = container.createDiv({
		cls: 'nlm-onboarding-banner is-hidden',
	});

	// 2. COLLAPSIBLE SOURCES DRAWER
	const sourcesSection = container.createDiv({ cls: 'nlm-sources-section' });
	const sourcesHeader = sourcesSection.createDiv({
		cls: 'nlm-sources-header',
		attr: {
			role: 'button',
			tabindex: '0',
			'aria-expanded': String(host.state.isSourcesExpanded),
		},
	});

	const sourcesHeaderLeft = sourcesHeader.createDiv({
		cls: 'nlm-sources-header-left',
	});
	const chevron = sourcesHeaderLeft.createSpan({ cls: 'nlm-chevron' });
	setIcon(
		chevron,
		host.state.isSourcesExpanded ? 'chevron-down' : 'chevron-right'
	);
	sourcesHeaderLeft.createSpan({
		text: i18n.sourcesTitle,
		cls: 'nlm-sources-title',
	});
	host.dom.sourcesCountBadgeEl = sourcesHeaderLeft.createSpan({
		text: '0',
		cls: 'nlm-badge',
	});

	const sourcesQuickUpload = sourcesHeader.createEl('button', {
		cls: 'nlm-sources-add-btn',
		text: `+ ${i18n.btnUploadLabel}`,
	});
	sourcesQuickUpload.addEventListener('click', (e) => {
		e.stopPropagation();
		host.openDirectUploadModal();
	});

	host.dom.sourcesContainerEl = sourcesSection.createDiv({
		cls: `nlm-sources-list ${
			host.state.isSourcesExpanded ? '' : 'is-collapsed'
		}`,
	});

	const toggleSourcesDrawer = () => {
		host.state.isSourcesExpanded = !host.state.isSourcesExpanded;
		host.dom.sourcesContainerEl?.toggleClass(
			'is-collapsed',
			!host.state.isSourcesExpanded
		);
		sourcesHeader.setAttr(
			'aria-expanded',
			String(host.state.isSourcesExpanded)
		);
		setIcon(
			chevron,
			host.state.isSourcesExpanded ? 'chevron-down' : 'chevron-right'
		);
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
		setIcon(ic, iconForArtifactType(btnInfo.type));
		btn.createSpan({ text: btnInfo.label });
		btn.addEventListener('click', () => host.openArtifactModal(btnInfo.type));
	}

	// 3b. COLLAPSIBLE STUDIO ARTIFACTS BROWSER DRAWER
	const studioDrawerSection = container.createDiv({
		cls: 'nlm-studio-drawer-section',
	});
	const studioDrawerHeaderEl = studioDrawerSection.createDiv({
		cls: 'nlm-studio-drawer-header',
		attr: {
			role: 'button',
			tabindex: '0',
			'aria-expanded': String(host.state.isStudioDrawerExpanded),
		},
	});
	host.dom.studioDrawerHeaderEl = studioDrawerHeaderEl;

	const studioHeaderLeft = studioDrawerHeaderEl.createDiv({
		cls: 'nlm-studio-drawer-header-left',
	});
	const studioDrawerChevronEl = studioHeaderLeft.createSpan({
		cls: 'nlm-chevron',
	});
	host.dom.studioDrawerChevronEl = studioDrawerChevronEl;
	setIcon(
		studioDrawerChevronEl,
		host.state.isStudioDrawerExpanded ? 'chevron-down' : 'chevron-right'
	);
	const studioIcon = studioHeaderLeft.createSpan({
		cls: 'nlm-studio-drawer-icon',
	});
	setIcon(studioIcon, 'sparkles');
	studioHeaderLeft.createSpan({
		text: i18n.studioArtifactsDrawerTitle,
		cls: 'nlm-studio-drawer-title',
	});
	host.dom.studioDrawerBadgeEl = studioHeaderLeft.createSpan({
		text: '0',
		cls: 'nlm-badge',
	});

	const studioRefreshBtn = studioDrawerHeaderEl.createEl('button', {
		cls: 'nlm-studio-drawer-refresh-btn',
		attr: { 'aria-label': i18n.btnRefreshStudioTitle },
	});
	setIcon(studioRefreshBtn, 'refresh-cw');
	studioRefreshBtn.addEventListener('click', (e) => {
		e.stopPropagation();
		new Notice(i18n.noticeRefreshing);
		void host
			.loadStudioArtifactsForActiveNotebook()
			.then(() => host.plugin.tracker.checkPendingJobs());
	});

	host.dom.studioDrawerListEl = studioDrawerSection.createDiv({
		cls: `nlm-studio-drawer-list ${
			host.state.isStudioDrawerExpanded ? '' : 'is-collapsed'
		}`,
	});

	const toggleStudioDrawer = () => {
		host.state.isStudioDrawerExpanded = !host.state.isStudioDrawerExpanded;
		host.dom.studioDrawerListEl?.toggleClass(
			'is-collapsed',
			!host.state.isStudioDrawerExpanded
		);
		studioDrawerHeaderEl.setAttr(
			'aria-expanded',
			String(host.state.isStudioDrawerExpanded)
		);
		setIcon(
			studioDrawerChevronEl,
			host.state.isStudioDrawerExpanded ? 'chevron-down' : 'chevron-right'
		);
		if (host.state.isStudioDrawerExpanded) {
			void host.loadStudioArtifactsForActiveNotebook();
		}
	};
	studioDrawerHeaderEl.addEventListener('click', toggleStudioDrawer);
	studioDrawerHeaderEl.addEventListener('keydown', (e) => {
		if (e.target !== studioDrawerHeaderEl) return;
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			toggleStudioDrawer();
		}
	});

	// 4. ACTIVE / COMPLETED ARTIFACT JOBS PANEL
	host.dom.artifactsContainerEl = container.createDiv({
		cls: 'nlm-artifacts-panel',
	});

	// Status banner for uploads / syncs (with animated shimmer)
	host.dom.statusBannerEl = container.createDiv({
		cls: 'nlm-status-banner is-hidden',
	});

	// 5. CHAT FEED
	host.dom.chatFeedEl = container.createDiv({ cls: 'nlm-chat-feed' });

	// 6. COMPOSER (Context Chips + Input + Send)
	const composer = container.createDiv({ cls: 'nlm-composer' });

	const contextHeader = composer.createDiv({ cls: 'nlm-context-bar' });
	host.dom.contextChipsEl = contextHeader.createDiv({
		cls: 'nlm-context-chips',
	});

	const addContextBtn = contextHeader.createEl('button', {
		cls: 'nlm-add-context-btn',
		text: i18n.btnAddContextFile,
		attr: { 'aria-label': i18n.btnAddContextFileTooltip },
	});
	addContextBtn.addEventListener('click', () => host.openContextFilePicker());

	const inputWrapper = composer.createDiv({ cls: 'nlm-input-wrapper' });
	const promptInputEl = inputWrapper.createEl('textarea', {
		cls: 'nlm-prompt-textarea',
		attr: {
			placeholder: i18n.promptPlaceholder,
			rows: '2',
		},
	});
	host.dom.promptInputEl = promptInputEl;

	promptInputEl.addEventListener('input', () => {
		const val = promptInputEl.value;
		const cursorPos = promptInputEl.selectionStart || 0;
		const charBefore = val.slice(cursorPos - 1, cursorPos);
		const prevChar = cursorPos >= 2 ? val.slice(cursorPos - 2, cursorPos - 1) : ' ';

		if (charBefore === '@' && (prevChar === ' ' || prevChar === '\n')) {
			promptInputEl.value = val.slice(0, cursorPos - 1) + val.slice(cursorPos);
			host.openContextFilePicker();
		}

		promptInputEl.setCssProps({ '--nlm-ta-height': 'auto' });
		const nextHeight = Math.min(120, promptInputEl.scrollHeight);
		promptInputEl.setCssProps({ '--nlm-ta-height': `${nextHeight}px` });
	});

	promptInputEl.addEventListener('keydown', (e) => {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			void host.handleSendPrompt();
		}
	});

	const composerActions = inputWrapper.createDiv({
		cls: 'nlm-composer-actions',
	});

	const clearChatBtn = composerActions.createEl('button', {
		cls: 'nlm-icon-btn nlm-clear-chat-btn',
		attr: { 'aria-label': i18n.btnClearChatTitle },
	});
	setIcon(clearChatBtn, 'trash-2');
	clearChatBtn.addEventListener('click', () => {
		const nbId = host.plugin.settings.activeNotebookId;
		if (nbId && host.plugin.settings.chatHistories[nbId]) {
			host.plugin.settings.chatHistories[nbId] = { messages: [] };
			void host.plugin.saveSettings();
			host.renderChatFeed();
		}
	});

	const sendBtnEl = composerActions.createEl('button', {
		cls: 'nlm-send-btn mod-cta',
		attr: { 'aria-label': i18n.btnSendTooltip },
	});
	host.dom.sendBtnEl = sendBtnEl;
	setIcon(sendBtnEl, 'send');
	sendBtnEl.addEventListener('click', () => {
		void host.handleSendPrompt();
	});

	host.renderContextChips();
}

export function renderOnboardingBanner(host: NotebookViewHost): void {
	const bannerEl = host.dom.onboardingBannerEl;
	if (!bannerEl) return;
	bannerEl.empty();

	const health = host.state.healthStatus;
	if (!health || (health.installed && health.authenticated)) {
		bannerEl.addClass('is-hidden');
		return;
	}

	const i18n = host.i18n;
	bannerEl.removeClass('is-hidden');

	const titleRow = bannerEl.createDiv({ cls: 'nlm-onboarding-title' });
	const warnIcon = titleRow.createSpan({ cls: 'nlm-onboarding-icon' });
	setIcon(warnIcon, 'alert-triangle');
	titleRow.createSpan({
		text: !health.installed
			? i18n.nlmMissingTitle
			: i18n.nlmAuthMissingTitle,
	});

	bannerEl.createDiv({
		cls: 'nlm-onboarding-desc',
		text: !health.installed ? i18n.nlmMissingDesc : i18n.nlmAuthMissingDesc,
	});

	const btnRow = bannerEl.createDiv({ cls: 'nlm-onboarding-actions' });

	const settingsBtn = btnRow.createEl('button', {
		cls: 'nlm-onboarding-btn',
		text: i18n.btnOpenSettings,
	});
	settingsBtn.addEventListener('click', () => {
		host.plugin.openPluginSettings();
	});

	if (health.installed && !health.authenticated) {
		const loginBtn = btnRow.createEl('button', {
			cls: 'nlm-onboarding-btn mod-cta',
			text: i18n.btnRunLogin,
		});
		loginBtn.addEventListener('click', () => {
			let loginFailed = false;
			host.plugin.bridge.launchBrowserLogin((err) => {
				loginFailed = true;
				new Notice(i18n.noticeConnectionError(err.message));
			});
			if (!loginFailed) {
				new Notice(i18n.noticeLoginStarted, 8000);
			}
		});
	}
}

export function setStatusBanner(
	host: NotebookViewHost,
	text: string | null
): void {
	const bannerEl = host.dom.statusBannerEl;
	if (!bannerEl) return;
	if (!text) {
		bannerEl.addClass('is-hidden');
		bannerEl.empty();
	} else {
		bannerEl.removeClass('is-hidden');
		bannerEl.empty();
		bannerEl.createSpan({ cls: 'nlm-status-spinner' });
		bannerEl.createSpan({ text });
	}
}

export function renderNotebookSelect(host: NotebookViewHost): void {
	const selectEl = host.dom.notebookSelectEl;
	if (!selectEl) return;
	selectEl.empty();

	if (host.state.notebooks.length === 0) {
		if (host.plugin.settings.activeNotebookId) {
			host.plugin.settings.activeNotebookId = '';
			void host.plugin.saveSettings();
		}
		selectEl.createEl('option', {
			value: '',
			text: host.i18n.noNotebooksOption,
		});
		return;
	}

	const currentId = host.plugin.settings.activeNotebookId;
	const exists = host.state.notebooks.some((n) => n.id === currentId);
	const firstNotebook = host.state.notebooks[0];
	if (!exists && firstNotebook) {
		host.plugin.settings.activeNotebookId = firstNotebook.id;
		void host.plugin.saveSettings();
	}

	for (const nb of host.state.notebooks) {
		const opt = selectEl.createEl('option', {
			value: nb.id,
			text: `📓 ${nb.title} (${nb.source_count})`,
		});
		if (nb.id === host.plugin.settings.activeNotebookId) {
			opt.selected = true;
		}
	}
}
