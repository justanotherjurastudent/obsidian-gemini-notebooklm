import { Notice } from 'obsidian';
import { CreateNotebookModal } from '../suggest/fileSuggestModal';
import { NotebookViewHost } from './notebookState';

export function openCreateNotebookModal(host: NotebookViewHost): void {
	const i18n = host.i18n;
	const activeFile = host.app.workspace.getActiveFile();
	const defaultTitle = activeFile ? activeFile.basename : '';
	new CreateNotebookModal(
		host.app,
		defaultTitle,
		host.plugin.settings.uiLanguage,
		(title) => {
			void (async () => {
				try {
					host.setStatusBanner(i18n.statusCreatingNotebook(title));
					const res = await host.plugin.bridge.createNotebook(title);
					host.plugin.settings.activeNotebookId = res.notebook_id;
					await host.plugin.saveSettings();
					await host.loadNotebooksAndSources();
					host.renderChatFeed();
					host.renderArtifactsPanel();
					new Notice(i18n.noticeNotebookCreated(title));
				} catch (err: unknown) {
					const msg = err instanceof Error ? err.message : String(err);
					new Notice(i18n.noticeCreateError(msg));
				} finally {
					host.setStatusBanner(null);
				}
			})();
		}
	).open();
}
