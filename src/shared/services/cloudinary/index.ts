// src/shared/services/cloudinary/index.ts
import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export type UploadFolder = 'logos' | 'opponents' | 'players';

const TRANSFORMATIONS: Record<UploadFolder, object[]> = {
  // Logos costumam ser quadrados, com fundo transparente (PNG) —
  // só limita o tamanho máximo, sem cortar (crop: 'limit' não distorce).
  logos: [{ width: 300, height: 300, crop: 'limit', quality: 'auto', fetch_format: 'auto' }],
  opponents: [{ width: 300, height: 300, crop: 'limit', quality: 'auto', fetch_format: 'auto' }],
  players: [{ width: 400, height: 400, crop: 'fill', gravity: 'face', quality: 'auto', fetch_format: 'auto' }],
};

// ─── Extrai o public_id do Cloudinary a partir da URL ─────────
function extractPublicId(imageUrl: string): string | null {
  try {
    const url = new URL(imageUrl);
    const parts = url.pathname.split('/');
    const uploadIdx = parts.indexOf('upload');
    if (uploadIdx === -1) return null;

    let startIdx = uploadIdx + 1;
    if (/^v\d+$/.test(parts[startIdx] ?? '')) startIdx++;

    const remaining = parts.slice(startIdx).join('/');
    return remaining.replace(/\.[^/.]+$/, '') || null;
  } catch {
    return null;
  }
}

// ─── Upload ───────────────────────────────────────────────────
export async function uploadImage(
  buffer: Buffer,
  folder: UploadFolder,
): Promise<string> {
  const baseFolder = process.env.CLOUDINARY_FOLDER || 'clube-api';

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `${baseFolder}/${folder}`,
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        transformation: TRANSFORMATIONS[folder],
        resource_type: 'image',
      },
      (error, result) => {
        if (error || !result) return reject(error ?? new Error('Upload falhou sem erro detalhado.'));
        resolve(result.secure_url);
      },
    );

    const readable = new Readable();
    readable.push(buffer);
    readable.push(null);
    readable.pipe(stream);
  });
}

// ─── Deleção (silenciosa — não derruba a operação principal) ─
export async function deleteImageSafe(imageUrl: string | null | undefined): Promise<void> {
  if (!imageUrl) return;
  const publicId = extractPublicId(imageUrl);
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch {
    // não bloqueia a operação principal por falha de deleção
  }
}