import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as ImagePicker from 'expo-image-picker';
import { storage } from './firebase';

// Chọn ảnh từ thư viện/máy ảnh rồi upload lên Firebase Storage.
// Trả về download URL công khai (lưu vào product.image), hoặc null nếu user hủy.
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
  return uploadUriToStorage(localUri, folder);
}

// Upload một URI (blob:/file:/data:) lên Storage, trả về URL công khai
export async function uploadUriToStorage(localUri: string, folder = 'products'): Promise<string> {
  const extMatch = /\.(\w+)(\?|$)/.exec(localUri);
  const ext = (extMatch?.[1] || 'jpg').toLowerCase();
  const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext === 'jpeg' ? 'jpg' : ext}`;

  // fetch() đọc được cả blob: (web) lẫn file:// (iOS/Android) trong Expo
  const blob = await fetch(localUri).then((r) => r.blob());
  if (!blob || blob.size === 0) {
    throw new Error('Không đọc được file ảnh đã chọn.');
  }
  // Nén nhẹ: ảnh món ăn không cần quá 1.5MB
  if (blob.size > 3 * 1024 * 1024) {
    throw new Error('Ảnh quá lớn (>3MB), hãy chọn ảnh khác hoặc để độ phân giải thấp hơn.');
  }

  const snap = await uploadBytes(ref(storage, fileName), blob, {
    contentType: blob.type || 'image/jpeg',
  });
  return getDownloadURL(snap.ref);
}
