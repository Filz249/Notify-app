function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
export async function exportBackupFile(contents: string) {
  download(
    new Blob([contents], { type: "application/json" }),
    "Notify-backup-" + Date.now() + ".json",
  );
}
export function pickBackupFile(): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.style.display = "none";
    document.body.appendChild(input);
    input.oncancel = () => {
      input.remove();
      resolve(null);
    };
    input.onchange = async () => {
      try {
        const file = input.files?.[0];
        if (!file) {
          resolve(null);
          return;
        }
        if (file.size > 25_000_000)
          throw new Error("Choose a backup smaller than 25 MB.");
        resolve(await file.text());
      } catch (error) {
        reject(error);
      } finally {
        input.remove();
      }
    };
    input.click();
  });
}
export async function exportSketchImage(
  svg: string,
  name: string,
  _render?: () => Promise<string>,
) {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const picture = new Image();
    await new Promise<void>((resolve, reject) => {
      picture.onload = () => resolve();
      picture.onerror = () => reject(new Error("Could not render the sketch."));
      picture.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = picture.naturalWidth * 2;
    canvas.height = picture.naturalHeight * 2;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image export is unavailable.");
    context.drawImage(picture, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) =>
          b ? resolve(b) : reject(new Error("Could not export the image.")),
        "image/png",
      ),
    );
    download(blob, name.replace(/[^a-z\d_-]/gi, "-").slice(0, 60) + ".png");
  } finally {
    URL.revokeObjectURL(url);
  }
}
