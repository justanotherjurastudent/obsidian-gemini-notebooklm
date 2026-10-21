import { addIcon } from 'obsidian';

export const NOTEBOOKLM_ICON_ID = 'notebooklm-logo';

// Official NotebookLM / Gemini inspired concentric audio-arch & sparkle logo (scaled for Obsidian's 100x100 viewBox)
const NOTEBOOKLM_SVG = `<g transform="scale(4.1666)" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
	<path d="M4 19V9a8 8 0 0 1 16 0v10" />
	<path d="M8 19v-7a4 4 0 0 1 8 0v7" />
	<path d="M12 19v-3" />
	<path d="M19 3l.8 2.2L22 6l-2.2.8L19 9l-.8-2.2L16 6l2.2-.8L19 3z" fill="currentColor" stroke="none" />
</g>`;

export function registerNotebookLMIcon(): void {
	addIcon(NOTEBOOKLM_ICON_ID, NOTEBOOKLM_SVG);
}
