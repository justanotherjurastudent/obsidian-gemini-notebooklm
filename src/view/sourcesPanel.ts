import { Notice, setIcon } from 'obsidian';
import { VaultFileSuggestModal } from '../suggest/fileSuggestModal';
import { activeOrLastFile } from './activeNote';
import { NotebookViewHost } from './notebookState';
import {
	disabledSourceIdsFor,
	findSourceForFile,
	toggleSourceEnabled,
} from './sourceLookup';

export function renderSourcesList(host: NotebookViewHost): void {
	const sourcesContainerEl = host.dom.sourcesContainerEl;
	const sourcesCountBadgeEl = host.dom.sourcesCountBadgeEl;
	if (!sourcesContainerEl || !sourcesCountBadgeEl) return;

	const i18n = host.i18n;
	sourcesCountBadgeEl.setText(String(host.state.sources.length));
	sourcesContainerEl.empty();

	const activeFile = activeOrLastFile(host);
	const activeNbId = host.plugin.settings.activeNotebookId;
	if (activeFile) {
		const quickActiveRow = sourcesContainerEl.createDiv({
			cls: 'nlm-source-quick-active',
		});
		const knownSource = activeNbId
			? findSourceForFile(host, activeFile, activeNbId)
			: undefined;
		if (knownSource) {
			quickActiveRow.addClass('is-in-notebook');
			const knownIcon = quickActiveRow.createSpan({
				cls: 'nlm-source-quick-active-icon',
			});
			setIcon(knownIcon, 'check-circle-2');
			quickActiveRow.createSpan({
				text: i18n.sourceActiveNoteInNotebook(activeFile.basename),
			});
		} else {
			const uploadActiveBtn = quickActiveRow.createEl('button', {
				cls: 'nlm-upload-active-note-btn',
			});
			const uploadIcon = uploadActiveBtn.createSpan({
				cls: 'nlm-upload-active-note-icon',
			});
			setIcon(uploadIcon, 'upload');
			uploadActiveBtn.createSpan({
				text: i18n.btnUploadActiveNote(activeFile.basename),
			});
			uploadActiveBtn.addEventListener('click', () => {
				void host.uploadVaultFileToNotebook(activeFile, true);
			});
		}
	}

	if (host.state.sources.length === 0) {
		sourcesContainerEl.createDiv({
			cls: 'nlm-sources-empty',
			text: i18n.sourcesEmpty,
		});
		return;
	}

	const nbId = host.plugin.settings.activeNotebookId;
	if (!nbId) return;
	const disabledIds = disabledSourceIdsFor(host, nbId);

	for (const src of host.state.sources) {
		const isEnabled = !disabledIds.includes(src.id);
		const item = sourcesContainerEl.createDiv({
			cls: `nlm-source-item ${isEnabled ? '' : 'is-disabled'}`,
		});

		const toggleLabel = isEnabled
			? i18n.btnDisableSourceTitle
			: i18n.btnEnableSourceTitle;
		const toggle = item.createEl('input', {
			cls: 'nlm-source-toggle',
			attr: {
				type: 'checkbox',
				'aria-label': toggleLabel,
				title: toggleLabel,
			},
		});
		toggle.checked = isEnabled;
		// Update in place so the row keeps focus while toggling several sources
		toggle.addEventListener('change', () => {
			toggleSourceEnabled(host, nbId, src.id, toggle.checked);
			item.toggleClass('is-disabled', !toggle.checked);
			const label = toggle.checked
				? i18n.btnDisableSourceTitle
				: i18n.btnEnableSourceTitle;
			toggle.setAttr('aria-label', label);
			toggle.setAttr('title', label);
		});

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
					host.setStatusBanner(i18n.statusDeletingSource(src.title));
					await host.plugin.bridge.deleteSource(src.id);
					await host.loadSourcesForActiveNotebook();
					new Notice(i18n.noticeSourceDeleted(src.title));
				} catch (err: unknown) {
					const msg = err instanceof Error ? err.message : String(err);
					new Notice(i18n.noticeDeleteError(msg));
				} finally {
					host.setStatusBanner(null);
				}
			})();
		});
	}
}

export function renderContextChips(host: NotebookViewHost): void {
	const contextChipsEl = host.dom.contextChipsEl;
	if (!contextChipsEl) return;
	const i18n = host.i18n;
	contextChipsEl.empty();

	const activeFile = host.app.workspace.getActiveFile();
	host.state.activeNoteFile = activeFile;

	if (activeFile) {
		const activeChip = contextChipsEl.createDiv({
			cls: `nlm-chip nlm-chip-active-note ${
				host.state.includeActiveNote ? 'is-checked' : 'is-unchecked'
			}`,
			attr: {
				title: host.state.includeActiveNote
					? i18n.chipActiveNoteOn(activeFile.path)
					: i18n.chipActiveNoteOff,
			},
		});
		const ic = activeChip.createSpan({ cls: 'nlm-chip-icon' });
		setIcon(ic, host.state.includeActiveNote ? 'check-square' : 'square');
		activeChip.createSpan({
			text: activeFile.name,
			cls: 'nlm-chip-label',
		});
		activeChip.addEventListener('click', () => {
			host.state.includeActiveNote = !host.state.includeActiveNote;
			host.renderContextChips();
		});
	}

	for (const file of host.state.contextFiles) {
		if (
			activeFile &&
			file.path === activeFile.path &&
			host.state.includeActiveNote
		) {
			continue;
		}
		const chip = contextChipsEl.createDiv({
			cls: 'nlm-chip nlm-chip-extra is-active',
			attr: { title: file.path },
		});
		const ic = chip.createSpan({ cls: 'nlm-chip-icon' });
		setIcon(ic, 'paperclip');
		chip.createSpan({ text: file.name, cls: 'nlm-chip-label' });

		const removeSpan = chip.createSpan({ cls: 'nlm-chip-remove', text: '×' });
		removeSpan.addEventListener('click', (e) => {
			e.stopPropagation();
			host.state.contextFiles = host.state.contextFiles.filter(
				(f) => f.path !== file.path
			);
			host.renderContextChips();
		});
	}
}

export function openContextFilePicker(host: NotebookViewHost): void {
	new VaultFileSuggestModal(
		host.app,
		(file) => {
			if (!host.state.contextFiles.some((f) => f.path === file.path)) {
				host.state.contextFiles.push(file);
				host.renderContextChips();
			}
			host.dom.promptInputEl?.focus();
		},
		host.i18n.modalContextPickerPlaceholder
	).open();
}

export function openDirectUploadModal(host: NotebookViewHost): void {
	const i18n = host.i18n;
	if (!host.plugin.settings.activeNotebookId) {
		new Notice(i18n.noticeSelectNotebookFirst);
		return;
	}
	new VaultFileSuggestModal(
		host.app,
		(file) => {
			void host.uploadVaultFileToNotebook(file, true);
		},
		i18n.modalDirectUploadPlaceholder
	).open();
}
