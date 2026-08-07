# User import through Cloudflare R2

The admin import flow deliberately avoids proxying the Excel upload through the
Spring Boot process:

1. `POST /api/users/import/presign` returns a ten-minute presigned `PUT` URL.
2. The browser uploads the `.xlsx` file directly to R2 using that URL and the
   exact `Content-Type` sent in the presign request.
3. `POST /api/users/import/preview` sends only the generated object key. The
   backend downloads the private object, parses at most 1,000 rows, and returns
   validation errors without returning passwords.
4. `POST /api/users/import/confirm` downloads and validates the object again,
   then creates only valid, non-duplicate accounts.

Configure the R2 bucket CORS policy to allow `PUT` from the deployed frontend
origins and allow the `Content-Type` header. Do not make the import prefix
public. The backend credentials require `PutObject` and `GetObject` access to
`admin/user-imports/*`.

Required environment variables are `R2_ACCOUNT_ID`, `R2_ACCESS_KEY`,
`R2_SECRET_KEY`, and `R2_BUCKET`.
