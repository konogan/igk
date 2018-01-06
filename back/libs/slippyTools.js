
'use strict';
const sharp = require('sharp');
const fs = require('fs-extra');
const util = require('util');
const path = require('path');
const progressBar = require('cli-progress');

const { lat2tile, long2tile, tile2lat, tile2long } = require('./igcTools.js');
const { TILESIZE } = require('./configuration.js');
const { sharpTileGetBuffer, sharpResizeImage, sharpExtractBuffer, sharpMergeBuffer } = require('./sharpTile.js');

/**
 * 
 * @param {String} imagePath    path of image to slice
 * @param {Object} WSG884Bounds top,bottom,left,right WSG84 lat or long
 * @param {Object} size         original image size
 * @param {String} zooms        levelOfZooms, integer or string with -, eg : 12 or 12-20
 * @param {String} pathOut      path of folder containing generated tiles
 */

const slippySlice = async (imagePathIn, WSG884Bounds, size, zooms, pathOut) => {

  try {
    let plevelOfZooms = [];
    let levelOfZooms = _levelsOfZoom(zooms);

    for (const zoomLevel of levelOfZooms) {
      await _slippySliceAtZoom(imagePathIn, WSG884Bounds, size, zoomLevel, pathOut);
    }

  } catch (error) {
    return Promise.reject(error);
  }

}

const _levelsOfZoom = (zoomString) => {
  let levelOfZooms = [];
  if (zoomString.indexOf('-') === -1) {
    levelOfZooms.push(zoomString);
  } else {
    for (let zoomLevel = zoomString.split('-')[0]; zoomLevel <= zoomString.split('-')[1]; zoomLevel++) {
      levelOfZooms.push(zoomLevel);
    }
  }
  return levelOfZooms;
}

const _computeSlices = async (imagePathIn, WSG884Bounds, size, zoom) => {
  try {

    let sX = 0;
    let sY = 0;
    let slices = [];
    let imgSize = await _computeImageSize(WSG884Bounds, size, zoom);
    let tileBounds = _computeTileBounds(WSG884Bounds, zoom);

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
          let slice = {
            x: x,
            y: y,
            extractor: { left: extract.left, top: extract.top, width: extract.width, height: extract.height },
            decalage: decalage
          };
          slices.push(slice);
        }
        sY++;
      }
      sX++;
      sY = 0;
    }
    return slices;
  } catch (error) {
    console.log('_computeSlices', error);
  }
}

const _slippySliceAtZoom = async (imagePathIn, WSG884Bounds, size, zoom, pathOut) => {
  try {
    var zoomBar = new progressBar.Bar({
      format: 'zoom level ' + zoom + ' [{bar}] {percentage}% | ETA: {eta}s | {value}/{total}'
    }, progressBar.Presets.shades_classic);


    let imgSize = await _computeImageSize(WSG884Bounds, size, zoom);
    let slices = await _computeSlices(imagePathIn, WSG884Bounds, size, zoom);
    let sharpImageResized = await sharpResizeImage(imagePathIn, imgSize);
    zoomBar.start(slices.length, 0);
    for (const slice of slices) {
      await _processSlice(pathOut, zoom, slice, sharpImageResized, imagePathIn);
      zoomBar.increment();
    }
    // each slices can be resolve simultanuously
    // let pSlices = [];
    // for (const slice of slices) {
    //   pSlices.push(await _processSlice(pathOut, zoom, slice, sharpImageResized, imagePathIn));
    // }
    // await Promise.all(pSlices);
    zoomBar.stop();
  } catch (error) {
    console.log('_slippySliceAtZoom : ' + error);
  }
}

const _processSlice = async (pathOut, zoom, slice, sharpImageResized, imagePathIn) => {
  //console.group(`slice start `);
  const target = `${pathOut}/${zoom}/${slice.x}`;
  const name = `${slice.y}.png`;
  const myPath = path.join(target, name);
  try {
    let currentTileContent = await sharpTileGetBuffer(target, name);
    let extractedBuffer = await sharpExtractBuffer(sharpImageResized, slice.extractor);
    let mergeBuffer = await sharpMergeBuffer(currentTileContent, extractedBuffer, slice.decalage);
    fs.writeFileSync(myPath, mergeBuffer);

  } catch (error) {
    console.log('_processSlice ERROR', error);
  }
  //console.groupEnd();
}


const _computeImageSize = async (WSG884Bounds, size, ZOOM) => {
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
    console.log('_computeTileBounds', error);
  }
}


module.exports.slippySlice = slippySlice;