const glob = require("glob");
const sharp = require('sharp');
const fs = require('fs-extra');
const { igcExtract, igcToBounds, lat2tile, long2tile, tile2lat, tile2long } = require('./igcTools.js');
// const ZOOMS = [12, 13, 14, 15, 16, 17, 18, 19, 20];
const ZOOMS = [12, 13, 14, 15, 16];
const TILESIZE = 256;
sharp.cache({ files: 1 });

function createTile(x, y, ZOOM) {
  try {
    const target = `./tiles/${ZOOM}/${x}/`;
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

function mergeTile(x, y, ZOOM, buffer, options = {}) {
  try {
    const target = `./tiles/${ZOOM}/${x}/`;
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
      })
      .catch(err => {
        console.log('input err', x, y, err);
      });
  } catch (error) {
    Promise.reject(error);
  }
}

function computeTileBounds(image, ZOOM) {
  try {
    // tiles for this image 
    let tileBounds = {
      top: {
        tile: lat2tile(image.bounds.TL.lat, ZOOM),
      },
      bottom: {
        tile: lat2tile(image.bounds.BR.lat, ZOOM),
      },
      left: {
        tile: long2tile(image.bounds.TL.lng, ZOOM),
      },
      right: {
        tile: long2tile(image.bounds.BR.lng, ZOOM),
      }
    };

    // decalage image en PX par rapport à ces tiles
    // ex pour le top. à combien de Px du top se trouve le debut de l'image
    let tileTopLat = tile2lat(tileBounds.top.tile, ZOOM);
    let tileTopLatNext = tile2lat(tileBounds.top.tile + 1, ZOOM);
    tileBounds.top.decalage = Math.abs(parseInt((image.bounds.TL.lat - tileTopLat) / (tileTopLatNext - tileTopLat) * TILESIZE));

    let tileLeftLng = tile2long(tileBounds.left.tile, ZOOM);
    let tileLeftLngNext = tile2long(tileBounds.left.tile + 1, ZOOM);
    tileBounds.left.decalage = Math.abs(parseInt((image.bounds.TL.lng - tileLeftLng) / (tileLeftLngNext - tileLeftLng) * TILESIZE));

    return tileBounds;
  } catch (error) {
    console.log(error);
  }

}

function computeImageSize(image, ZOOM) {
  try {
    let x1 = tile2long(long2tile(image.bounds.TL.lng, ZOOM), ZOOM);
    let x2 = tile2long(long2tile(image.bounds.TL.lng, ZOOM) + 1, ZOOM);
    let lngperpx = (x2 - x1) / TILESIZE;

    let fileSizeInLng = image.bounds.TR.lng - image.bounds.TL.lng;

    let newWidth = parseInt(fileSizeInLng / lngperpx);
    let newHeight = parseInt(newWidth * image.h / image.w);

    let result = {
      width: newWidth,
      height: newHeight
    }
    return result;
  } catch (error) {
    console.log(error);
  }

}

function sliceImage(file, image, ZOOM) {
  try {

    // compute useful values
    let imgSize = computeImageSize(image, ZOOM);
    let tileBounds = computeTileBounds(image, ZOOM);

    let pSlices = [];


    let sX = 0;
    let sY = 0;

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
          extract.width = imgSize.width;
          decalage.left = tileBounds.left.decalage;

        }
        else if (x === tileBounds.left.tile) {
          debugString.row = ' premiere tile de la ligne';
          extract.width = TILESIZE - tileBounds.left.decalage;
          decalage.left = tileBounds.left.decalage;

        }
        else if (x === tileBounds.right.tile) {
          debugString.row = ' derniere tile de la ligne';
          extract.left = (sX * TILESIZE) - tileBounds.left.decalage;
          extract.width = imgSize.width - (sX * TILESIZE) + tileBounds.left.decalage;
        }
        else {
          debugString.row = ' tile intermediaire de la ligne';
          extract.left = (sX * TILESIZE) - tileBounds.left.decalage - 1;
        }

        if (y === tileBounds.top.tile && y === tileBounds.bottom.tile) {
          debugString.col = ' premiere et derniere tile de la colonne';
          extract.height = imgSize.height;
          decalage.top = tileBounds.top.decalage;

        }
        else if (y === tileBounds.top.tile) {
          debugString.col = ' premiere tile de la colonne';
          extract.height = TILESIZE - tileBounds.top.decalage;
          decalage.top = tileBounds.top.decalage;

        }
        else if (y === tileBounds.bottom.tile) {
          debugString.col = ' derniere tile de la colonne';
          extract.top = (sY * TILESIZE) - tileBounds.top.decalage;
          extract.height = imgSize.height - (sY * TILESIZE) + tileBounds.top.decalage;
        }
        else {
          debugString.col = ' tile intermediaire de la colonne';
          extract.top = (sY * TILESIZE) - tileBounds.top.decalage - 1;
        }

        if (extract.width > 0 && extract.height > 0 && extract.width <= TILESIZE && extract.height <= TILESIZE) {
          // define Slice promise for creating a tile at this ZOOM level

          let pSlice = createTile(x, y, ZOOM)
            .then((message) => {

              return sharp(file)
                .clone()
                .resize(
                imgSize.width,
                imgSize.height
                )
                .extract({ left: extract.left, top: extract.top, width: extract.width, height: extract.height })
                .toBuffer()
                .then((extractedBuffer) => {
                  return mergeTile(x, y, ZOOM, extractedBuffer, decalage);
                })
                .catch(err => {
                  console.log('merge', err);
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
    Promise.reject(error);
  }
}

// iterate on all files in the input folder
glob("planches/in/*.jpg", function (er, files) {
  files.forEach((file) => {

    igcExtract(file)
      .then(data => {
        return igcToBounds(data);
      })
      .then(image => {
        console.log("************START*************");
        console.log(file);
        let pSliceImage = []; // array for Slicing Promises

        ZOOMS.forEach(ZOOM => {
          pSliceImage.push(sliceImage(file, image, ZOOM));
        });

        // resolve all Slicing Promises
        return Promise
          .all(pSliceImage)
          .then((results) => {
            console.log("************END*************");
            console.log(results);
            // then move the file
            // fs.moveSync(file, 'planches/out/' + image.fic, function (err) {
            //   if (err) { throw err; }
            // });
          })
          .catch((errors) => {
            console.log(errors);
          })
      })
      .catch((err) => {
        console.log('catch', err);
      });

  })
});
