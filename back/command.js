'use strict';

const fs = require('fs-extra');
const { igcExtract, igcToBounds } = require('./libs/igcTools.js');
const { slippySlice } = require('./libs/slippyTools.js');

const ZOOMS = '12-20';
const PLANCHES_IN = './planches/in';
const PLANCHES_OUT = './planches/out';
const TILES_FOLDER = '../app/tiles';

/**
 * Recupere tous les fichiers d'un dossier
 * @param {String} path 
 */
const getFilePaths = async (path) => {
  const files = [];
  return new Promise(function (resolve, reject) {
    fs.readdir(path, function (err, items) {
      if (err) {
        reject(err);
      }
      resolve(items);
    });
  });
}

const moveFile = (file) => {
  fs.moveSync(`${PLANCHES_IN}/${file}`, `${PLANCHES_OUT}/${file}`, { overwrite: true })
}

/**
 * Process tous les fichiers d'un dossier
 * @param {String} path 
 */
const processDirectory = async (path) => {
  const files = await getFilePaths(path);

  for (let file of files) {
    if (file.substring(file.indexOf('.')) === '.jpg') {
      try {
        let fileToProcess = path + '/' + file;
        console.log('file', file);
        let result = await processFile(fileToProcess);
        if (result.every(res => { return res == true; })) {
          moveFile(file);
        }
      } catch (error) {
        console.log(' error', error);
        continue;
      }
    }
  }
}

/**
 * Lance les process de decoupage du fichier
 * @param {String} file 
 */
const processFile = async (file) => {
  let datas = await igcExtract(file);
  let image = await igcToBounds(datas);
  let result = await slippySlice(
    image.file,
    image.bounds,
    image.size,
    ZOOMS,
    TILES_FOLDER);

  return result;
}


processDirectory(PLANCHES_IN);


