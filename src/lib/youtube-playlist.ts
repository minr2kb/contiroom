export const isYouTubePlaylistUrl = (value: string) => {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com'].includes(url.hostname) &&
      ['/playlist', '/watch'].includes(url.pathname) &&
      /^[\w-]+$/.test(url.searchParams.get('list') ?? '')
    );
  } catch {
    return false;
  }
};
