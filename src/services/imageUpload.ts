import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import { storage } from './firebase';

// ===== Cloudinary (bên thứ 3 lưu ảnh) =====
// Điền vào .env rồi khởi động lại `npx expo start -c`:
//   EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME=xxx
//   EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET=xxx  (phải là UNSIGNED preset trong Console → Upload)
// Nếu chưa điền thì tự động quay về cách cũ (web: base64, native: Firebase Storage).
const CLOUDINARY_CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME || '';
const CLOUDINARY_UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET || '';
const cloudinaryReady = CLOUDINARY_CLOUD_NAME.length > 0 && CLOUDINARY_UPLOAD_PRESET.length > 0;

// Upload blob lên Cloudinary bằng unsigned endpoint, trả về secure_url (CDN, load rất nhanh)
async function uploadToCloudinary(file: Blob | { uri: string; name: string; type: string }): Promise<string> {
  const form = new FormData();
  form.append('file', file as any, typeof file === 'object' && 'uri' in file ? file.name : `dish-${Date.now()}.jpg`);
  form.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  form.append('folder', 'pizzastore/products');

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Cloudinary lỗi (${res.status}). Kiểm tra cloud name / upload preset.${detail ? ` ${detail.slice(0, 150)}` : ''}`);
  }
  const json = await res.json();
  if (!json?.secure_url) throw new Error('Cloudinary không trả về URL ảnh.');
  return json.secure_url as string;
}

// Chọn ảnh từ thư viện/máy ảnh.
// WEB: không upload Firebase Storage — nén rồi nhúng thẳng base64 (data URL) vào product.image,
//      bấm chọn ảnh là hiện lên liền, khỏi chờ tải. Ảnh đã nén ≤900px (~150-300KB) nên vẫn dưới
//      giới hạn 1MB của một document Firestore.
// NATIVE: giữ đường upload Storage (data URL lớn sẽ nghẹt bộ nhớ khi render trên app).
export async function pickAndUploadImage(
  folder = 'products',
  options?: { quality?: number }
): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Cần quyền truy cập ảnh để upload hình món ăn.');
  }

  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [4, 3],
    quality: options?.quality ?? 0.7,
  });
  if (picked.canceled || !picked.assets?.length) return null;

  const localUri = picked.assets[0].uri;

  // Ưu tiên 1: Cloudinary (đã cấu hình .env) — nén phía web rồi đẩy lên CDN
  if (cloudinaryReady) {
    if (Platform.OS === 'web') {
      const rawBlob = await fetch(localUri).then((r) => r.blob());
      if (!rawBlob || rawBlob.size === 0) throw new Error('Không đọc được file ảnh đã chọn.');
      const blob = await downscaleForUpload(rawBlob);
      return uploadToCloudinary(blob);
    }
    // Native: Cloudinary nhận trực tiếp file URI của Expo
    const fileName = localUri.split('/').pop() || `dish-${Date.now()}.jpg`;
    return uploadToCloudinary({ uri: localUri, name: fileName, type: 'image/jpeg' });
  }

  // Ưu tiên 2 (web, chưa cấu hình Cloudinary): nhúng base64 thẳng vào document Firestore
  if (Platform.OS === 'web' && typeof FileReader !== 'undefined') {
    const rawBlob = await fetch(localUri).then((r) => r.blob());
    if (!rawBlob || rawBlob.size === 0) throw new Error('Không đọc được file ảnh đã chọn.');
    if (rawBlob.size > 8 * 1024 * 1024) throw new Error('Ảnh gốc quá lớn (>8MB), hãy chọn ảnh khác.');
    const blob = await downscaleForUpload(rawBlob);
    return blobToDataUrl(blob);
  }

  return uploadUriToStorage(localUri, folder);
}

// Blob -> data URL (chuỗi base64) để lưu thẳng vào Firestore
async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Không chuyển được ảnh thành data URL.'));
    reader.readAsDataURL(blob);
  });
}

// Thu nhỏ + nén ảnh trước khi upload: card món ăn chỉ hiển thị ~100-300px,
// upload ảnh gốc 3000px vừa chậm tải vừa tốn dung lượng Storage.
// (web: canvas; native: giữ nguyên vì không có canvas — ảnh đã được ImagePicker nén quality 0.7)
async function downscaleForUpload(blob: Blob, maxDim = 900, quality = 0.72): Promise<Blob> {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return blob;
  if (blob.size < 250 * 1024) return blob; // đã nhẹ thì khỏi xử lý

  const url = URL.createObjectURL(blob);
  try {
    const img = new window.Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('read-fail'));
      img.src = url;
    });

    const scale = Math.min(1, maxDim / Math.max(img.width || maxDim, img.height || maxDim));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round((img.width || maxDim) * scale));
    canvas.height = Math.max(1, Math.round((img.height || maxDim) * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return blob;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const out = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', quality)
    );
    // Chỉ dùng bản nén nếu nó thực sự nhỏ hơn bản gốc
    return out && out.size < blob.size ? out : blob;
  } catch {
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Upload một URI (blob:/file:/data:) lên Storage, trả về URL công khai
export async function uploadUriToStorage(localUri: string, folder = 'products'): Promise<string> {
  const extMatch = /\.(\w+)(\?|$)/.exec(localUri);
  const ext = (extMatch?.[1] || 'jpg').toLowerCase();
  const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext === 'jpeg' ? 'jpg' : ext}`;

  // fetch() đọc được cả blob: (web) lẫn file:// (iOS/Android) trong Expo
  const rawBlob = await fetch(localUri).then((r) => r.blob());
  if (!rawBlob || rawBlob.size === 0) {
    throw new Error('Không đọc được file ảnh đã chọn.');
  }
  // Ảnh gốc không được quá 8MB (trước khi nén)
  if (rawBlob.size > 8 * 1024 * 1024) {
    throw new Error('Ảnh gốc quá lớn (>8MB), hãy chọn ảnh khác.');
  }
  const blob = await downscaleForUpload(rawBlob);

  const snap = await uploadBytes(ref(storage, fileName), blob, {
    contentType: 'image/jpeg',
  });
  return getDownloadURL(snap.ref);
}
