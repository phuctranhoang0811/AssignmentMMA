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

// Giới hạn ảnh gốc tối đa 25MB (sẽ được tự động thu nhỏ & nén xuống <180KB trước khi lưu)
const MAX_RAW_FILE_BYTES = 25 * 1024 * 1024;
// Giới hạn kích thước sau khi nén (~180KB binary ≈ 240KB base64) để 3 banner cùng nằm trong 1 doc Firestore (<1MB) không bao giờ tràn
const TARGET_MAX_COMPRESSED_BYTES = 180 * 1024;

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
// WEB: không upload Firebase Storage — nén thông minh rồi nhúng base64 (data URL) vào Firestore,
//      bấm chọn ảnh là hiện lên liền, khỏi chờ tải. Ảnh đã nén ≤180KB (~240KB base64) nên dù lưu
//      cả 3 banner cùng lúc vẫn luôn dưới giới hạn 1MB của một document Firestore.
// NATIVE: giữ đường upload Storage (data URL lớn sẽ nghẹt bộ nhớ khi render trên app).
export async function pickAndUploadImage(
  folder = 'products',
  options?: { quality?: number; aspect?: [number, number] }
): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Cần quyền truy cập ảnh để upload hình.');
  }

  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: options?.aspect ?? [4, 3],
    quality: options?.quality ?? 0.75,
  });
  if (picked.canceled || !picked.assets?.length) return null;

  const localUri = picked.assets[0].uri;
  const maxDim = folder === 'banners' ? 1000 : 850;

  // Ưu tiên 1: Cloudinary (đã cấu hình .env) — nén phía web rồi đẩy lên CDN
  if (cloudinaryReady) {
    if (Platform.OS === 'web') {
      const rawBlob = await fetch(localUri).then((r) => r.blob());
      if (!rawBlob || rawBlob.size === 0) throw new Error('Không đọc được file ảnh đã chọn.');
      const blob = await downscaleForUpload(rawBlob, maxDim, options?.quality ?? 0.8);
      return uploadToCloudinary(blob);
    }
    // Native: Cloudinary nhận trực tiếp file URI của Expo
    const fileName = localUri.split('/').pop() || `dish-${Date.now()}.jpg`;
    return uploadToCloudinary({ uri: localUri, name: fileName, type: 'image/jpeg' });
  }

  // Ưu tiên 2 (web, chưa cấu hình Cloudinary): nén đa cấp rồi nhúng base64 vào Firestore
  if (Platform.OS === 'web' && typeof FileReader !== 'undefined') {
    const rawBlob = await fetch(localUri).then((r) => r.blob());
    if (!rawBlob || rawBlob.size === 0) throw new Error('Không đọc được file ảnh đã chọn.');
    if (rawBlob.size > MAX_RAW_FILE_BYTES) {
      throw new Error('Ảnh gốc quá lớn (>25MB), hãy chọn ảnh nhẹ hơn.');
    }
    const blob = await downscaleForUpload(rawBlob, maxDim, options?.quality ?? 0.78);
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

// Thu nhỏ + nén ảnh đa cấp (progressive compression):
// Đảm bảo ảnh đầu ra vừa sắc nét (imageSmoothingQuality = 'high') vừa luôn ≤ 180KB
// để không bao giờ vượt giới hạn 1MB/document của Firestore kể cả khi lưu 3 banner cùng lúc.
async function downscaleForUpload(
  blob: Blob,
  maxDim = 900,
  initialQuality = 0.76
): Promise<Blob> {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return blob;
  if (blob.size <= 120 * 1024 && blob.type === 'image/jpeg') return blob;

  const url = URL.createObjectURL(blob);
  try {
    const img = new window.Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('read-fail'));
      img.src = url;
    });

    let currentMaxDim = maxDim;
    let currentQuality = initialQuality;
    let bestBlob: Blob = blob;

    // Thử tối đa 4 nấc nén nếu ảnh quá nặng (ví dụ ảnh 4K PNG 15MB)
    for (let attempt = 0; attempt < 4; attempt++) {
      const scale = Math.min(
        1,
        currentMaxDim / Math.max(img.width || currentMaxDim, img.height || currentMaxDim)
      );
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round((img.width || currentMaxDim) * scale));
      canvas.height = Math.max(1, Math.round((img.height || currentMaxDim) * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) return bestBlob;

      // Đổ nền trắng phòng trường hợp ảnh PNG trong suốt chuyển sang JPEG bị đen nền
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const candidate = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/jpeg', currentQuality)
      );

      if (candidate) {
        bestBlob = candidate;
        if (candidate.size <= TARGET_MAX_COMPRESSED_BYTES) {
          return candidate;
        }
      }

      // Nếu vẫn >180KB thì giảm nhẹ độ phân giải & quality ở vòng tiếp theo
      currentMaxDim = Math.round(currentMaxDim * 0.85);
      currentQuality = Math.max(0.5, currentQuality - 0.1);
    }

    return bestBlob.size < blob.size ? bestBlob : blob;
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
  if (rawBlob.size > MAX_RAW_FILE_BYTES) {
    throw new Error('Ảnh gốc quá lớn (>25MB), hãy chọn ảnh nhẹ hơn.');
  }
  const blob = await downscaleForUpload(rawBlob);

  const snap = await uploadBytes(ref(storage, fileName), blob, {
    contentType: 'image/jpeg',
  });
  return getDownloadURL(snap.ref);
}
