'use strict';

const puppeteer = require('puppeteer');
const users = require('../models/users');
const {getSandboxUrl} = require('./urls');
const files = require('../models/files');
const fs = require('fs-extra-promise');
const path = require('path');
const moment = require('moment');
const shortid = require('shortid');

const pdfDir = path.join(files.filesDir, 'pdf');

const filesMap = new Map(); // userId -> file identifier -> { fileName, ts }

const maxPdfFileAge = 5 * 60 * 1000;
const pruneOldPdfInterval = 60 * 1000;

async function init() {
    await fs.emptyDirAsync(pdfDir);

    setTimeout(pruneOldPdfs, pruneOldPdfInterval);
}

async function pruneOldPdfs() {
    const tsLimit = moment.utc() - maxPdfFileAge;

    for (const userFilesMap of filesMap.values()) {
        for (const [fileKey, fileEntry] of userFilesMap.entries()) {
            if (fileEntry.ts < tsLimit) {
                userFilesMap.delete(fileKey);
                await fs.unlinkAsync(fileEntry.path);
            }
        }
    }

    setTimeout(pruneOldPdfs, pruneOldPdfInterval);
}

async function panel(context, panelId, permanentLinkConfig, timeZone) {
    pruneOldPdfs();

    const userId = context.user.id;

    let userFilesMap = filesMap.get(userId);
    if (!userFilesMap) {
        userFilesMap = new Map();
        filesMap.set(userId, userFilesMap);
    }

    const pdfKey = 'panel-' + panelId + (permanentLinkConfig ? '-' + permanentLinkConfig : '');
    const fileEntry = userFilesMap.get(pdfKey);

    if (fileEntry) {
        if (fileEntry.ready) {
            fileEntry.ts = moment.utc();

            return pdfKey;

        } else {
            return null;
        }

    } else {
        const userDir = path.join(pdfDir, userId.toString());
        await fs.ensureDir(userDir);

        const fileName = shortid.generate() + '.pdf';

        const fileEntry = {
            fileName,
            path: path.join(userDir, fileName),
            ready: false
        };

        userFilesMap.set(pdfKey, fileEntry);


        const restrictedAccessToken = await users.getRestrictedAccessToken(context, 'panel', {panelId});

        const searchParams = {};
        if (permanentLinkConfig) {
            searchParams.config = permanentLinkConfig;
        }

        const panelUrl = getSandboxUrl(
            'panel/' + panelId,
            context,
            {
                restrictedAccessToken,
                searchParams
            }
        );

        setImmediate(async () => {
            const browser = await puppeteer.launch({
                headless: true,
                args: [
                    '--no-sandbox'
                ],
                env: {
                    TZ: timeZone,
                    ...process.env
                },
                defaultViewport: { // A4 is supposedly 794 x 1122, but the width below works with the 15px margin
                    width: 780,
                    height: 1122,
                    deviceScaleFactor: 1
                }
            });

            const page = await browser.newPage();
            await page.goto(panelUrl, {waitUntil: 'networkidle0'});
            await page.pdf({path: fileEntry.path, preferCSSPageSize: true, printBackground: true});

            await browser.close();

            fileEntry.ts = moment.utc();
            fileEntry.ready = true;
        });

        return null;
    }
}

function getPdfFileEntry(context, pdfKey) {
    const userId = context.user.id;

    let userFilesMap = filesMap.get(userId);
    if (!userFilesMap) {
        return null;
    }

    return userFilesMap.get(pdfKey);
}

module.exports.init = init;
module.exports.panel = panel;
module.exports.getPdfFileEntry = getPdfFileEntry;
