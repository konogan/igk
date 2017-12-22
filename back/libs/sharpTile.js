'use strict';
const sharp = require('sharp');
const path = require('path');
const fs = require('fs-extra');

const { TILESIZE } = require('./configuration.js');



const isDir = async (f) => {
  try {
    return (await fs.stat(f)).isDirectory();
  }
  catch (e) {
    return false;
  }
}

const isFile = async (f) => {
  try {
    return (await fs.stat(f)).isFile();
  }
  catch (e) {
    return false;
  }
}

const isValidTile = async (f) => {
  try {
    return await sharp(f)
      .metadata()
      .then(metadata => {
        return true
      }).catch(e => {
        return false;
      });
  } catch (e) {
    return false;
  }
}


/**
 * retourne le buffer sharp d'une tuile
 * si cette derniere n'existe pas : la fabrique
 * si son chemin n'existe pas : le créé
 * si son contenu n'est pas valide : la remplace
 */

const sharpTileGetBuffer = async (_path, _file) => {
  //console.log(' 1 - sharpTileGetBuffer');
  let myFullPath = path.join(_path, _file);
  try {
    let content = await sharpEmptyTileBuffer();
    let tV = await isValidTile(myFullPath);
    if (!tV && fs.pathExistsSync(myFullPath)) {
      console.log('invalide tile, need to rebuilt it', _file);
      fs.unlinkSync(myFullPath);
    }
    fs.outputFileSync(myFullPath, content);
    return fs.readFileSync(myFullPath);
  } catch (error) {
    throw new Error('sharpTileGetBuffer : ' + error);
  }
}

const sharpEmptyTileBuffer = async () => {
  return await new Promise((resolve, reject) => {
    try {
      sharp({
        create: {
          width: TILESIZE,
          height: TILESIZE,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0.0 }
        }
      })
        .png()
        .toBuffer()
        .then(buffer => {
          resolve(buffer);
        })
        .catch(error => {
          reject(error);
        });
    } catch (error) {
      reject(error);
    }
  });
}

const sharpGetBuffer = (imagePathIn) => {
  return new Promise((resolve, reject) => {
    try {
      sharp(imagePathIn)
        .png()
        .toBuffer()
        .then(buffer => {
          resolve(buffer);
        })
        .catch(error => {
          reject(error);
        });
    } catch (error) {
      reject(error);
    }
  });
}

const sharpResizeImage = async (imagePathIn, size) => {
  return await new Promise((resolve, reject) => {
    try {
      sharp(imagePathIn)
        .resize(size.width, size.height)
        .png()
        .toBuffer()
        .then(buffer => {
          resolve(buffer);
        })
        .catch(error => {
          reject(error);
        });
    } catch (error) {
      reject(error);
    }
  });
}

const sharpExtractBuffer = async (sharpResizedBuffer, extractor) => {
  return await new Promise((resolve, reject) => {
    try {
      //console.log(' 2 - sharpExtractBuffer from image');
      sharp(sharpResizedBuffer)
        .extract(extractor)
        .toBuffer()
        .then(buffer => {
          resolve(buffer);
        })
        .catch(error => {
          reject(error);
        });
    } catch (error) {
      reject(error);
    }
  });
}

const sharpMergeBuffer = async (tileBuffer, buffer, decalage) => {
  return await new Promise((resolve, reject) => {
    try {
      //console.log(' 3 - sharpMergeBuffer on tile');
      sharp(tileBuffer)
        .overlayWith(buffer, decalage)
        .png()
        .toBuffer()
        .then(buffer => {
          resolve(buffer);
        })
        .catch(error => {
          reject(error);
        });
    } catch (error) {
      reject(error);
    }
  });
}


module.exports.sharpEmptyTileBuffer = sharpEmptyTileBuffer;
module.exports.sharpResizeImage = sharpResizeImage;
module.exports.sharpExtractBuffer = sharpExtractBuffer;
module.exports.sharpMergeBuffer = sharpMergeBuffer;
module.exports.sharpGetBuffer = sharpGetBuffer;
module.exports.sharpTileGetBuffer = sharpTileGetBuffer;