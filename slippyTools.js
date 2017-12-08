'use strict';
const sharp = require('sharp');
const fs = require('fs-extra');
// var ProgressBar = require('progress');

const { lat2tile, long2tile, tile2lat, tile2long } = require('./igcTools.js');

// sharp.cache({ files: 1 });

const TILESIZE = 256;

/**
 * 
 * @param {String} imagePath    path of image to slice
 * @param {Object} WSG884Bounds top,bottom,left,right WSG84 lat or long
 * @param {Object} size         original image size
 * @param {String} zooms        levelOfZooms, integer or string with -, eg : 12 or 12-20
 * @param {String} pathOut      path of folder containing generated tiles
 */

const slippySlice = async (imagePathIn, WSG884Bounds, size, zooms, pathOut) => {
  if (typeof imagePathIn === 'undefined') {
    return Promise.reject('imagePathIn is missing / not defined');
  }
  if (typeof WSG884Bounds === 'undefined' ||
    typeof WSG884Bounds.top === 'undefined' ||
    typeof WSG884Bounds.bottom === 'undefined' ||
    typeof WSG884Bounds.left === 'undefined' ||
    typeof WSG884Bounds.right === 'undefined'
  ) {
    return Promise.reject('WSG884Bounds is missing / not defined / not well defined');
  }
  if (typeof zooms === 'undefined') {
    return Promise.reject('zoom is missing / not defined');
  }
  if (typeof pathOut === 'undefined') {
    return Promise.reject('pathOut is missing / not defined');
  }

  try {
    let levelOfZooms = [];

    if (zooms.indexOf('-') === -1) {
      levelOfZooms.push(zooms);
    } else {
      for (let zoomLevel = zooms.split('-')[0]; zoomLevel <= zooms.split('-')[1]; zoomLevel++) {
        levelOfZooms.push(zoomLevel);
      }
    }

    let pSliceAtZoom = [];
    levelOfZooms.forEach(zoomLevel => {
      pSliceAtZoom.push(_slippySliceAtZoom(imagePathIn, WSG884Bounds, size, zoomLevel, pathOut))
    })

    return await Promise.all(pSliceAtZoom);

  } catch (error) {
    return Promise.reject(error);
  }


}

const _slippySliceAtZoom = (imagePathIn, WSG884Bounds, size, zoom, pathOut) => {
  try {
    // console.log('');
    // console.log('-----------------------------------------');
    // console.log('_slippySliceAtZoom', { imagePathIn, WSG884Bounds, size, zoom, pathOut });

    // compute useful values
    let imgSize = _computeImageSize(WSG884Bounds, size, zoom);
    let tileBounds = _computeTileBounds(WSG884Bounds, zoom);
    let pSlices = [];

    let sX = 0;
    let sY = 0;

    // let total = (tileBounds.right.tile - tileBounds.left.tile) * (tileBounds.bottom.tile - tileBounds.top.tile);

    // var bar = new ProgressBar('  generating zoom ' + zoom + ' [:bar] :percent :etas', {
    //   complete: '='
    //   , incomplete: ' '
    //   , width: 20
    //   , total: total
    // });

    for (let x = tileBounds.left.tile; x <= tileBounds.right.tile; x++) {
      for (let y = tileBounds.top.tile; y <= tileBounds.bottom.tile; y++) {
        // ce qui faut extraire de l'image d'origine resizée
        let debugString = {
          col: null,
          row: null
        }
        let extract = {
          width: TILESIZE,
          height: TILESIZE,
          left: 0,
          top: 0
        };
        // ou doit s'inserrer l'extraction sur une TILE vierge
        let decalage = {
          left: 0,
          top: 0
        };

        if (x === tileBounds.left.tile && x === tileBounds.right.tile) {
          debugString.row = ' premiere et derniere tile de la ligne';
          extract.width = Math.floor(imgSize.width);
          decalage.left = Math.floor(tileBounds.left.decalage);

        }
        else if (x === tileBounds.left.tile) {
          debugString.row = ' premiere tile de la ligne';
          extract.width = Math.floor(TILESIZE - tileBounds.left.decalage);
          decalage.left = Math.floor(tileBounds.left.decalage);

        }
        else if (x === tileBounds.right.tile) {
          debugString.row = ' derniere tile de la ligne';
          extract.left = Math.floor((sX * TILESIZE) - tileBounds.left.decalage);
          extract.width = Math.floor(imgSize.width - (sX * TILESIZE) + tileBounds.left.decalage);
        }
        else {
          debugString.row = ' tile intermediaire de la ligne';
          extract.left = Math.floor((sX * TILESIZE) - tileBounds.left.decalage - 1);
        }

        if (y === tileBounds.top.tile && y === tileBounds.bottom.tile) {
          debugString.col = ' premiere et derniere tile de la colonne';
          extract.height = Math.floor(imgSize.height);
          decalage.top = Math.floor(tileBounds.top.decalage);

        }
        else if (y === tileBounds.top.tile) {
          debugString.col = ' premiere tile de la colonne';
          extract.height = Math.floor(TILESIZE - tileBounds.top.decalage);
          decalage.top = Math.floor(tileBounds.top.decalage);

        }
        else if (y === tileBounds.bottom.tile) {
          debugString.col = ' derniere tile de la colonne';
          extract.top = Math.floor((sY * TILESIZE) - tileBounds.top.decalage);
          extract.height = Math.floor(imgSize.height - (sY * TILESIZE) + tileBounds.top.decalage);
        }
        else {
          debugString.col = ' tile intermediaire de la colonne';
          extract.top = Math.floor((sY * TILESIZE) - tileBounds.top.decalage - 1);
        }

        if (extract.width > 0 && extract.height > 0 && extract.width <= TILESIZE && extract.height <= TILESIZE) {
          // define Slice promise for creating a tile at this ZOOM level

          let pSlice = _createTile(x, y, zoom, pathOut)
            .then((message) => {
              //console.log(message);
              return sharp(imagePathIn)
                .clone()
                .resize(
                imgSize.width,
                imgSize.height
                )
                .extract({ left: extract.left, top: extract.top, width: extract.width, height: extract.height })
                .toBuffer()
                .then((extractedBuffer) => {
                  return _mergeTile(x, y, zoom, pathOut, extractedBuffer, decalage);
                }).then(info => {
                  // bar.tick();
                })
                .catch(err => {
                  return Promise.reject('merge ' + err);
                });
            });
          pSlices.push(pSlice);
        }
        sY++;
      }
      sX++;
      sY = 0;
    }
    return Promise.all(pSlices);
  } catch (error) {
    return Promise.reject(error);
  }
}

