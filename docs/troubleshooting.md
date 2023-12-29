# Troubleshooting
Something went wrong, no matter, here are some suggested solution to common issues:

### My urls are expiring too soon
Presigned urls only last for a limited time, which has an upper bound by the type of identity used to create the url.
* [Upper bound limits on expiry times](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html#who-presigned-url)

### 403 Access Denied on requests
Make sure to enable ACL under Object ownership on my bucket while having block public access off.
