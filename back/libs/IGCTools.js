'use strict';

const proj4 = require('proj4');
const Promise = require('promise');
const { promisify } = require('util');
const sizeOf = promisify(require('image-size'));

const fs = require('fs-extra');

proj4.defs('EPSG:27571', '+proj=lcc +lat_1=49.50000000000001 +lat_0=49.50000000000001 +lon_0=0 +k_0=0.999877341 +x_0=600000 +y_0=1200000 +a=6378249.2 +b=6356515 +towgs84=-168,-60,320,0,0,0,0 +pm=paris +units=m +no_defs');
const source = new proj4.Proj('EPSG:27571'); // Lambert I
const destination = new proj4.Proj('WGS84'); // Google

const LambertIX = 584400;
const LambertIY = 1146224;
const plancheWidth = 600;
const plancheHeight = -400;

/**
  Generate the WorldFile for the current data
  TL--------TR
  |         |
  |   x,y   |
  |         |
  BL--------BR

 * @param {int} x 
 * @param {int} y 
 */
const igcWorldFile = (data) => {
  let x = data.igc.x;
  let y = data.igc.y;
  let w = data.w;
  let h = data.h;
  const ox = LambertIX + x * plancheWidth;
  const oy = LambertIY + y * plancheHeight;
  const rx = plancheWidth / w;
  const ry = plancheHeight / h;
  const output = [rx, '0', '0', ry, ox, oy].join('\n');
  const fileOut = data.file.slice(0, -1) + 'w';
  return fs.outputFile(fileOut, output);
};


/**
  Transform x,y IGC coordinate to 4 WGS54 lat/long coord (TopLeft, TopRight, BottomLeft,BottomRight)
  TL--------TR
  |         |
  |   x,y   |
  |         |
  BL--------BR

 * @param {int} x 
 * @param {int} y 
 */
const igcToBounds = async (data) => {
  let x = data.igc.x;
  let y = data.igc.y;
  return new Promise(function (fulfill, reject) {
    let _left = LambertIX + x * plancheWidth;
    let _right = _left + plancheWidth;
    let _bottom = (LambertIY + y * plancheHeight) + plancheHeight;
    let _top = _bottom - plancheHeight;
    try {
      const BL = new proj4.toPoint([_left, _bottom]);
      const BLWS = proj4.transform(source, destination, BL);

      const BR = new proj4.toPoint([_right, _bottom]);
      const BRWS = proj4.transform(source, destination, BR);

      const TL = new proj4.toPoint([_left, _top]);
      const TLWS = proj4.transform(source, destination, TL);

      const TR = new proj4.toPoint([_right, _top]);
      const TRWS = proj4.transform(source, destination, TR);

      let bounds =
        {
          top: TLWS.y,
          right: TRWS.x,
          left: BLWS.x,
          bottom: BRWS.y
        };
      data.bounds = bounds;
      fulfill(data);

    }
    catch (e) {
      reject(e);
    }

  });
};

/**
 * Extract igc coord from fileName 
 * @param {String} fileName 
 */
const igcExtract = async (filePath) => {
  const originalFilePath = filePath;
  const originalFilename = filePath.split("/").pop();
  return new Promise(function (fulfill, reject) {
    let dataName = originalFilename.split('.')[0].split('-');
    if ((dataName.length === 3 || dataName.length === 2) && originalFilename.split('!').length === 1) {
      return sizeOf(originalFilePath)
        .then(dimensions => {
          const output = {
            file: originalFilePath,
            fic: originalFilename,
            size: {
              w: dimensions.width,
              h: dimensions.height
            },
            igc: {
              x: dataName[0],
              y: dataName[1]
            },
            year: dataName[2] || null
          };
          fulfill(output)
        })
        .catch(function (err) {
          reject(err);
        });
    }
  });
};



// lat long utils for slippy map system
function long2tile(lon, zoom) {
  return (Math.floor((lon + 180) / 360 * Math.pow(2, zoom)));
}

function lat2tile(lat, zoom) {
  return (Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom)));
}

function tile2long(x, zoom) {
  return (x / Math.pow(2, zoom) * 360 - 180);
}

function tile2lat(y, zoom) {
  var n = Math.PI - 2 * Math.PI * y / Math.pow(2, zoom);
  return (180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))));
}


module.exports.igcExtract = igcExtract;
module.exports.igcToBounds = igcToBounds;
module.exports.igcWorldFile = igcWorldFile;
module.exports.long2tile = long2tile;
module.exports.lat2tile = lat2tile;
module.exports.tile2long = tile2long;
module.exports.tile2lat = tile2lat;