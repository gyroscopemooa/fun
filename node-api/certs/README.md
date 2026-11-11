# Supabase database certificate authority

`supabase-prod-ca-2021.crt` is the public CA downloaded from the existing project's
Database Settings → SSL configuration → Download certificate on 2026-11-11:

https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt

It is not a merchant key, database password, or client private key. Connection
code retains hostname/certificate validation (`rejectUnauthorized: true`). If
Supabase rotates this CA, update it from the project's authenticated dashboard;
do not disable certificate verification to work around a connection error.
