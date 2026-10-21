export interface MindmapNode {
	name?: string;
	title?: string;
	label?: string;
	text?: string;
	children?: MindmapNode[];
	nodes?: MindmapNode[];
}

function getNodeLabel(node: MindmapNode, fallback = 'Topic'): string {
	const raw = node.name || node.title || node.label || node.text || fallback;
	return String(raw).replace(/\s+/g, ' ').trim();
}

function getChildren(node: MindmapNode): MindmapNode[] {
	if (Array.isArray(node.children)) return node.children;
	if (Array.isArray(node.nodes)) return node.nodes;
	return [];
}

function escapeMermaidQuoted(text: string): string {
	return text
		.replace(/"/g, "'")
		.replace(/[\r\n]+/g, ' ')
		.trim();
}

function sanitizeMindmapLine(text: string): string {
	return text
		.replace(/[()[\]{}"'`]/g, '')
		.replace(/[:;#]/g, ' - ')
		.replace(/[\r\n]+/g, ' ')
		.trim();
}

export function convertMindmapJsonToMarkdown(
	rawJson: string,
	defaultTitle = 'Mind Map',
	lang: 'de' | 'en' = 'de'
): string {
	const parsed = JSON.parse(rawJson) as MindmapNode;
	const rootLabel = getNodeLabel(parsed, defaultTitle);

	// 1. Build Mermaid Flowchart (LR) — rock-solid in Obsidian with special chars
	let nodeCounter = 0;
	const flowchartLines: string[] = ['flowchart LR'];

	const walkFlowchart = (node: MindmapNode, depth: number): string => {
		const id = `N${nodeCounter++}`;
		const label = escapeMermaidQuoted(getNodeLabel(node, `Node ${id}`));
		if (depth === 0) {
			flowchartLines.push(`\t${id}(["${label}"])`);
		} else {
			flowchartLines.push(`\t${id}["${label}"]`);
		}
		for (const child of getChildren(node)) {
			const childId = walkFlowchart(child, depth + 1);
			flowchartLines.push(`\t${id} --> ${childId}`);
		}
		return id;
	};
	walkFlowchart(parsed, 0);

	// 2. Build Mermaid Mindmap
	const mindmapLines: string[] = ['mindmap'];
	const walkMindmap = (node: MindmapNode, depth: number): void => {
		const indent = '\t'.repeat(depth + 1);
		const clean = sanitizeMindmapLine(getNodeLabel(node, 'Topic')) || 'Topic';
		if (depth === 0) {
			mindmapLines.push(`${indent}root((${clean}))`);
		} else {
			mindmapLines.push(`${indent}${clean}`);
		}
		for (const child of getChildren(node)) {
			walkMindmap(child, depth + 1);
		}
	};
	walkMindmap(parsed, 0);

	// 3. Build Markdown Outline
	const outlineLines: string[] = [];
	const walkOutline = (node: MindmapNode, depth: number): void => {
		const label = getNodeLabel(node, 'Topic');
		if (depth === 0) {
			outlineLines.push(`- **${label}**`);
		} else {
			outlineLines.push(`${'  '.repeat(depth)}- ${label}`);
		}
		for (const child of getChildren(node)) {
			walkOutline(child, depth + 1);
		}
	};
	walkOutline(parsed, 0);

	const isDe = lang === 'de';
	return [
		`# 🧠 ${rootLabel}`,
		'',
		isDe ? '## Mermaid Diagramm (Flowchart)' : '## Mermaid diagram (flowchart)',
		'',
		'```mermaid',
		...flowchartLines,
		'```',
		'',
		isDe ? '## Mermaid Mindmap' : '## Mermaid mind map',
		'',
		'```mermaid',
		...mindmapLines,
		'```',
		'',
		isDe ? '## Strukturierte Gliederung' : '## Structured outline',
		'',
		...outlineLines,
		'',
		'<details>',
		isDe ? '<summary>Rohdaten (JSON)</summary>' : '<summary>Raw data (JSON)</summary>',
		'',
		'```json',
		JSON.stringify(parsed, null, 2),
		'```',
		'</details>',
		'',
	].join('\n');
}
