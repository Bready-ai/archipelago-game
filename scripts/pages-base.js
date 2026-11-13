export function pagesBase({ basePath, repository = 'Bready-ai/archipelago-game' } = {}) {
  if (basePath !== undefined) {
    const path = basePath.replace(/^\/+|\/+$/g, '');
    return path ? `/${path}/` : '/';
  }
  const name = repository.split('/').pop();
  return name.toLowerCase().endsWith('.github.io') ? '/' : `/${name}/`;
}
