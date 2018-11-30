const argv = require('minimist')(process.argv.slice(2));
const debug = require('debug')('multipart-handler');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const IncomingForm = require('formidable').IncomingForm;

const port = argv.port || 8080;

const app = express();

app.use(cors({origin: '*'}));

app.use(function (req, res, next) {
  debug(`Request: ${req.method} ${req.url}`);
  next();
});

app.post('/upload', (req, res) => {
  const form = new IncomingForm();
  form.parse(req)
    .on('field', function (name, value) {
      debug('Form field: %o %o', name, value);
    })
    .on('progress', (received, expected) => {
      debug('File upload: progress %o', Math.round(100 * received / expected));
    })
    .on('file', (name, file) => {
      debug('File uploaded: %o', file.name);
      fs.unlink(file.path, (err) => {
        if (err) debug('Error: %O', err);
        debug('Unlinked %o %o', file.path, file.name);
      });
    })
    .on('end', () => {
      debug('File upload: end');
      res.status(200).send();
    })
    .on('error', () => {
      res.status(500).send();
    });
});

app.use(function (req, res) {
  res.status(200)
    .send(
      '<form action="/upload" enctype="multipart/form-data" method="post">' +
      '<input type="file" name="upload" multiple="multiple"><br/>' +
      '<input type="submit" value="Upload">' +
      '</form>'
    );
});

app.listen(port, () => {
  debug('Listening %o', port);
});
