const path = require('path');
const fse = require('fs-extra');
const resizeImg = require('resize-img')


const { RESULT_FOLDER, IMAGES_FOLDER } = require('./constants');

// ---

async function resize(imagePath, file, {
  dateTime,
  width,
  height
}) {
  let image;
  try {
    image = await resizeImg(file, {
      width,
      height,
    });
  }
  catch (err) {
    console.error('Не получилось изменить размер картинки')
    console.error(err);
    throw err;
  }

  if (!image) {
    return null;
  }

  try {
    await fse.outputFile(path.join(__dirname, '..', RESULT_FOLDER, dateTime, imagePath), image);
  }
  catch (err) {
    console.error('Не получилось сохранить измененную картинку');
    console.error(err);
    throw err;
  }
}

// ---

function createDateTime() {
  const today = new Date();

  const year = today.getFullYear();
  const month = correctDate(today.getMonth() + 1);
  const day = correctDate(today.getDate());
  const date = `${year}-${month}-${day}`;

  const hours = correctDate(today.getHours());
  const minutes = correctDate(today.getMinutes());
  const seconds = correctDate(today.getSeconds());
  const time = `${hours}-${minutes}-${seconds}`;

  return `${date}__${time}`;
}

// ---

function correctDate(date) {
  return ('00' + date).slice(-2);
}

// ---

function correctImagesPath(imagesPath) {
  return imagesPath.replace(`${IMAGES_FOLDER}/`, '');
}

// ---

function splitArrayToChunks(array, chunkSize) {
  const chunkLength = Math.max(array.length / chunkSize, 1);
  const chunks = [];

  for (let i = 0; i < chunkSize; i++) {
    const chunkPosition = chunkLength * (i + 1);

    if (chunkPosition <= array.length) {
      chunks.push(array.slice(chunkLength * i, chunkPosition));
    }
  }

  return chunks;
}

function getFunctionBody(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.substring(
    value.indexOf('{') + 1,
    value.lastIndexOf('}')
  );
}

module.exports = {
  getFunctionBody,
  correctImagesPath,
  resize,
  createDateTime,
  splitArrayToChunks,
};
