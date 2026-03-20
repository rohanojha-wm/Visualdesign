import express from 'express';

const app = express();

const ONE_DAY = 86400;
const ONE_WEEK = 604800;

app.use((req, res, next) => {
  const url = req.url;
  if (/\.(ttf|otf|woff2?)$/i.test(url)) {
    res.set('Cache-Control', `public, max-age=${ONE_WEEK}, immutable`);
  } else if (/\.(css|js)$/i.test(url)) {
    res.set('Cache-Control', `public, max-age=${ONE_DAY}`);
  } else if (/\.(svg|png|jpe?g|webp|avif)$/i.test(url)) {
    res.set('Cache-Control', `public, max-age=${ONE_WEEK}`);
  } else if (/\.json$/i.test(url)) {
    res.set('Cache-Control', `public, max-age=${ONE_DAY}`);
  }
  next();
});

app.use(express.static('.'));

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`Serving at http://localhost:${PORT}`);
});
