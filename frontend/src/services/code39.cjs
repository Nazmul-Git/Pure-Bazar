const PATTERNS = {
  0: 'nnnwwnwnn', 1: 'wnnwnnnnw', 2: 'nnwwnnnnw', 3: 'wnwwnnnnn', 4: 'nnnwwnnnw',
  5: 'wnnwwnnnn', 6: 'nnwwwnnnn', 7: 'nnnwnnwnw', 8: 'wnnwnnwnn', 9: 'nnwwnnwnn',
  A: 'wnnnnwnnw', B: 'nnwnnwnnw', C: 'wnwnnwnnn', D: 'nnnnwwnnw', E: 'wnnnwwnnn',
  F: 'nnwnwwnnn', G: 'nnnnnwwnw', H: 'wnnnnwwnn', I: 'nnwnnwwnn', J: 'nnnnwwwnn',
  K: 'wnnnnnnww', L: 'nnwnnnnww', M: 'wnwnnnnwn', N: 'nnnnwnnww', O: 'wnnnwnnwn',
  P: 'nnwnwnnwn', Q: 'nnnnnnwww', R: 'wnnnnnwwn', S: 'nnwnnnwwn', T: 'nnnnwnwwn',
  U: 'wwnnnnnnw', V: 'nwwnnnnnw', W: 'wwwnnnnnn', X: 'nwnnwnnnw', Y: 'wwnnwnnnn',
  Z: 'nwwnwnnnn', '-': 'nwnnnnwnw', '.': 'wwnnnnwnn', '*': 'nwnnwnwnn',
};

// Returns a list of { bar, width } runs (width in modules, wide = 3) for a Code 39 symbol.
function getCode39Runs(value) {
  const text = String(value || '').toUpperCase();
  if (!text || /[^0-9A-Z.-]/.test(text)) throw new Error('Code 39 supports only digits, letters, "-" and ".".');
  const runs = [];
  `*${text}*`.split('').forEach((char, index) => {
    if (index > 0) runs.push({ bar: false, width: 1 });
    PATTERNS[char].split('').forEach((element, position) => {
      runs.push({ bar: position % 2 === 0, width: element === 'w' ? 3 : 1 });
    });
  });
  return runs;
}

module.exports = { getCode39Runs };
