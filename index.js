const path = require('path');
const fs = require('fs');
const fse = require('fs-extra');
const glob = require('glob');

const fileType = require('file-type');
const gifFrames = require('gif-frames');
const cliProgress = require('cli-progress');

const { correctImagesPath, resize, createDateTime, splitArrayToChunks } = require('./src/utils');
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

  const bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
  bar.start(files.length, 0);

  const chunkItemsSize = 100;
  const chunks = splitArrayToChunks(files, chunkItemsSize);

  let chunkIndex = 0;
  for (const chunkFiles of chunks) {
    chunkIndex += chunkItemsSize;
    bar.update(chunkIndex);

    const promises = [];

    chunkFiles.forEach((filePath) => {
      promises.push(fs.promises.readFile(filePath).then((file) => ({
        file,
        filePath,
      })));
    });

    let filesData = [];
    try {
      filesData = await Promise.all(promises);
    }
    catch (err) {
      console.error('Не удалось прочитать какие-то файлы');
      console.error('err', err);
      return;
    }

    for (const { file, filePath } of filesData) {
      const replacedPath = correctImagesPath(filePath);

      const type = await fileType.fromBuffer(file);

      if (!type) {
        console.error(`Тип файла ${file} не определен = `, filePath);
        console.error(err);
        continue;
      }

      if (!Object.values(SUPPORTED_FORMATS).includes(type.mime)) {
        console.error(`Формат файла ${type.mime} не поддерживается = `, filePath);
        continue;
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
          continue;
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
          });
        });

        continue;
      }

      await resize(replacedPath, file, RESIZE_OPTIONS);
    }
  }

  await fse.remove(path.join(__dirname, 'temp'), (err) => {
    if (err) {
      console.error('Не получилось удалить temp папку');
      console.error(err);
      return null;
    }
  });
  
  bar.stop();
})
