export function getRomanceRoot(word: string): string {
  const endings = [
    'ción', 'sión', 'tion', 'sion', 'zione', 'sione', 'ção', 'são',
    'idad', 'ité', 'ità', 'idade', 'tate', 'dad',
    'oso', 'osa', 'eux', 'euse', 'oso', 'osa',
    'ico', 'ica', 'ique', 'ico', 'ica',
    'al', 'ale', 'ar', 'er', 'ir', 'are', 'ere', 'ire'
  ];

  for (const ending of endings) {
    if (word.endsWith(ending) && word.length > ending.length + 2) {
      return word.slice(0, -ending.length);
    }
  }
  return word;
}

export function getGermanicRoot(word: string): string {
  const endings = [
    'ing', 'ed', 'er', 'est', 'ly', 'ness', 'ment',
    'en', 'an', 'ung', 'heit', 'keit', 'lich', 'isch'
  ];

  for (const ending of endings) {
    if (word.endsWith(ending) && word.length > ending.length + 2) {
      return word.slice(0, -ending.length);
    }
  }
  return word;
}

export function areRootsRelated(root1: string, root2: string): boolean {
  if (root1 === root2) return true;
  if (Math.abs(root1.length - root2.length) > 2) return false;

  const maxDiff = Math.floor(Math.min(root1.length, root2.length) / 3);
  let differences = 0;

  for (let i = 0; i < Math.min(root1.length, root2.length); i++) {
    if (root1[i] !== root2[i]) {
      differences++;
      if (differences > maxDiff) return false;
    }
  }

  return differences <= maxDiff;
}
