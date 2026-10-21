import { execFile, spawn } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
	ArtifactCreateOptions,
	ArtifactType,
	NlmHealthStatus,
	NotebookInfo,
	QueryResult,
	SourceInfo,
	StudioArtifactStatus,
} from '../types';

interface ExecFileResult {
	stdout: string;
	stderr: string;
}

function runExecFile(
	file: string,
	args: string[],
	options: {
		timeout?: number;
		maxBuffer?: number;
		windowsHide?: boolean;
		env?: NodeJS.ProcessEnv;
	}
): Promise<ExecFileResult> {
	return new Promise((resolve, reject) => {
		execFile(file, args, options, (error, stdout, stderr) => {
			if (error) {
				const details =
					(typeof stderr === 'string' && stderr.trim()) ||
					(typeof stdout === 'string' && stdout.trim()) ||
					error.message;
				const wrappedError = new Error(details);
				reject(wrappedError);
			} else {
				resolve({
					stdout: typeof stdout === 'string' ? stdout : '',
					stderr: typeof stderr === 'string' ? stderr : '',
				});
			}
		});
	});
}

export class NlmBridge {
	private customPath: string;
	private cachedDetectedPath: string | null = null;

	constructor(customPath: string) {
		this.customPath = customPath.trim();
	}

	public setNlmPath(newPath: string): void {
		this.customPath = newPath.trim();
	}

	public detectNlmPath(): string | null {
		const isWin: boolean = typeof process !== 'undefined' && process.platform === 'win32';
		const home: string = typeof os.homedir === 'function' ? os.homedir() : '';
		const binNames: string[] = isWin ? ['nlm.exe', 'nlm'] : ['nlm'];

		const candidateDirs: string[] = [
			path.join(home, '.local', 'bin'),
			isWin
				? path.join(home, 'AppData', 'Roaming', 'uv', 'tools', 'notebooklm-mcp-cli', 'Scripts')
				: path.join(home, '.local', 'share', 'uv', 'tools', 'notebooklm-mcp-cli', 'bin'),
			isWin
				? path.join(home, 'pipx', 'venvs', 'notebooklm-mcp-cli', 'Scripts')
				: path.join(home, '.local', 'pipx', 'venvs', 'notebooklm-mcp-cli', 'bin'),
			'/opt/homebrew/bin',
			'/usr/local/bin',
		];

		// Also scan PATH directories
		const envObj = typeof process !== 'undefined' ? process.env : {};
		const pathEnv = envObj['PATH'] || envObj['Path'] || '';
		const pathDelimiter = path.delimiter || (isWin ? ';' : ':');
		const pathDirs: string[] = pathEnv.split(pathDelimiter).filter(Boolean);
		for (const d of pathDirs) {
			if (!candidateDirs.includes(d)) {
				candidateDirs.push(d);
			}
		}

		for (const dir of candidateDirs) {
			for (const bin of binNames) {
				const full: string = path.join(dir, bin);
				if (fs.existsSync(full)) {
					this.cachedDetectedPath = full;
					return full;
				}
			}
		}

		return null;
	}

	public getEffectivePath(): string {
		if (this.customPath) {
			return this.customPath;
		}
		if (this.cachedDetectedPath && fs.existsSync(this.cachedDetectedPath)) {
			return this.cachedDetectedPath;
		}
		return this.detectNlmPath() || (process.platform === 'win32' ? 'nlm.exe' : 'nlm');
	}

	public async checkHealth(): Promise<NlmHealthStatus> {
		const exe = this.getEffectivePath();
		try {
			const out = await this.runNlm(['doctor'], 20000);
			const versionMatch = /notebooklm-mcp-cli:\s*([^\r\n]+)/i.exec(out);
			const accountMatch = /Account:\s*([^\r\n]+)/i.exec(out);
			const cookiesMatch = /Cookies:\s*present/i.exec(out);

			const version = versionMatch?.[1]?.trim() || 'installed';
			const account = accountMatch?.[1]?.trim() || '';
			const authenticated = Boolean(cookiesMatch || (account && account !== 'none'));

			return {
				installed: true,
				authenticated,
				version,
				account: account || 'Google Account',
				resolvedPath: exe,
			};
		} catch {
			return {
				installed: false,
				authenticated: false,
				version: '',
				account: '',
				resolvedPath: exe,
			};
		}
	}

	public launchBrowserLogin(onError?: (err: Error) => void): void {
		const exe = this.getEffectivePath();
		const child = spawn(exe, ['login'], {
			detached: true,
			stdio: 'ignore',
			windowsHide: false,
		});
		child.on('error', (err) => {
			console.error('Failed to launch nlm login:', err);
			onError?.(err);
		});
		child.unref();
	}

	private async runNlm(args: string[], timeoutMs = 180000): Promise<string> {
		const exe = this.getEffectivePath();
		try {
			const { stdout } = await runExecFile(exe, args, {
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
			throw new Error(`NLM CLI (${args.slice(0, 2).join(' ')}): ${details}`);
		}
	}

	public parseJsonSafe<T>(raw: string): T {
		const trimmed = raw.trim();
		try {
			return JSON.parse(trimmed) as T;
		} catch {
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
			throw new Error(`Invalid JSON from nlm: ${trimmed.slice(0, 120)}`);
		}
	}

	public async listNotebooks(): Promise<NotebookInfo[]> {
		const out = await this.runNlm(['notebook', 'list', '--json'], 45000);
		if (!out) return [];
		return this.parseJsonSafe<NotebookInfo[]>(out);
	}

	public async createNotebook(
		title: string
	): Promise<{ notebook_id: string; title: string; url: string }> {
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
					args.push('--format', 'Create Your Own');
					const fullPrompt =
						chosenFormat === 'Create Your Own'
							? focusText
							: `Create a document in the style "${chosenFormat}". Focus: ${focusText}`;
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
				if (options.language) args.push('--language', options.language);
				if (focusText) args.push('--focus', focusText);
				break;

			case 'infographic':
				args.push('infographic', 'create', notebookId);
				if (options.language) args.push('--language', options.language);
				if (focusText) args.push('--focus', focusText);
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
				extraArgs.push('--no-progress');
				break;
			case 'infographic':
				subCmd = 'infographic';
				extraArgs.push('--no-progress');
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
