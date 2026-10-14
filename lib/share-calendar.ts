import { Directory, File, Paths } from 'expo-file-system';
import { isAvailableAsync, shareAsync } from 'expo-sharing';

export async function shareCalendar(contents: string, filename: string): Promise<void> {
  if (!await isAvailableAsync()) throw new Error('File sharing is unavailable on this device. Try exporting from Rollin on another device.');
  const directory = new Directory(Paths.cache, 'calendar-exports');
  directory.create({ idempotent: true });
  // A receiving Android app may read the URI after the chooser closes. Keep
  // recent files available and remove old exports on the next export instead.
  for (const entry of directory.list()) {
    if (entry instanceof File && entry.modificationTime !== null && entry.modificationTime < Date.now() - 86400000) {
      entry.delete();
    }
  }
  const file = new File(directory, filename);
  try {
    file.create({ overwrite: true });
    file.write(contents);
    await shareAsync(file.uri, { mimeType: 'text/calendar', UTI: 'public.calendar-event', dialogTitle: 'Export Rollin events' });
  } catch (error) {
    if (file.exists) file.delete();
    throw error;
  }
}
