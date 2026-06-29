import { S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

import { env } from '@env'

const MEDIA_URL_TTL_SECONDS = 300

let client: S3Client | null = null

const getR2Client = () => {
  client ??= new S3Client({
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    },
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
  })

  return client
}

export const getGalleryMediaStorageConfig = () => ({
  bucketName: env.S3_BUCKET_NAME,
  expiresInSeconds: MEDIA_URL_TTL_SECONDS,
  prefix: env.S3_PREFIX,
  s3Client: getR2Client(),
})

export { MEDIA_URL_TTL_SECONDS, getSignedUrl }
