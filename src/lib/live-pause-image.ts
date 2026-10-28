const openPauseImages = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('contiroom-live', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('images');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

export const getPauseImage = async (): Promise<Blob | undefined> => {
  const database = await openPauseImages();
  try {
    return await new Promise((resolve, reject) => {
      const request = database.transaction('images').objectStore('images').get('pause');
      request.onsuccess = () => resolve(request.result as Blob | undefined);
      request.onerror = () => reject(request.error);
    });
  } finally {
    database.close();
  }
};

export const setPauseImage = async (file: File | null): Promise<void> => {
  const database = await openPauseImages();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('images', 'readwrite');
      if (file) transaction.objectStore('images').put(file, 'pause');
      else transaction.objectStore('images').delete('pause');
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
};
