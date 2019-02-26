'use strict';

const router = require('../lib/router-async').create();
const pdfExport = require('../lib/pdf-export');
const {enforce} = require('../lib/helpers');

router.getAsync('/:pdfKey', async (req, res) => {
    const pdfKey = req.params.pdfKey;
    console.log(pdfKey);

    const fileEntry = pdfExport.getPdfFileEntry(req.context, pdfKey);
    if (!fileEntry) {
        const err = new Error('Not Found');
        err.status = 404;
        throw err;
    }

    res.type('application/pdf');

    return res.download(fileEntry.path, fileEntry.fileName);
});

module.exports = router;
