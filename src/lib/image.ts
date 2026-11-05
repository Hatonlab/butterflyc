/** Resize an image file to a compact square JPEG data URL. */
export function fileToDataUrl(file: File, size = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = size;
      c.height = size;
      const ctx = c.getContext("2d")!;
      const s = Math.min(img.width, img.height);
      ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => reject(new Error("صورة غير صالحة"));
    img.src = url;
  });
}

export function timeAgo(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" });
}
