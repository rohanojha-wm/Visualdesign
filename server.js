import express from 'express';

const app = express();

const ONE_DAY = 86400;
const ONE_WEEK = 604800;

app.use((req, res, next) => {
  const url = req.url;
  if (/\.(ttf|otf|woff2?)$/i.test(url)) {
    res.set('Cache-Control', `public, max-age=${ONE_WEEK}, immutable`);
  } else if (/\.(wav|mp3|ogg|m4a)$/i.test(url)) {
    // Ambient tracks are replaced often; avoid any HTTP caching of bytes.
    res.set('Cache-Control', 'no-store');
  } else if (/\.(css|js)$/i.test(url)) {
    res.set('Cache-Control', `public, max-age=${ONE_DAY}`);
  } else if (/\.(svg|png|jpe?g|webp|avif)$/i.test(url)) {
    res.set('Cache-Control', `public, max-age=${ONE_WEEK}`);
  } else if (/\.json$/i.test(url)) {
    // Skin manifests change often during development (ambientVersion, etc.) — avoid stale JSON.
    if (url.includes('/skins/') && /skin\.json$/i.test(url)) {
      res.set('Cache-Control', 'public, max-age=0, must-revalidate');
    } else {
      res.set('Cache-Control', `public, max-age=${ONE_DAY}`);
    }
  }
  next();
});

app.use(express.static('.'));

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`Serving at http://localhost:${PORT}`);
});
