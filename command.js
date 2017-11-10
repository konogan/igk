const glob = require("glob");
const { igcExtract, igcWorldFile } = require('./igcTools.js');




glob("planchesIn/*.jpg", function (er, files) {
  files.forEach((file) => {
    igcExtract(file)
      .then((data) => {
        return igcWorldFile(data);
      })
      .catch((err) => {
        console.log('catch', err);
      })
  })
})

