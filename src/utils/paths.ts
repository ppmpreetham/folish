/** Path-string helpers; separators for both Windows and Unix. */

const cut = (p: string) => Math.max(p.lastIndexOf("\\"), p.lastIndexOf("/")) + 1;

export const pathDir = (p: string) => p.slice(0, cut(p));

export const pathTail = (p: string) => p.slice(cut(p));

/** "C:\a\b\name.flsh" -> "name" (also accepts bare "name.flsh") */
export const baseFileName = (p: string) => pathTail(p).replace(/\.flsh$/i, "");
