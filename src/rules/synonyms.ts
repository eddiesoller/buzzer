export function pick<T>(arr: T[], seed: string): T {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return arr[h % arr.length]!;
}

export const WIN_VERBS       = ['defeats', 'beats', 'tops', 'outlasts', 'takes down'];
export const BLOWOUT_VERBS   = ['demolishes', 'blows out', 'crushes', 'throttles', 'routs'];
export const CLOSE_WIN_VERBS = ['edges', 'squeaks past', 'holds off', 'escapes past', 'outlasts'];
