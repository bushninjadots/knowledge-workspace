export type DiffLine = { type: "same" | "add" | "del"; text: string };

/**
 * Minimal LCS-based line diff. Returns the full sequence with each line
 * tagged as unchanged, added, or removed. Good enough for README-sized
 * documents without pulling in a diff library.
 */
export function diffLines(a: string, b: string): DiffLine[] {
  const aLines = a.split("\n");
  const bLines = b.split("\n");
  const n = aLines.length;
  const m = bLines.length;

  // dp[i][j] = LCS length of aLines[i..] and bLines[j..]
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] =
        aLines[i] === bLines[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (aLines[i] === bLines[j]) {
      out.push({ type: "same", text: aLines[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ type: "del", text: aLines[i] });
      i++;
    } else {
      out.push({ type: "add", text: bLines[j] });
      j++;
    }
  }
  while (i < n) {
    out.push({ type: "del", text: aLines[i] });
    i++;
  }
  while (j < m) {
    out.push({ type: "add", text: bLines[j] });
    j++;
  }
  return out;
}

export function diffStats(lines: DiffLine[]): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const l of lines) {
    if (l.type === "add") added++;
    else if (l.type === "del") removed++;
  }
  return { added, removed };
}
