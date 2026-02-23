import * as ImagePicker from "expo-image-picker";

export async function pickImage(
  aspect: [number, number] = [1, 1]
): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect,
    quality: 0.7,
  });
  if (result.canceled) return null;
  return result.assets[0].uri;
}

export async function takePhoto(
  aspect: [number, number] = [1, 1]
): Promise<string | null> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== "granted") return null;
  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    aspect,
    quality: 0.7,
  });
  if (result.canceled) return null;
  return result.assets[0].uri;
}

export async function uploadToConvex(
  imageUri: string,
  generateUploadUrl: () => Promise<string>
): Promise<string> {
  const uploadUrl = await generateUploadUrl();
  const response = await fetch(imageUri);
  const blob = await response.blob();
  const uploadResult = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": blob.type || "image/jpeg" },
    body: blob,
  });
  const json = await uploadResult.json();
  return json.storageId;
}
