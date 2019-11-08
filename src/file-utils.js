const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const url = require('url');
const URL = url.URL;
const https = require('https');
const crypto = require('crypto');
const multer = require('multer');

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const MAX_STORAGE_SIZE = 100 * 1024 * 1024;
const PUBLIC_DIR = path.join(__dirname, 'public');
const UPLOAD_DIR = path.join(__dirname, 'uploads');

const uploadFile = multer({
  dest: UPLOAD_DIR,
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
});

async function shakeStorage() {
  const storageSize = await readSize(PUBLIC_DIR);
  if (storageSize > MAX_STORAGE_SIZE) {
    const dir = await fsp.readdir(PUBLIC_DIR);
    await fsp.rmdir(path.join(PUBLIC_DIR, dir.sort()[0]), {recursive: true});
  }
}

async function readSize(item) {
  const stat = await fsp.stat(item);
  if (stat.isDirectory()) {
    const dir = await fsp.readdir(item);
    const promises = [];
    for (const dirItem of dir) {
      promises.push(readSize(path.join(item, dirItem)));
    }
    const sizes = await Promise.all(promises);
    return sizes.reduce((a, b) => a + b, 0);
  }
  return stat.size || 0;
}

function upload(req, res) {
  return new Promise((resolve, reject) => {
    uploadFile.single('file')(req, res, (err) => {
      if (err) {
        return reject(err);
      }
      resolve(req.file);
    });
  });
}

async function download(url) {
  url = new URL(url);
  if (url.protocol !== 'https:') {
    throw new Error('Unsupported protocol');
  }
  const name = url.pathname.split('/').pop();
  const uuid = crypto.randomBytes(16).toString('hex');
  const dest = path.join(UPLOAD_DIR, uuid);
  await downloadFile(url, dest);
  return {dest, name};
}

async function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest, {flags: 'wx'});

    file.on('error', err => {
      file.close();
      if (err.code === 'EEXIST') {
        reject('File already exists');
      } else {
        fsp.unlink(dest);
        reject(err.message);
      }
    });

    file.on('open', () => {
      const req = https.get(url, res => {
        if (res.statusCode === 200) {
          let size = 0;
          res.pipe(file);
          res.on('data', (chunk) => {
            size += chunk.length;
            if (size > MAX_FILE_SIZE) {
              abort('The file is too big');
            }
          });
          file.on('finish', () => {
            resolve(dest);
          });
        } else {
          close(res.statusMessage);
        }
      });

      req.on('error', err => {
        close(err.message);
      });

      req.setTimeout(10000, () => {
        abort('Timed out');
      });

      const close = (msg) => {
        file.close();
        fsp.unlink(dest);
        reject(msg);
      };

      const abort = (msg) => {
        req.abort();
        close(msg);
      };
    });
  });
}

async function publish(source, name) {
  const publicPath = await makePublicDest();
  const dest = path.join(publicPath, name);
  await fsp.rename(source, dest);
  return getFileDownloadUrl(dest);
}

async function makePublicDest() {
  const uuid = crypto.randomBytes(16).toString('hex');
  const timestamp = new Date().getTime();
  const publicPath = path.join(PUBLIC_DIR, `${timestamp}${uuid}`);
  await fsp.mkdir(publicPath, {recursive: true});
  return publicPath;
}

function getFileDownloadUrl(dest) {
  const uri = url.pathToFileURL(dest).href.slice(PUBLIC_DIR.length - dest.length);
  return encodeURI(`/download${uri}`);
}

module.exports = {
  MAX_FILE_SIZE,
  PUBLIC_DIR,
  UPLOAD_DIR,
  shakeStorage,
  upload,
  download,
  publish,
};
