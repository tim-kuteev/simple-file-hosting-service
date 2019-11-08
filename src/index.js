const argv = require('minimist')(process.argv.slice(2));
const debug = require('debug')('simple-file-hosting-service');
const express = require('express');
const StaticServer = require('node-static').Server;
const fileUtils = require('./file-utils');

const PORT = argv.port || 8080;

const PAGE = `
<form action="/upload" enctype="multipart/form-data" method="post">
  <input type="file" name="file" style="width: 20rem;">
  <input type="submit" value="Upload">
</form>
<form action="/url-upload" enctype="application/x-www-form-urlencoded" method="post">
  <input type="text" name="url" placeholder="Paste file URL" style="width: 20rem;">
  <input type="submit" value="Upload">
</form>
`;

const fileServer = new StaticServer(fileUtils.PUBLIC_DIR);

const app = express();

app.use(express.urlencoded({extended: false}));
app.use(express.json());

app.use('/favicon.ico', (req, res, next) => res.sendStatus(204));

app.use((req, res, next) => {
  debug(`Request: ${req.method} ${req.url}`);
  next();
});

app.get('/download/*', (req, res) => {
  fileServer
    .serveFile(req.params[0], 200, {}, req, res)
    .on('error', (err) => res.sendStatus(404));
});

app.post('/upload', async (req, res, next) => {
  try {
    await fileUtils.shakeStorage();
    const file = await fileUtils.upload(req, res);
    debug('File uploaded:\n\t%o\n\t%o', file.path, file.originalname);
    const uri = await fileUtils.publish(file.path, file.originalname);
    res.redirect(uri);
  } catch (err) {
    next(err);
  }
});

app.post('/url-upload', async (req, res, next) => {
  try {
    await fileUtils.shakeStorage();
    const file = await fileUtils.download(req.body.url);
    debug('File uploaded by url:\n\t%o\n\t%o', file.dest, file.name);
    const uri = await fileUtils.publish(file.dest, file.name);
    res.redirect(uri);
  } catch (err) {
    next(err);
  }
});

app.use((req, res) => {
  res.send(PAGE);
});

app.use((err, req, res, next) => {
  debug('Error: %O', err);
  res.sendStatus(500);
});

app.listen(PORT, () => {
  debug('Listening %o', PORT);
});

process.on('uncaughtException', (err) => {
  debug('Uncaught Exception: %O', err);
});
