import { MarkdownRenderer, Notice, setIcon, TFile } from 'obsidian';
import { NOTEBOOKLM_ICON_ID } from '../icons/notebooklmLogo';
import { ChatMessage } from '../types';
import { normalizeMathDelimiters } from '../utils/mathDelimiters';
import { activeOrLastFile } from './activeNote';
import { NotebookViewHost } from './notebookState';
import { findSourceForFile, resolveQueryScope } from './sourceLookup';

const MAX_CHAT_MESSAGES = 50;

/** Context files that still have to be uploaded before sending. */
export function pendingContextUploads(host: NotebookViewHost): string[] {
	const nbId = host.plugin.settings.activeNotebookId;
	if (!nbId) return [];
	const files: TFile[] = [];
	const activeFile = activeOrLastFile(host);
	if (host.state.includeActiveNote && activeFile) files.push(activeFile);
	for (const f of host.state.contextFiles) {
		if (!files.some((existing) => existing.path === f.path)) files.push(f);
	}
	const mtimes = host.plugin.settings.uploadedFileMtimes[nbId] ?? {};
	return files
		.filter((file) => file.stat.size > 0)
		.filter((file) => {
			if (!findSourceForFile(host, file, nbId)) return true;
			const lastUploaded = mtimes[file.path] ?? 0;
			// Notes get re-uploaded when they changed since the last sync
			return (
				(file.extension === 'md' || file.extension === 'txt') &&
				lastUploaded > 0 &&
				file.stat.mtime > lastUploaded
			);
		})
		.map((file) => file.name);
}

