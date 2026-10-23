// Shared by the AI result share cards: renders a DOM node to PNG and triggers a download.
export const saveNodeAsPng = async (node: HTMLElement, filename: string, pixelRatio = 3) => {
  const { toPng } = await import('html-to-image');
  const dataUrl = await toPng(node, { pixelRatio, cacheBust: true });
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  link.click();
};
