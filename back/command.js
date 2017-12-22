'use strict';

const fs = require('fs-extra');
const { igcExtract, igcToBounds } = require('./libs/igcTools.js');
const { slippySlice } = require('./libs/slippyTools.js');

const ZOOMS = '12-13';
const PLANCHES_IN = __dirname + '/planches/in';
const PLANCHES_OUT = __dirname + '/planches/out';
const TILES_FOLDER = __dirname + '/../app/tilesTest';


const moveFile = (file) => {
  fs.moveSync(`${PLANCHES_IN}/${file}`, `${PLANCHES_OUT}/${file}`, { overwrite: true })
}

/**
 * Process tous les fichiers d'un dossier
 * @param {String} path 
 */
const processDirectory = async (path) => {
  try {
    const files = fs.readdirSync(path);
    if (files.length === 0) {
      console.log('pas de fichier a traiter');
    }
    for (let file of files) {
      if (file.substring(file.indexOf('.')) === '.jpg') {
        try {
          let fileToProcess = path + '/' + file;
          let result = await processFile(fileToProcess);
          // if (result.every(res => { return res == true; })) {
          //moveFile(file);
          // }
        } catch (error) {
          console.log(' error', error);
          continue;
        }
      }
    }
  } catch (error) {
    console.log('processDirectory', error);
  }
}

/**
 * Lance les process de decoupage du fichier
 * @param {String} file 
 */
const processFile = async (file) => {
  try {
    let datas = await igcExtract(file);
    let image = await igcToBounds(datas);
    let result = await slippySlice(
      image.file,
      image.bounds,
      image.size,
      ZOOMS,
      TILES_FOLDER);
    return result;
  } catch (error) {
    console.log('processFile : ', error);
  }

}


processDirectory(PLANCHES_IN);