const _computeImageSize = (WSG884Bounds, size, ZOOM) => {
  try {
    let x1 = tile2long(long2tile(WSG884Bounds.left, ZOOM), ZOOM);
    let x2 = tile2long(long2tile(WSG884Bounds.left, ZOOM) + 1, ZOOM);
    let lngperpx = (x2 - x1) / TILESIZE;

    let fileSizeInLng = WSG884Bounds.right - WSG884Bounds.left;

    let newWidth = Math.floor(fileSizeInLng / lngperpx);
    let newHeight = Math.floor(newWidth * size.h / size.w);

    let result = {
      width: newWidth,
      height: newHeight
    }
    return result;
  } catch (error) {
    console.log(error);
  }

}



const _computeTileBounds = (WSG884Bounds, ZOOM) => {
  try {
    // tiles for this image 
    let tileBounds = {
      top: {
        tile: lat2tile(WSG884Bounds.top, ZOOM),
      },
      bottom: {
        tile: lat2tile(WSG884Bounds.bottom, ZOOM),
      },
      left: {
        tile: long2tile(WSG884Bounds.left, ZOOM),
      },
      right: {
        tile: long2tile(WSG884Bounds.right, ZOOM),
      }
    };

    // decalage image en PX par rapport à ces tiles
    // ex pour le top. à combien de Px du top se trouve le debut de l'image
    let tileTopLat = tile2lat(tileBounds.top.tile, ZOOM);
    let tileTopLatNext = tile2lat(tileBounds.top.tile + 1, ZOOM);
    tileBounds.top.decalage = Math.floor(parseInt((WSG884Bounds.top - tileTopLat) / (tileTopLatNext - tileTopLat) * TILESIZE));

    let tileLeftLng = tile2long(tileBounds.left.tile, ZOOM);
    let tileLeftLngNext = tile2long(tileBounds.left.tile + 1, ZOOM);
    tileBounds.left.decalage = Math.floor(parseInt((WSG884Bounds.left - tileLeftLng) / (tileLeftLngNext - tileLeftLng) * TILESIZE));

    return tileBounds;
  } catch (error) {
    console.log(error);
  }
}

const _createTile = (x, y, ZOOM, pathOut) => {
  try {
    const target = `${pathOut}/${ZOOM}/${x}/`;
    const name = `${y}.png`;
    if (!fs.pathExistsSync(target + name)) {
      fs.mkdirsSync(target);
      // create empty sharp object ans save it 
      return sharp({
        create: {
          width: TILESIZE,
          height: TILESIZE,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0.0 }
        }
      })
        .png()
        .toBuffer()
        .then((sharpBuffer) => {
          return new Promise(function (resolve, reject) {
            fs.writeFile(target + name, sharpBuffer, function (err) {
              if (err) reject(err);
              else resolve(`${x} ${y} C`);
            });
          });
        });
    }
    else {
      return Promise.resolve('tile file already exist : ' + target + name);
    }
  } catch (error) {
    Promise.reject(error);
  }
}

const _mergeTile = (x, y, ZOOM, pathOut, buffer, options = {}) => {
  try {
    const target = `${pathOut}/${ZOOM}/${x}/`;
    let name = `${y}.png`;

    return sharp(target + name)
      .overlayWith(buffer, options)
      .toBuffer()
      .then(sharpBuffer => {
        return new Promise(function (resolve, reject) {
          fs.writeFile(target + name, sharpBuffer, function (err) {
            if (err) reject(err);
            else resolve(`${x} ${y} M`);
          });
        });
      });

  } catch (error) {
    Promise.reject(error);
  }
}

module.exports.slippySlice = slippySlice;