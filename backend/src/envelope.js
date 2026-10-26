const codes = require('../../shared/codes.json');

const FALLBACK = '00114';

function message(code) {
  return codes[code] || codes[FALLBACK];
}

function envelope(code, data = null) {
  return { code, message: message(code), data };
}

module.exports = { codes, message, envelope };
