// A small, generic assembly (ALP) highlighter for 8085/8086/x86/ARM/AVR style sources.
// Comments start with ; # or //, labels end with ':', directives start with '.'.
const REGISTERS = new RegExp('^(?:' + [
  'a', 'b', 'c', 'd', 'e', 'h', 'l', 'm', 'sp', 'pc', 'psw', // 8085
  '[re]?[abcd]x', '[abcd][hl]', '[re]?[sd]i', '[re]?[sb]p', '[cdefgs]s', 'r\\d+[bdw]?', 'ip', 'flags', // x86
  'r\\d+', 'lr', 'xmm\\d+', // ARM / AVR / SIMD
].join('|') + ')$', 'i');

export const asm = {
  name: 'asm',
  startState: () => ({ lineStart: true }),
  token(stream, state) {
    if (stream.sol()) state.lineStart = true;
    if (stream.eatSpace()) return null;
    if (stream.match(/^(;|#|\/\/)/)) { stream.skipToEnd(); return 'comment'; }
    if (stream.match(/^"(?:[^"\\]|\\.)*"?/) || stream.match(/^'(?:[^'\\]|\\.)*'?/)) return 'string';
    if (stream.match(/^(0x[\da-f]+|[\da-f]+h|0b[01]+|[01]+b|\d+)\b/i)) return 'number';
    if (stream.match(/^\.[\w.]+/)) { state.lineStart = false; return 'meta'; }
    if (stream.match(/^[A-Za-z_.$?@][\w.$?@]*/)) {
      const word = stream.current();
      if (stream.peek() === ':') { state.lineStart = false; return 'labelName'; }
      if (state.lineStart) { state.lineStart = false; return 'keyword'; }
      return REGISTERS.test(word) ? 'variableName.special' : 'variableName';
    }
    stream.next();
    return /[+\-*/,\[\]()]/.test(stream.current()) ? 'operator' : null;
  },
  languageData: { commentTokens: { line: ';' } },
};
