import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";

export async function exportBackupFile(contents: string) {
  if (!FileSystem.cacheDirectory || !(await Sharing.isAvailableAsync()))
    throw new Error("File sharing is unavailable on this device.");
  const uri =
    FileSystem.cacheDirectory + "Notify-backup-" + Date.now() + ".json";
  await FileSystem.writeAsStringAsync(uri, contents);
  await Sharing.shareAsync(uri, {
    mimeType: "application/json",
    dialogTitle: "Save Notify backup",
    UTI: "public.json",
  });
}
export async function pickBackupFile(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ["application/json", "text/plain"],
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;
  if ((result.assets[0].size || 0) > 25_000_000)
    throw new Error("Choose a backup smaller than 25 MB.");
  return FileSystem.readAsStringAsync(result.assets[0].uri);
}
export async function exportSketchImage(
  _svg: string,
  name: string,
  render: () => Promise<string>,
) {
  if (!FileSystem.cacheDirectory || !(await Sharing.isAvailableAsync()))
    throw new Error("Image sharing is unavailable on this device.");
  const png = await render();
  const uri =
    FileSystem.cacheDirectory +
    name.replace(/[^a-z\d_-]/gi, "-").slice(0, 60) +
    ".png";
  await FileSystem.writeAsStringAsync(uri, png, {
    encoding: FileSystem.EncodingType.Base64,
  });
  await Sharing.shareAsync(uri, {
    mimeType: "image/png",
    UTI: "public.png",
    dialogTitle: "Save sketch",
  });
}
