import express from 'express';

const app = express();
app.use(express.static('.'));

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`Serving at http://localhost:${PORT}`);
});
