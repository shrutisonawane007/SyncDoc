/**
 * Computes a string position that sorts lexicographically between 'prev' and 'next'.
 * Used for fractional indexing in collaborative editors to insert blocks anywhere
 * without changing the indices of existing blocks.
 */
export function getMiddlePosition(prev: string | null, next: string | null): string {
  const charCode = (char: string, index: number) => {
    return index < char.length ? char.charCodeAt(index) : 32; // space character as baseline
  };

  const BASE_START = 97;  // 'a'
  const BASE_END = 122;   // 'z'

  const p = prev || String.fromCharCode(BASE_START);
  const n = next || String.fromCharCode(BASE_END);

  // If prepend: find character smaller than first block
  if (prev === null) {
    const firstCode = n.charCodeAt(0);
    if (firstCode > 33) { // Allow going down to ASCII 33 (any printable char)
      return String.fromCharCode(firstCode - 1);
    }
    return String.fromCharCode(33) + n;
  }

  // If append: find character larger than last block
  if (next === null) {
    const lastCode = p.charCodeAt(p.length - 1);
    if (lastCode < BASE_END) {
      return p.slice(0, -1) + String.fromCharCode(lastCode + 1);
    }
    return p + 'm'; // append 'm'
  }

  // Find the first index where strings differ
  let index = 0;
  while (charCode(p, index) === charCode(n, index)) {
    index++;
  }

  const pVal = charCode(p, index);
  const nVal = charCode(n, index);

  if (nVal - pVal > 1) {
    // There is an available slot between the characters at the current index
    const middleCode = Math.floor((pVal + nVal) / 2);
    return p.substring(0, index) + String.fromCharCode(middleCode);
  } else {
    // Consecutive characters, e.g., 'a' and 'b'. Append characters to the shorter string.
    return p + 'm';
  }
}
