'use strict';

const multer = require('multer');
const path = require('path');

const uploadedFilesDir = path.join(__dirname, '..', 'files', 'uploaded');
module.exports = multer({dest: uploadedFilesDir})