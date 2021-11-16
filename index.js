const path = require('path');
const fs = require('fs');
const fse = require('fs-extra');
const glob = require("glob")
const resizeImg = require('resize-img')
const fileType = require('file-type');
const gifFrames = require('gif-frames');

// ---

const IMAGES_FOLDER = 'images';
const RESULT_FOLDER = 'result';

const SUPPORTED_FORMATS = {
  bmp: 'image/png',
  jpg: 'image/jpeg',
  png: 'image/bmp',
  gif: 'image/gif',
};

const DATE_TIME = createDateTime();

const SIZE_ARGV = process.argv[2];
let IMAGE_WIDTH = 24;
let IMAGE_HEIGHT = 24;

if (!SIZE_ARGV) {
  console.warn('Ширина и высота для картинок не указана, будет применено значение по умолчанию = 24px');
}
else {
  const splittedSize = SIZE_ARGV.split('.');

  if (splittedSize.length !== 2) {
    console.warn('Не указан второй размер (ширина или высота), будет применено значение по умолчанию = 24px');
  }
  else {
    IMAGE_WIDTH = parseInt(splittedSize[0]);
    IMAGE_HEIGHT = parseInt(splittedSize[1]);
  }
}

// ---

glob(`${IMAGES_FOLDER}/**/*`, { nodir: true }, async (err, files) => {
  if (err) {
    console.error('Не удалось прочитать файлы');
    return null;
  }

  try {
    await fse.ensureDir(path.join(__dirname, RESULT_FOLDER));
  }
  catch (err) {
    console.error(`Не удалось создать папку ${RESULT_FOLDER}`);
    return null;
  }

  files.forEach((filePath) => {
    const replacedPath = correctImagesPath(filePath);

    fs.readFile(filePath, async (err, file) => {
      if (err) {
        console.error('Не удалось прочитать файл = ', filePath);
        return null;
      }

      const type = await fileType.fromBuffer(file);

      if (!type) {
        console.error(`Тип файла ${file} не определен = `, filePath);
        return null;
      }

      if (!Object.values(SUPPORTED_FORMATS).includes(type.mime)) {
        console.error(`Формат файла ${type.mime} не поддерживается = `, filePath);
        return null;
      }

      if (type.mime === SUPPORTED_FORMATS.gif) {
        const outputType = 'png';

        const frame = await gifFrames({ url: filePath, frames: 0, outputType });
        const { dir, name } = path.parse(filePath);

        const fileName = `${name}.${outputType}`;
        const tempPath = path.join(__dirname, dir, `temp-${fileName}`);

        const stream = fs.createWriteStream(tempPath);

        frame[0]
          .getImage()
          .pipe(stream);

        stream.on('close', () => {
          fs.readFile(tempPath, async (err, gifFrame) => {
            if (err) {
              console.error('Не удалось прочитать временную gif картинку = ', tempPath);
              return null;
            }

            const gifFramePath = path.join(correctImagesPath(dir), fileName);

            await resize(gifFramePath, gifFrame);
            await fse.remove(tempPath, (err) => {
              if (err) {
                console.error('Не получилось удалить временную gif картинку');
                return null;
              }
            });
          });
        });

        return null;
      }

      await resize(replacedPath, file);
    });
  });
})

async function resize(imagePath, file) {
  let image;
  try {
    image = await resizeImg(file, {
      width: IMAGE_WIDTH,
      height: IMAGE_HEIGHT,
    });
  }
  catch (error) {
    console.error('Не получилось изменить размер картинки')
    throw error;
  }

  if (!image) {
    return null;
  }

  try {
    await fse.outputFile(path.join(__dirname, RESULT_FOLDER, DATE_TIME, imagePath), image);
  }
  catch (error) {
    console.error('Не получилось сохранить измененную картинку');
    throw error;
  }
}

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

function correctDate(date) {
  return ('00' + date).slice(-2);
}

function correctImagesPath(imagesPath) {
  return imagesPath.replace(`${IMAGES_FOLDER}/`, '');
}