# ManyTool video downloads

Cloudflare Worker → one Durable Object / Container → bounded Python yt-dlp + FFmpeg jobs. Supabase is not required and video files are never stored in the application database.

## Deploy

From this directory, run `npm ci`, `npm run check`, then `npm run deploy`. Docker must be running locally, or run the deployment in Cloudflare Workers Builds (root directory `video-service`, build command `npm ci`, deploy command `npx wrangler deploy`). Workers Builds needs its own authorized build token and repository connection. The existing Wrangler OAuth login alone may not permit creating a Builds configuration.

Deploy the service before publishing the Astro pages. Verify `/api/video/health`, create a real job, poll its status and download the returned file; health alone does not verify that the container can boot. The configured production route is `manytool.net/api/video/*`.

## Limits and behavior

- One basic container, sleep after ten minutes idle; paid Cloudflare compute/network charges apply.
- Two concurrent jobs, 100 create requests per UTC day, five creates per IP per minute.
- 300 MiB final file, 600 MiB temporary storage threshold, 180-second job timeout.
- Platform videos: up to 30 minutes and 720p; direct file links retain their source format and resolution.
- Completed files expire after ten minutes. Container restarts also remove jobs. Links are random bearer tokens; do not log or share them.
- No live streams, playlists, authenticated downloads, browser cookies, DRM, or restricted videos. Chzzk supports VOD URLs, not clips.
- Platform support depends on upstream access and yt-dlp extractors; a platform page does not guarantee every link works. Keep yt-dlp and its JS dependencies updated after testing.
- Public HTTPS URLs only. The downloader subprocess blocks private/reserved addresses at DNS resolution and connection time, including redirects. FFmpeg handles local merges only.

## Verify locally

`python -m unittest discover -s tests -v` checks URL validation and network restrictions. Install `container/requirements.txt`, Node.js and FFmpeg before running `python container/server.py`. Set `PORT` if needed (default 8080). The production Docker image includes the dependencies.

From the site root, `node scripts/test-video-download.mjs` tests eight SEO pages, main cards, mobile layout, private URL rejection, and an actual CC0 MP4 download. Set `VIDEO_TEST_URL` to the site with `/api/video/*` connected to the local service. The default is `http://127.0.0.1:8767`; the test uses installed Microsoft Edge.

Do not treat successful direct-file testing as validation of all eight upstream platforms. Verify representative public links after production deployment and show upstream failures honestly.
