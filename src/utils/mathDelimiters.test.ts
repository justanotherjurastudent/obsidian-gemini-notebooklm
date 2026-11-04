import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { normalizeMathDelimiters } from './mathDelimiters';

void test('normalizeMathDelimiters converts LaTeX delimiters to Obsidian math syntax', () => {
	assert.equal(
		normalizeMathDelimiters('Beispiel-Vokabular (\\(V\\)): ["defendant"]'),
		'Beispiel-Vokabular ($V$): ["defendant"]'
	);
	assert.equal(
		normalizeMathDelimiters('\\[ \\mathbf{d} = [6] \\]'),
		'\n$$\n \\mathbf{d} = [6] \n$$\n'
	);
	assert.equal(normalizeMathDelimiters('Wort \\(0\\) fehlt'), 'Wort $0$ fehlt');
	// Doubled backslashes (re-escaped JSON) and already valid math stay intact
	assert.equal(normalizeMathDelimiters('\\\\(x\\\\)'), '$x$');
	assert.equal(normalizeMathDelimiters('Kosten $5'), 'Kosten $5');
	assert.equal(normalizeMathDelimiters('[3-5] Zitat'), '[3-5] Zitat');
});
