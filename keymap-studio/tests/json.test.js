'use strict';
// VERIFY-2: lossless strict JSON. Escape and position oracles were generated with Python json (ensure_ascii).
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const KS = require('./load-core.js');
const { KNOWN_UID } = require('./helpers.js');

const { parse, stringify, int, JsonError } = KS.json;
const isJsonError = (e) => e instanceof JsonError;

describe('VERIFY-2 lossless JSON: round trip', () => {
  it('re-emits a Python-style document byte-for-byte', () => {
    const text = '[1, {"a": [], "b": {}}, "x", true, false, null, -0.0, 1e5, 1.50, -12, 0]';
    assert.equal(stringify(parse(text)), text);
  });

  it('keeps the owner uid as exact digits above 2^53', () => {
    const node = parse(`{"uid": ${KNOWN_UID}}`);
    const [key, value] = node.e[0];
    assert.equal(key, 'uid');
    assert.equal(value.t, 'n');
    assert.equal(value.raw, KNOWN_UID);
    assert.equal(stringify(node), `{"uid": ${KNOWN_UID}}`);
  });

  it('keeps duplicate keys and their order', () => {
    const text = '{"b": 1, "a": 2, "a": 3}';
    const node = parse(text);
    assert.deepEqual(node.e.map(([k]) => k), ['b', 'a', 'a']);
    assert.equal(stringify(node), text);
  });

  it('drops a BOM and surrounding whitespace', () => {
    assert.equal(stringify(parse('\ufeff \n{"a": 1}\n')), '{"a": 1}');
  });
});

// Python json.dumps(ensure_ascii=True) output for each input string.
const ESCAPES = [
  ['already-escaped surrogate pair', '"\\u00e9\\ud83d\\ude00"', '"\\u00e9\\ud83d\\ude00"'],
  ['raw UTF-8 becomes \\u escapes', '"é😀"', '"\\u00e9\\ud83d\\ude00"'],
  ['C0 controls as lowercase \\u', '"\\u0001\\u001f"', '"\\u0001\\u001f"'],
  ['DEL (0x7f) is escaped', '"\x7f"', '"\\u007f"'],
  ['U+2028 is escaped', '"\u2028"', '"\\u2028"'],
  ['short escapes stay short', '"\\b\\f\\n\\r\\t\\"\\\\"', '"\\b\\f\\n\\r\\t\\"\\\\"'],
  ['solidus is not escaped', '"a/b"', '"a/b"'],
];

describe('VERIFY-2 escapes match Python json.dumps', () => {
  for (const [name, input, expected] of ESCAPES) {
    it(name, () => assert.equal(stringify(parse(input)), expected));
  }
});

describe('VERIFY-2 nesting depth', () => {
  it('accepts 64 nested containers by default', () => {
    const text = '['.repeat(64) + ']'.repeat(64);
    assert.equal(stringify(parse(text)), text);
  });

  it('refuses 65 nested containers by default with a JsonError', () => {
    assert.throws(() => parse('['.repeat(65) + ']'.repeat(65)), isJsonError);
  });

  it('honours an explicit maxDepth', () => {
    assert.throws(() => parse('[[[]]]', { maxDepth: 2 }), isJsonError);
    assert.equal(stringify(parse('[[]]', { maxDepth: 2 })), '[[]]');
  });

  it('refuses absurd nesting with a JsonError instead of exhausting the stack', () => {
    assert.throws(() => parse('['.repeat(200000)), isJsonError);
  });
});

// Exact [text, line, column] for errors where the first wrong character is unambiguous.
const EXACT_POSITIONS = [
  ["'a'", 1, 1],
  ['[NaN]', 1, 2],
  ['[Infinity]', 1, 2],
  ['[1 2]', 1, 4],
  ['01', 1, 2],
  ['{} x', 1, 4],
  ['"a\nb"', 1, 3],
  ['{"a": 1}\n  x', 2, 3],
  ['{"a": 1 /* c */}', 1, 9],
];

describe('VERIFY-2 malformed input', () => {
  for (const [text, line, column] of EXACT_POSITIONS) {
    it(`reports line ${line}, column ${column} for ${JSON.stringify(text)}`, () => {
      assert.throws(() => parse(text), (e) => isJsonError(e) && e.line === line && e.column === column
        && typeof e.message === 'string' && e.message.length > 0);
    });
  }

  it('reports the line of a trailing comma inside a multi-line document', () => {
    assert.throws(() => parse('{\n  "a": 1,\n  "b": tru\n}'), (e) => isJsonError(e) && e.line === 3);
  });

  it('gives a zero-based offset that points at the offending character', () => {
    assert.throws(() => parse('[1 2]'), (e) => isJsonError(e) && '[1 2]'[e.offset] === '2');
  });

  for (const text of ['{"a":1,}', '[1,]', '', '"abc', '{"a" 1}', "{'a': 1}", '[1,,2]', '/* x */ [1]']) {
    it(`rejects ${JSON.stringify(text)} with a JsonError that has a usable position`, () => {
      assert.throws(() => parse(text), (e) => isJsonError(e) && Number.isInteger(e.line) && e.line >= 1
        && Number.isInteger(e.column) && e.column >= 1 && e.offset >= 0 && e.offset <= text.length);
    });
  }
});

describe('VERIFY-2 int()', () => {
  it('reads canonical safe integers', () => {
    assert.equal(int(parse('0')), 0);
    assert.equal(int(parse('-5')), -5);
    assert.equal(int(parse('9007199254740991')), 9007199254740991);
  });

  it('refuses non-canonical, fractional, exponent or unsafe literals', () => {
    for (const text of ['007', '1.0', '1e3', '9007199254740992', KNOWN_UID]) {
      assert.throws(() => int(parse(text)), undefined, `int(${text}) must throw`);
    }
  });

  it('refuses a node that is not a number', () => {
    assert.throws(() => int(parse('"1"')));
  });
});
