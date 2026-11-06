# Private S3 uploads and document delivery

Customer, rider and vendor documents use the same authenticated asset service.
Staging and production require private AWS S3. PostgreSQL stores ownership, sizes,
hashes, object identifiers, sessions, checksums and job state; it does not store
document bodies or signed URLs. The API and worker do not keep document files on
the droplet. Local filesystem storage remains available for development only.

Use direct multipart sessions for mobile networks and concurrent uploads. File
bytes go from the client to S3; the backend handles short authorization/session
requests. Processing workers separately validate and losslessly compress uploaded
sources. An upload response does not make a document ready: wait for
`asset.status="ready"` before attaching its ID to a profile, shipment, catalogue
item or support message. All API calls below use the backend bearer session.
Upload creation and part/session operations require the active verified owner.

## Routes

| Method and path | Request and result |
| --- | --- |
| `POST /v1/uploads/multipart` | `Idempotency-Key` plus `UploadRequest` JSON. Returns `201 UploadSession`, or `202` while initiation is in progress. |
| `GET /v1/uploads/{id}/session` | Owner-only session status and completed S3 parts while uploading. Returns `200 UploadSession`. |
| `POST /v1/uploads/{id}/parts/{part}` | JSON `checksum_sha256`; returns `200 SignedRequest` for one direct S3 PUT. Also renews an expired part URL. |
| `POST /v1/uploads/{id}/complete` | No request body or idempotency header. The server verifies S3's part list and queues processing. Returns `202 UploadSession`, or `200` if already ready. |
| `POST /v1/uploads/{id}/abort` | `Idempotency-Key`, no body. Unfinished owner upload only; returns `202 {"status":"deletion_queued"}`. |
| `POST /v1/uploads/{id}/download` | No request body or idempotency header. Authorizes a ready asset and returns `200 SignedRequest` for a direct S3 GET. |
| `POST /v1/uploads` | Compatibility binary stream through the API to S3. Returns `202 UploadSession` while processing, or `200` for an already-ready retry. |
| `GET /v1/uploads/{id}` | Ready metadata for an authorized reader, or owned staging metadata. Returns `200 Asset`. |
| `GET /v1/uploads/{id}/content` | Authorizes ready content, then returns `307` with a short-lived S3 `Location`. Local development serves bytes directly. |
| `DELETE /v1/uploads/{id}` | Owner-only, `Idempotency-Key`. Queues deletion of an unreferenced finished asset; rejects attached or still-processing assets. |

The [OpenAPI schemas](../api/domains.yaml) define exact fields and error responses.
`Idempotency-Key` is 8–128 characters from letters, digits, `.`, `_`, `:`, `-`.
Keep one key for the same logical creation or abort. Reusing a creation key with
different document metadata or upload transport returns a conflict.

## Direct upload and resume

1. Read the original JPEG, PNG, WebP or PDF. Calculate its byte count and SHA-256.
   `size_bytes` and the hexadecimal `sha256` always describe these original bytes.
2. Optionally gzip the original bytes on the client **before upload**, retaining
   gzip only when smaller. Set `content_encoding="gzip"` and
   `upload_size_bytes` to the compressed length. Otherwise omit the encoding and
   use the original size. Both original and transmitted sizes must be between
   one byte and **10 MiB (10,485,760 bytes)**.
3. Create the session. For example, supply this shape with real computed values:

   ```json
   {
     "mime_type": "application/pdf",
     "size_bytes": 7400000,
     "sha256": "<64 hexadecimal characters for the original file>",
     "upload_size_bytes": 1800000,
     "content_encoding": "gzip"
   }
   ```

4. Persist the session asset ID, original creation key and immutable local upload
   bytes. Split the transmitted bytes into **5 MiB (5,242,880-byte)** parts; the
   final part may be smaller. This size limit allows one or two parts per file.
   Hash each exact part and encode its SHA-256 as standard padded **base64**.
5. Request a URL for each one-based part number with
   `{"checksum_sha256":"<base64 part digest>"}`. Send the returned `method`,
   `url` and signed `headers` directly to S3 with exactly those bytes. Do not send
   the API bearer token to S3. Preserve signed headers; browser networking owns
   `Host` and `Content-Length`, while native clients must preserve exact length.
