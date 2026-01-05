# ActiveStorage S3 Setup

Use this to store chat image uploads on S3.

## 1) Create S3 bucket
- Bucket name: `jarvis-chat-uploads` (or your choice)
- Region: same as EC2
- Block public access: on

## 2) IAM user + access key
Create an IAM user (e.g. `jarvis-active-storage`) with this policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ActiveStorageBucketAccess",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket",
        "s3:AbortMultipartUpload"
      ],
      "Resource": [
        "arn:aws:s3:::jarvis-chat-uploads",
        "arn:aws:s3:::jarvis-chat-uploads/*"
      ]
    }
  ]
}
```

## 3) Env vars (EC2)
Set these in `jarvis.env` (or your deployment env):

```
ACTIVE_STORAGE_SERVICE=amazon
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

Note: region and bucket are hardcoded in `backend/config/storage.yml`:

```
region: us-east-1
bucket: jarvis-chat-uploads
```

## 4) Bundle install + deploy
ActiveStorage uses the AWS SDK for S3:

```
cd backend
bundle install
```

Then deploy and migrate as usual.

## 5) Notes
- Direct uploads are not enabled; files are uploaded via the Rails API.
- Blob URLs are served through `/rails/active_storage/...` with signed, time-limited access.
