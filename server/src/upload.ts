import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure:     true,
});

/**
 * Upload a file buffer to Cloudinary.
 * Images go to cknest/photos, all other files go to cknest/documents.
 */
export function uploadToCloudinary(
  buffer: Buffer,
  resourceType: 'image' | 'raw',
): Promise<{ url: string; publicId: string }> {
  const folder = resourceType === 'image' ? 'cknest/photos' : 'cknest/documents';
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: resourceType, use_filename: true, unique_filename: true },
      (error, result) => {
        if (error || !result) return reject(error ?? new Error('Cloudinary upload failed'));
        resolve({ url: result.secure_url, publicId: result.public_id });
      },
    );
    stream.end(buffer);
  });
}