6. After interruption, fetch `/session`. Match its completed part numbers,
   lengths and checksums with the local file. Upload only missing parts. A lost
   response can be checked this way; resending the identical part is also safe.
   Request a renewed URL when necessary. A different checksum for the same part
   is rejected: start a new session for a changed file.
7. Call `/complete`. The server lists S3's parts itself and compares every size
   and checksum with the saved expectations. It does not trust a client-provided
   ETag list. Repeat completion after an uncertain response; the same object and
   session are recovered rather than creating another document.
8. Poll `/session` with bounded backoff until ready or failed. Respect `Retry-After`
   and retry `429`/transient `503` with jitter. Do not restart successful parts
   merely because the API or processing queue is briefly busy.

Part URLs default to 15 minutes (`S3_URL_TTL_SECONDS`, 60–3600 seconds) and are
capped by the session deadline. Sessions default to 24 hours
(`UPLOAD_SESSION_HOURS`, 1–72 hours). A session expiry requires a new session.
Temporary AWS credentials can make a URL expire earlier than its advertised upper
bound; renewing through the authenticated API obtains a fresh signature.

Creating, signing, completing and publishing work use PostgreSQL row locks,
immutable checksums and fenced leases across API/worker replicas. No database
transaction is held across S3 I/O. At most **eight staging assets**, **100 MiB of
original document bytes**, and **200 non-deleted assets** are allowed per account.
These checks serialize across replicas. Finished assets still count toward the
storage quota until cleanup marks them deleted.

## Validation, compression and downloads

Sources remain private in quarantine while the worker checks their exact uploaded
length/metadata, bounded gzip decoding, original length/SHA-256, MIME and file
content. Images must decode completely and contain at most 40 million pixels.
PDF checks establish the supported MIME/header; they are not antivirus scanning
or a claim that active PDF content has been sanitized.

The worker applies **lossless gzip**, keeping the compressed representation only
when it is smaller. It does not resize images, lower visual quality, modify PDF
signatures or claim that every already-compressed JPEG/WebP/PDF becomes smaller.
Stored objects retain the original MIME and use HTTP `Content-Encoding: gzip`
when appropriate. After decoding, bytes and hash equal the original document.
`Asset.size_bytes` is the original size; `stored_size_bytes` is the stored size.

Server compression reduces stored/download bytes; it cannot reduce bytes already
sent over the user's connection. The optional client gzip step supplies that
initial-upload benefit. Compression cannot overcome a disconnected network;
part-level resume limits how much must be resent.

Session states are `initializing`, `uploading`, `completing`, `queued`,
`processing`, `ready`, `failed` and `aborted`. Asset states are `staging`, `ready`,
`deleting` and `deleted`. Corrupt sources never become ready. Processing has
bounded retries and backoff, independent of how many clients are uploading.
Workers publish only while their lease and staging asset are still valid; an abort
or account closure cannot be undone by a late worker. Quotas, authorization and
content validation also apply to the compatibility stream.

Downloads require a ready asset and current ownership or explicit authorization
through an attached record. Private rider/vendor evidence is not exposed merely
because a customer can view an avatar or approved storefront image. JSON download
authorization is convenient for mobile clients: fetch the returned S3 URL without
forwarding the backend token. The content endpoint instead returns `307`; ensure
the HTTP client strips credentials on the cross-host redirect.

Download URLs default to **120 seconds** (`S3_DOWNLOAD_TTL_SECONDS`, 30–300).
They are temporary bearer credentials: do not log them, store them as profile
image identifiers or share them. Losing access to the backend or logging out does
not instantly revoke an already issued URL; expiration or object deletion ends
its usefulness. The S3 response uses a generated attachment filename, private
no-store caching, and the stored MIME/encoding. Clients should decode gzip through
their HTTP library rather than save compressed bytes under a misleading extension.

## Compatibility stream and existing clients

In S3 mode, `POST /v1/uploads` accepts raw bytes with:

