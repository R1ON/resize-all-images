const path = require('path');
const fs = require('graceful-fs');
const fse = require('fs-extra');
const glob = require('glob')

const fileType = require('file-type');
const gifFrames = require('gif-frames');

const { correctImagesPath, resize, createDateTime } = require('./src/utils');
const { IMAGES_FOLDER, RESULT_FOLDER, SUPPORTED_FORMATS } = require('./src/constants');

// ---

let imageWidth = 24;
let imageHeight = 24;

const SIZE_ARGV = process.argv[2];

if (!SIZE_ARGV) {
  console.warn('Ширина и высота для картинок не указана, будет применено значение по умолчанию = 24px');
}
else {
  const splittedSize = SIZE_ARGV.split('.');

  if (splittedSize.length !== 2) {
    console.warn('Не указан второй размер (ширина или высота), будет применено значение по умолчанию = 24px');
  }
  else {
    imageWidth = parseInt(splittedSize[0]);
    imageHeight = parseInt(splittedSize[1]);
  }
}

const RESIZE_OPTIONS = {
  width: imageWidth,
  height: imageHeight,
  dateTime: createDateTime(),
};

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
        console.error(err);
        return null;
      }

      const type = await fileType.fromBuffer(file);

      if (!type) {
        console.error(`Тип файла ${file} не определен = `, filePath);
        console.error(err);
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
        const tempPath = path.join(__dirname, 'temp', `temp-${fileName}`);

        try {
          await fse.ensureDir(path.join(__dirname, 'temp'));
        }
        catch (err) {
          console.error(`Не удалось создать папку temp`);
          console.error(err);
          return null;
        }

        const stream = fs.createWriteStream(tempPath);

        frame[0]
          .getImage()
          .pipe(stream);

        stream.on('close', () => {
          fs.readFile(tempPath, async (err, gifFrame) => {
            if (err) {
              console.error('Не удалось прочитать временную gif картинку = ', tempPath);
              console.error(err);
              return null;
            }

            const gifFramePath = path.join(correctImagesPath(dir), fileName);

            await resize(gifFramePath, gifFrame, RESIZE_OPTIONS);
            await fse.remove(path.join(__dirname, 'temp'), (err) => {
              if (err) {
                console.error('Не получилось удалить temp папку');
                console.error(err);
                return null;
              }
            });
          });
        });

        return null;
      }

      await resize(replacedPath, file, RESIZE_OPTIONS);
    });
  });
})
