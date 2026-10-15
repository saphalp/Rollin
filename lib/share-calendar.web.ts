export async function shareCalendar(contents: string, filename: string): Promise<void> {
  const url = URL.createObjectURL(new Blob([contents], { type: 'text/calendar;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Allow the browser to start the download before releasing its object URL.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
