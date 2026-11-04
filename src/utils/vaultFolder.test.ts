import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { sanitizeVaultFolderPath } from './vaultFolder';

void test('sanitizeVaultFolderPath keeps artifact folders inside the vault', () => {
	assert.equal(sanitizeVaultFolderPath('Notes/Artifacts'), 'Notes/Artifacts');
	assert.equal(sanitizeVaultFolderPath('/Notes/Artifacts/'), 'Notes/Artifacts');
	assert.equal(sanitizeVaultFolderPath(''), '');

	// `..` segments would escape the vault root - they are dropped, not resolved
	assert.equal(sanitizeVaultFolderPath('../../etc'), 'etc');
	assert.equal(sanitizeVaultFolderPath('..'), '');
	assert.equal(sanitizeVaultFolderPath('Notes/../../outside'), 'Notes/outside');
	assert.equal(sanitizeVaultFolderPath('..\\..\\Windows'), 'Windows');

	// Dot segments and empty segments never reach the adapter
	assert.equal(sanitizeVaultFolderPath('./Notes//./Artifacts'), 'Notes/Artifacts');
});