export async function handleSendPrompt(host: NotebookViewHost): Promise<void> {
	const promptInputEl = host.dom.promptInputEl;
	const sendBtnEl = host.dom.sendBtnEl;
	if (!promptInputEl || !sendBtnEl) return;

	const state = host.state;
	if (state.isSendingChat) return;
	const question = promptInputEl.value.trim();
	if (!question) return;

	const i18n = host.i18n;
	const nbId = host.plugin.settings.activeNotebookId;
	if (!nbId) {
		new Notice(i18n.noticeSelectNotebookFirst);
		return;
	}

	state.isSendingChat = true;
	promptInputEl.value = '';
	promptInputEl.setCssProps({ '--nlm-ta-height': 'auto' });
	sendBtnEl.disabled = true;

	try {
		if (!host.plugin.settings.chatHistories[nbId]) {
			host.plugin.settings.chatHistories[nbId] = { messages: [] };
		}
		const history = host.plugin.settings.chatHistories[nbId];

		// Show the question right away - the vault upload can take a while
		const uploads = pendingContextUploads(host);
		const userMsg: ChatMessage = {
			id: `user-${Date.now()}`,
			role: 'user',
			content: question,
			timestamp: Date.now(),
			contextFiles: uploads,
		};
		history.messages.push(userMsg);
		if (history.messages.length > MAX_CHAT_MESSAGES) {
			history.messages = history.messages.slice(-MAX_CHAT_MESSAGES);
		}
		await host.plugin.saveSettings();
		host.renderChatFeed();

		host.setStatusBanner(
			uploads.length > 0
				? i18n.statusUploadingBeforeSend(uploads.join(', '))
				: i18n.statusQueryingNotebook
		);

		const { sourceIds, fileNames } = await host.ensureContextFilesUploaded();
		const scope = resolveQueryScope(host, sourceIds);
		// An empty scope must never reach the CLI - it would drop --source-ids
		// and query every source instead.
		if (scope?.length === 0) {
			promptInputEl.value = question;
			new Notice(i18n.sourcesAllDisabled);
			return;
		}

		userMsg.contextFiles = fileNames;
		host.setStatusBanner(i18n.statusQueryingNotebook);

		const queryStartedAt = Date.now();
		const hadPreStudioSnapshot = state.studioArtifactsLoaded;
		const preStudioIds = new Set(
			state.studioArtifacts.map((a) => a.artifact_id || a.id)
		);

		// A conversation keeps its first source scope, so drop it when the
		// source selection changed - otherwise old answers and exclusions stick.
		const scopeKey = scope ? [...scope].sort().join(',') : '*';
		if (history.scopeKey !== scopeKey) {
			// Also resets conversations stored before scope tracking existed,
			// because their source scope is unknown.
			history.conversationId = undefined;
			history.scopeKey = scopeKey;
		}

		const result = await host.plugin.bridge.queryNotebook(nbId, question, {
			conversationId: history.conversationId,
			sourceIds: scope,
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
		await host.plugin.saveSettings();

		state.isSendingChat = false;
		sendBtnEl.disabled = false;
		host.setStatusBanner(null);
		host.renderChatFeed();

		// Wait ~3 seconds before checking studio status so Gemini NotebookLM has time
		// to spawn any server-side Studio artifact triggered by the chat response.
		if (state.postChatStudioCheckTimer !== null) {
			window.clearTimeout(state.postChatStudioCheckTimer);
		}
		state.postChatStudioCheckTimer = window.setTimeout(() => {
			state.postChatStudioCheckTimer = null;
			if (!state.isViewOpen) return;
			void host.detectAndTrackChatArtifacts(
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
		if (state.isSendingChat) {
			state.isSendingChat = false;
			sendBtnEl.disabled = false;
			host.setStatusBanner(null);
			host.renderChatFeed();
		}
	}
}

export function renderChatFeed(host: NotebookViewHost): void {
	const chatFeedEl = host.dom.chatFeedEl;
	if (!chatFeedEl) return;
	const i18n = host.i18n;
	chatFeedEl.empty();

	const nbId = host.plugin.settings.activeNotebookId;
	const history = nbId ? host.plugin.settings.chatHistories[nbId] : undefined;
	const messages = history?.messages || [];

	if (messages.length === 0 && !host.state.isSendingChat) {
		const emptyState = chatFeedEl.createDiv({ cls: 'nlm-chat-empty' });
		const emptyIcon = emptyState.createDiv({ cls: 'nlm-chat-empty-icon' });
		setIcon(emptyIcon, NOTEBOOKLM_ICON_ID);
		emptyState.createEl('h4', { text: i18n.chatEmptyTitle });
		emptyState.createEl('p', {
			text: i18n.chatEmptyDesc,
		});
		return;
	}

	for (const msg of messages) {
		// NotebookLM emits \(..\)/\[..\]; Obsidian only renders $..$/$$..$$
		const rendered = normalizeMathDelimiters(msg.content);
		const bubble = chatFeedEl.createDiv({
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
		void MarkdownRenderer.render(
			host.app,
			rendered,
			contentDiv,
			'',
			host.component
		);

		if (msg.references && msg.references.length > 0) {
			const refsDetails = bubble.createEl('details', {
				cls: 'nlm-chat-refs',
			});
			refsDetails.createEl('summary', {
				text: i18n.chatRefsSummary(msg.references.length),
			});
			const refsList = refsDetails.createDiv({ cls: 'nlm-chat-refs-list' });
			for (const ref of msg.references) {
				const srcObj = host.state.sources.find(
					(s) => s.id === ref.source_id
				);
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
				void navigator.clipboard.writeText(rendered);
				new Notice(i18n.noticeCopied);
			});

			const insertBtn = actionsRow.createEl('button', {
				cls: 'nlm-msg-action-btn',
				text: i18n.btnInsertIntoNote,
			});
			insertBtn.addEventListener('click', () => {
				void (async () => {
					const activeFile = host.app.workspace.getActiveFile();
					if (!activeFile) {
						new Notice(i18n.noticeNoActiveFile);
						return;
					}
					await host.app.vault.append(activeFile, `\n\n${rendered}\n`);
					new Notice(i18n.noticeInsertedIntoNote(activeFile.name));
				})();
			});
		}
	}

	if (host.state.isSendingChat) {
		const thinkingBubble = chatFeedEl.createDiv({
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

	chatFeedEl.scrollTop = chatFeedEl.scrollHeight;
}
