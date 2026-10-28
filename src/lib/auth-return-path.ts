export const authReturnPath = (value: string | null) => {
  if (!value?.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/';
  try {
    const url = new URL(value, 'https://contiroom.invalid');
    return url.origin === 'https://contiroom.invalid' ? `${url.pathname}${url.search}${url.hash}` : '/';
  } catch {
    return '/';
  }
};
