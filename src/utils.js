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
  const tempArray = [];

  for (let index = 0; index < array.length; index += chunkSize) {
    const chunk = array.slice(index, index + chunkSize);
    tempArray.push(chunk);
  }

  return tempArray;
}

module.exports = {
  correctImagesPath,
  resize,
  createDateTime,
  splitArrayToChunks,
};
