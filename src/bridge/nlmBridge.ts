import { execFile } from 'child_process';
import { promisify } from 'util';
import {
	ArtifactCreateOptions,
	ArtifactType,
	NotebookInfo,
	QueryResult,
	SourceInfo,
	StudioArtifactStatus,
} from '../types';

const execFileAsync = promisify(execFile);

export class NlmBridge {
	private nlmPath: string;

	constructor(nlmPath: string) {
		this.nlmPath = nlmPath;
	}

	public setNlmPath(path: string): void {
		this.nlmPath = path;
	}

	private async runNlm(args: string[], timeoutMs = 180000): Promise<string> {
		try {
			const { stdout } = await execFileAsync(this.nlmPath, args, {
				timeout: timeoutMs,
				maxBuffer: 25 * 1024 * 1024,
				windowsHide: true,
				env: {
					...process.env,
					PYTHONIOENCODING: 'utf-8',
					PYTHONUTF8: '1',
				},
			});
			return stdout.trim();
		} catch (err: unknown) {
			const errorObj = err as { stderr?: string; stdout?: string; message?: string };
			const details = errorObj.stderr || errorObj.stdout || errorObj.message || String(err);
			throw new Error(`NLM CLI Fehler (${args.slice(0, 2).join(' ')}): ${details}`);
		}
	}

	public parseJsonSafe<T>(raw: string): T {
		const trimmed = raw.trim();
		try {
			return JSON.parse(trimmed) as T;
		} catch {
			// Scan line starts for '[' or '{' in case CLI printed log lines like "[INFO] ..." before JSON
			const regex = /(?:^|\n)\s*([[{])/g;
			let match: RegExpExecArray | null;
			while ((match = regex.exec(trimmed)) !== null) {
				const offset = match.index + match[0].indexOf(match[1]!);
				try {
					return JSON.parse(trimmed.slice(offset)) as T;
				} catch {
					// Continue searching next line start
				}
			}
			throw new Error(`Ungültige JSON-Antwort von nlm: ${trimmed.slice(0, 120)}`);
		}
	}

	public async listNotebooks(): Promise<NotebookInfo[]> {
		const out = await this.runNlm(['notebook', 'list', '--json'], 45000);
		if (!out) return [];
		return this.parseJsonSafe<NotebookInfo[]>(out);
	}

	public async createNotebook(title: string): Promise<{ notebook_id: string; title: string; url: string }> {
		const out = await this.runNlm(['notebook', 'create', title, '--json'], 45000);
		return this.parseJsonSafe<{ notebook_id: string; title: string; url: string }>(out);
	}

	public async listSources(notebookId: string): Promise<SourceInfo[]> {
		const out = await this.runNlm(['source', 'list', notebookId, '--json'], 45000);
		if (!out) return [];
		return this.parseJsonSafe<SourceInfo[]>(out);
	}

	public async addFileSource(
		notebookId: string,
		filePathAbs: string,
		wait = true
	): Promise<{ source_id: string; title: string; source_type: string }> {
		const args = ['source', 'add', notebookId, '--file', filePathAbs, '--json'];
		if (wait) {
			args.push('--wait');
		}
		const out = await this.runNlm(args, 300000);
		return this.parseJsonSafe<{ source_id: string; title: string; source_type: string }>(out);
	}

	public async deleteSource(sourceId: string): Promise<void> {
		await this.runNlm(['source', 'delete', sourceId, '--confirm', '--json'], 45000);
	}

	public async queryNotebook(
		notebookId: string,
		question: string,
		options?: { conversationId?: string; sourceIds?: string[] }
	): Promise<QueryResult> {
		const args = ['query', 'notebook', notebookId, question, '--json'];
		if (options?.conversationId) {
			args.push('--conversation-id', options.conversationId);
		}
		if (options?.sourceIds && options.sourceIds.length > 0) {
			args.push('--source-ids', options.sourceIds.join(','));
		}
		const out = await this.runNlm(args, 240000);
		return this.parseJsonSafe<QueryResult>(out);
	}

	public async createArtifact(
		notebookId: string,
		options: ArtifactCreateOptions
	): Promise<{ artifact_id: string; status: string }> {
		const args: string[] = [];
		const focusText = options.focus?.trim();

		switch (options.type) {
			case 'audio':
				args.push('audio', 'create', notebookId);
				args.push('--format', options.audioFormat || 'deep_dive');
				args.push('--length', options.audioLength || 'default');
				if (options.language) args.push('--language', options.language);
				if (focusText) args.push('--focus', focusText);
				break;

			case 'report': {
				args.push('report', 'create', notebookId);
				const chosenFormat = options.reportFormat || 'Study Guide';
				if (focusText) {
					// nlm report create only accepts --prompt with 'Create Your Own'
					args.push('--format', 'Create Your Own');
					const fullPrompt =
						chosenFormat === 'Create Your Own'
							? focusText
							: `Erstelle ein Dokument im Stil "${chosenFormat}". Fokus: ${focusText}`;
					args.push('--prompt', fullPrompt);
				} else {
					args.push('--format', chosenFormat);
				}
				if (options.language) args.push('--language', options.language);
				break;
			}

			case 'quiz':
				args.push('quiz', 'create', notebookId);
				args.push('--count', String(options.quizCount || 5));
				args.push('--difficulty', String(options.quizDifficulty || 3));
				if (focusText) args.push('--focus', focusText);
				break;

			case 'flashcards':
				args.push('flashcards', 'create', notebookId);
				args.push('--difficulty', options.flashcardsDifficulty || 'medium');
				if (focusText) args.push('--focus', focusText);
				break;

			case 'mind_map':
				args.push('mindmap', 'create', notebookId);
				if (options.mindmapTitle || focusText) {
					args.push('--title', options.mindmapTitle || focusText || 'Mind Map');
				}
				break;

			case 'slide_deck':
				args.push('slides', 'create', notebookId);
				break;

			case 'infographic':
				args.push('infographic', 'create', notebookId);
				break;
		}

		if (options.sourceIds && options.sourceIds.length > 0) {
			args.push('--source-ids', options.sourceIds.join(','));
		}

		args.push('--confirm', '--json');

		const out = await this.runNlm(args, 120000);
		return this.parseJsonSafe<{ artifact_id: string; status: string }>(out);
	}

	public async getStudioStatus(notebookId: string): Promise<StudioArtifactStatus[]> {
		const out = await this.runNlm(['studio', 'status', notebookId, '--json'], 45000);
		if (!out) return [];
		return this.parseJsonSafe<StudioArtifactStatus[]>(out);
	}

	public async downloadArtifact(
		notebookId: string,
		artifactId: string,
		type: ArtifactType,
		outputAbsPath: string
	): Promise<void> {
		let subCmd = 'audio';
		const extraArgs: string[] = [];

		switch (type) {
			case 'audio':
				subCmd = 'audio';
				extraArgs.push('--no-progress');
				break;
			case 'report':
				subCmd = 'report';
				break;
			case 'quiz':
				subCmd = 'quiz';
				extraArgs.push('--format', 'markdown');
				break;
			case 'flashcards':
				subCmd = 'flashcards';
				extraArgs.push('--format', 'markdown');
				break;
			case 'mind_map':
				subCmd = 'mind-map';
				break;
			case 'slide_deck':
				subCmd = 'slide-deck';
				break;
			case 'infographic':
				subCmd = 'infographic';
				break;
		}

		const args = [
			'download',
			subCmd,
			notebookId,
			'--id',
			artifactId,
			'--output',
			outputAbsPath,
			...extraArgs,
		];

		await this.runNlm(args, 300000);
	}
}
