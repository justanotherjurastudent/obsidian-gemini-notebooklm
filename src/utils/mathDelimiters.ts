const BLOCK_MATH = '\n$$\n';

/**
 * NotebookLM/Gemini answers wrap LaTeX in `\(...\)` and `\[...\]`, which
 * Obsidian does not render (it only supports `$...$` and `$$...$$`).
 * Doubled backslashes come from the CLI's re-escaped JSON.
 * shortcut: also rewrites text inside code fences and `\\[2mm]` line-break
 * spacing, upgrade (fence-aware pass) if that ever shows up in answers.
 */
export function normalizeMathDelimiters(content: string): string {
	return content
		.replace(/\\{1,2}\[/g, () => BLOCK_MATH)
		.replace(/\\{1,2}\]/g, () => BLOCK_MATH)
		.replace(/\\{1,2}\(/g, () => '$')
		.replace(/\\{1,2}\)/g, () => '$');
}
