'use strict';

const fs = require('fs-extra');
const { igcExtract, igcToBounds } = require('./igcTools.js');
const { slippySlice } = require('./slippyTools.js');

const ZOOMS = '12-18';
const PLANCHES_IN = './planches/in';
const TILES = './tiles/';

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

/**
 * Process tous les fichiers d'un dossier
 * @param {String} path 
 */
const processDirectory = async (path) => {
  const files = await getFilePaths(path);

  for (let file of files) {
    if (file.substring(file.indexOf('.')) === '.jpg') {
      let fileToProcess = path + '/' + file;
      console.log(fileToProcess);
      let result = await processFile(fileToProcess);
      //return result;
    }
  }
}

/**
 * Lance les process de decoupage du fichier
 * @param {String} file 
 */
const processFile = async (file) => {

  return igcExtract(file)
    .then(data => {
      return igcToBounds(data);
    })
    .then(image => {
      return slippySlice(
        image.file,
        image.bounds,
        image.size,
        ZOOMS,
        TILES).catch(err => {
          console.log('Error : ', err);
        })
    });
}

processDirectory(PLANCHES_IN);


