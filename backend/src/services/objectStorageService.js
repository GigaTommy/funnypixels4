const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const LOCAL_STORAGE_ROOT = process.env.TILE_SNAPSHOT_LOCAL_PATH || path.join(__dirname, '..', '..', 'data', 'tile-snapshots');
const CDN_BASE_URL = process.env.TILE_CDN_BASE_URL || null;
const S3_BUCKET = process.env.TILE_SNAPSHOT_BUCKET || null;

let s3Client = null;
if (S3_BUCKET) {
  s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
  });
}

async function ensureLocalDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function uploadToLocalStorage(key, buffer) {
  const filePath = path.join(LOCAL_STORAGE_ROOT, key);
  await ensureLocalDir(path.dirname(filePath));
  await fs.writeFile(filePath, buffer);
  return {
    storageKey: key,
    url: CDN_BASE_URL ? `${CDN_BASE_URL.replace(/\/$/, '')}/${key}` : null
  };
}

async function uploadToS3(key, buffer, contentType) {
  if (!s3Client) {
    return uploadToLocalStorage(key, buffer);
  }

  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    ACL: process.env.TILE_SNAPSHOT_ACL || 'public-read'
  });

  await s3Client.send(command);

  const url = CDN_BASE_URL
    ? `${CDN_BASE_URL.replace(/\/$/, '')}/${key}`
    : await getSignedUrl(s3Client, new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }), { expiresIn: 86400 });

  return { storageKey: key, url };
}

module.exports = {
  async uploadTileSnapshot(tileId, version, buffer, mimeType) {
    const extension = mimeType === 'image/webp' ? 'webp' : 'png';
    const safeTileId = tileId.replace(/[^0-9a-zA-Z/_-]/g, '-');
    const digest = crypto.createHash('sha1').update(buffer).digest('hex').slice(0, 12);
    const key = path.posix.join(safeTileId, `v${version}-${digest}.${extension}`);

    return uploadToS3(key, buffer, mimeType);
  },

  async getTileSnapshot(storageKey) {
    if (!storageKey) {
      return null;
    }

    if (s3Client && S3_BUCKET) {
      const command = new GetObjectCommand({ Bucket: S3_BUCKET, Key: storageKey });
      const response = await s3Client.send(command);
      // Convert stream to buffer
      const chunks = [];
      for await (const chunk of response.Body) {
        chunks.push(chunk);
      }
      return Buffer.concat(chunks);
    }

    const filePath = path.join(LOCAL_STORAGE_ROOT, storageKey);
    try {
      return await fs.readFile(filePath);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }
};
