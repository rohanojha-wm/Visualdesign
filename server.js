import express from 'express';

const app = express();

const ONE_DAY = 86400;
const ONE_WEEK = 604800;

function setHeaders(res, filePath) {
  const lower = filePath.toLowerCase();

  // Express's built-in mime list may lack AVIF — set it explicitly so
  // browsers treat the file as an image (not application/octet-stream).
  if (lower.endsWith('.avif')) {
    res.setHeader('Content-Type', 'image/avif');
  }

  if (/\.(ttf|otf|woff2?)$/.test(lower)) {
    res.setHeader('Cache-Control', `public, max-age=${ONE_WEEK}, immutable`);
  } else if (/\.(wav|mp3|ogg|m4a)$/.test(lower)) {
    res.setHeader('Cache-Control', 'no-store');
  } else if (/\.(css|js)$/.test(lower)) {
    res.setHeader('Cache-Control', 'no-cache');
  } else if (/\.(svg|png|jpe?g|webp|avif)$/.test(lower)) {
    // Skin assets are added during dev — revalidate so newly added files
    // aren't blocked by a cached 404.
    if (lower.includes('/skins/')) {
      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    } else {
      res.setHeader('Cache-Control', `public, max-age=${ONE_WEEK}`);
    }
  } else if (/\.json$/.test(lower)) {
    if (lower.includes('/skins/') && lower.endsWith('skin.json')) {
      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    } else {
      res.setHeader('Cache-Control', `public, max-age=${ONE_DAY}`);
    }
  }
}

app.use(express.static('.', { setHeaders }));

// Default 3010 — 3000 is often taken (e.g. Next.js). Override with PORT=...
const PORT = process.env.PORT ? Number(process.env.PORT) : 3010;
app.listen(PORT, () => {
  console.log(`Serving at http://localhost:${PORT}`);
});
