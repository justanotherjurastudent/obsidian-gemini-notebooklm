/**
 * Keeps a user-entered folder inside the vault. Obsidian's normalizePath
 * collapses slashes but leaves `..` segments, which would escape the vault root.
 * shortcut: no Unicode/Windows reserved-name checks, add if artifacts ever fail to save
 */
export function sanitizeVaultFolderPath(raw: string): string {
	return (raw || '')
		.replace(/\\/g, '/')
		.split('/')
		.map((segment) => segment.trim())
		.filter((segment) => segment && segment !== '.' && segment !== '..')
		.join('/');
}