- `Idempotency-Key` and the bearer session.
- `Content-Type` set to the original supported MIME.
- `Content-Length` set to the exact transmitted size, at most 10 MiB.
- `X-Content-SHA256` containing the original hexadecimal SHA-256.
- When gzip is used, `Content-Encoding: gzip` and `X-Uncompressed-Size`.

This path streams through a bounded S3 upload buffer, has eight in-flight streams
per API process and is subject to the HTTP request deadline. It cannot resume a
partial client-to-API request. Use the direct session flow for poor networks and
large simultaneous uploads. Legacy clients must handle the new `UploadSession`
response and asynchronous readiness; local development's earlier `201 Asset`
response does not establish compatibility with S3 deployment.

Profile/catalogue/shipment/support payloads retain **asset IDs**, never public S3
URLs. Vendor `hero_asset_id` is a separate storefront image; private
`document_labels` map `cac`, `utility_bill` or `other` to distinct owned ready
assets also present in `document_asset_ids`. Rider evidence retains its required
named image labels. Optional vendor labels do not invent labels for old records.

## Cleanup, operation and evidence

Abort/delete/account erasure queue durable S3 cleanup. Attached documents cannot
be deleted through the generic asset route. Worker cleanup handles known objects
and multipart uploads; the [bucket lifecycle templates](../deploy/s3/README.md)
cover orphan quarantine objects and unknown upload IDs after seven days. Ready
object tag updates are retried durably; alert on pending updates before lifecycle
expiry. Review versioned-bucket retention separately because a delete marker does
not remove noncurrent document bytes.

All object writes start with the quarantine tag. Publication keeps its database
lease until tagging finishes; failed/ambiguous tag updates remain retryable.
Expired processing leases are reclaimable, including a crash on the last allowed
attempt. Deleted asset tombstones are rechecked after ten minutes and then daily
to remove late provider writes that outlasted cancellation or lease expiry.
Failed deletion uses bounded backoff and cannot monopolize ready-tag recovery.
An independent recovery loop checks ready-tag backlog before S3 calls, so slow
deletions cannot consume that check's deadline.

Restricted administrator `/metrics` exposes `pnd_upload_jobs_pending`,
`pnd_upload_oldest_pending_seconds` (age since session creation),
`pnd_upload_ready_tags_pending` and `pnd_upload_oldest_pending_tag_seconds` (age
since publication). The worker emits an error for pending tags older than one
hour. Connect these signals to alerts and resolve them well before the seven-day
quarantine lifecycle deadline; logging an error does not itself notify an operator.

`ASSET_PROCESSING_CONCURRENCY` defaults to two workers per process (range 1–8).
This bounds expensive decoding/compression separately from direct upload
connections; large decoded images can use much more memory than their compressed
file size. A process-wide weighted admission gate additionally limits estimated
concurrent image decoding allocations to **320 MiB**, using eight bytes per pixel
plus row/scratch margins. Extreme dimensions are rejected before pixel allocation;
ordinary 40-megapixel images remain supported. This is not a total RSS limit:
encoded buffers, gzip, S3 buffers, authentication and garbage collection require
additional headroom. Each replica has its own budget. Keep the API's default 256
request slots for short control requests and
measure queue age/memory before increasing workers. Five hundred file transfers
go directly to S3, rather than occupying five hundred streaming API requests.

`TestS3UploadCapacity500` is an opt-in local workload using real isolated
PostgreSQL and an HTTP S3 test double: 500 authenticated owners transfer 64 KiB
files, hold all 500 transfers open together, complete/process them and verify
download hashes. It also checks metadata-only database storage and bounded
processing. It is **not** an AWS bandwidth, droplet capacity or poor-mobile-network
benchmark. Execution results belong in [validation](validation.md); real staging
must still verify IAM, CORS, bucket privacy/encryption/lifecycle, actual network
interruptions and representative file sizes.

```sh
RUN_UPLOAD_CAPACITY_TEST=1 go test -race -count=1 -run '^TestS3UploadCapacity500$' -v ./internal/assets
```

Run with the isolated `TEST_DATABASE_URL` documented in the README. No real AWS
credentials or objects are used by this workload.
