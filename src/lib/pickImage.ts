// Image picking shared by receipt upload, profile photo and company logo.
import * as ImagePicker from "expo-image-picker";

export interface PickedImage {
  uri: string;
  name: string;
  type: string;
  size?: number;
  /** blob (web only) so uploads work in the browser build too */
  file?: any;
}

export async function pickImage(source: "library" | "camera", opts: { crop?: boolean; aspect?: [number, number] } = {}): Promise<PickedImage | null> {
  if (source === "camera") {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error("Camera permission is required to take a photo");
  }
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ["images"],
    quality: 0.9,
    allowsEditing: !!opts.crop,
    aspect: opts.aspect,
  };
  const result = source === "camera" ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets?.length) return null;
  const a = result.assets[0];
  const type = a.mimeType || "image/jpeg";
  const ext = type.split("/")[1] || "jpg";
  return { uri: a.uri, name: a.fileName || `image.${ext}`, type, size: a.fileSize, file: (a as any).file };
}

/** Appends a picked image to FormData the way each platform expects. */
export function appendImage(form: FormData, field: string, img: PickedImage) {
  if (img.file) form.append(field, img.file);
  else form.append(field, { uri: img.uri, name: img.name, type: img.type } as any);
}
