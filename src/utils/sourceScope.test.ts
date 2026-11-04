import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { resolveSourceScope } from './sourceScope';

void test('resolveSourceScope queries all enabled sources, not just the context files', () => {
	// Nothing disabled -> CLI default (all sources), context never narrows it
	assert.equal(resolveSourceScope(['a', 'b'], [], []), undefined);
	assert.equal(resolveSourceScope(['a', 'b'], [], ['a']), undefined);

	// One disabled -> all remaining sources stay in scope plus the context ids
	assert.deepEqual(resolveSourceScope(['a', 'b', 'c'], ['c'], []), ['a', 'b']);
	assert.deepEqual(resolveSourceScope(['a', 'b', 'c'], ['c'], ['b']), ['a', 'b']);

	// Disabled context source is not re-added
	assert.deepEqual(resolveSourceScope(['a', 'b', 'c'], ['a'], ['a', 'b']), ['b', 'c']);

	// Everything disabled -> empty scope (caller must block the query)
	assert.deepEqual(resolveSourceScope(['a', 'b'], ['a', 'b'], []), []);

	// Sources not loaded yet -> no restriction
	assert.equal(resolveSourceScope([], ['a'], ['a']), undefined);
});
