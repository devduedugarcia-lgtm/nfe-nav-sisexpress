export function downloadText(fileName: string, content: string, mime = "application/xml") {
  const blob = new Blob([content], { type: mime });
  triggerDownload(fileName, URL.createObjectURL(blob));
}

export function downloadBase64(fileName: string, base64: string, mime = "application/zip") {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: mime });
  triggerDownload(fileName, URL.createObjectURL(blob));
}

function triggerDownload(fileName: string, url: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR");
}

export function formatDateTime(value: string) {
  return new Date(value).toLocaleString("pt-BR");
}
