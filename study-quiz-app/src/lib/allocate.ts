/**
 * total개를 weights 비율대로 나눈다(최대 잉여 방식).
 * 각 항목은 최소 min개를 받고, min×개수가 total보다 크면 합계가 total을 넘을 수 있다.
 */
export function allocate(weights: number[], total: number, min = 0): number[] {
  const n = weights.length;
  if (n === 0) return [];
  const result = new Array<number>(n).fill(min);
  const remaining = Math.max(0, total - min * n);
  const sum = weights.reduce((a, b) => a + Math.max(0, b), 0);
  const shares = weights.map((w) => (sum > 0 ? (Math.max(0, w) / sum) * remaining : remaining / n));
  let given = 0;
  shares.forEach((s, i) => {
    result[i] += Math.floor(s);
    given += Math.floor(s);
  });
  const order = shares
    .map((s, i) => ({ i, frac: s - Math.floor(s) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; k < remaining - given; k++) result[order[k % n].i] += 1;
  return result;
}

/**
 * allocate와 같지만 각 항목이 caps[i]를 넘지 않게 하고,
 * 넘친 몫은 여유가 있는 항목에 비율대로 다시 나눈다.
 */
export function allocateCapped(weights: number[], caps: number[], total: number): number[] {
  const n = weights.length;
  const result = new Array<number>(n).fill(0);
  let left = Math.min(total, caps.reduce((a, b) => a + b, 0));
  let open = weights.map((_, i) => i).filter((i) => caps[i] > 0);
  while (left > 0 && open.length) {
    const share = allocate(open.map((i) => weights[i]), left);
    let used = 0;
    open.forEach((i, k) => {
      const take = Math.min(share[k], caps[i] - result[i]);
      result[i] += take;
      used += take;
    });
    left -= used;
    open = open.filter((i) => result[i] < caps[i]);
    if (used === 0) {
      // 비율상 0개씩 받은 항목만 남은 경우: 가중치 큰 순으로 하나씩
      open.sort((a, b) => weights[b] - weights[a]);
      for (const i of open) {
        if (left === 0) break;
        result[i] += 1;
        left -= 1;
      }
      open = open.filter((i) => result[i] < caps[i]);
    }
  }
  return result;
}
