export async function printESC(data) {
  if (!data || data.length === 0) throw new Error('There is no ESC/POS output to print.');
  if (!navigator.serial) {
    throw new Error('Direct ESC/POS printing requires a browser with Web Serial support.');
  }

  const port = await navigator.serial.requestPort();
  await port.open({ baudRate: 9600 });
  const writer = port.writable.getWriter();
  try {
    await writer.write(data instanceof Uint8Array ? data : new Uint8Array(data));
  } finally {
    writer.releaseLock();
    await port.close();
  }
}

export function downloadOutput(data, filename, mimeType) {
  const blob = new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
