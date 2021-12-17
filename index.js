const path = require('path');
const fse = require('fs-extra');
const glob = require('glob');

const cliProgress = require('cli-progress');
const { Worker } = require('worker_threads');
const argv = require('minimist')(process.argv.slice(2));

const { getFunctionBody, createDateTime, splitArrayToChunks } = require('./src/utils');
const { IMAGES_FOLDER, RESULT_FOLDER } = require('./src/constants');

// ---

let imageWidth = 24;
let imageHeight = 24;

if (!argv.s) {
  console.warn('Ширина и высота для картинок не указана, будет применено значение по умолчанию = 24px');
}
else {
  const splittedSize = argv.s.split('-');

  if (splittedSize.length !== 2) {
    console.warn('Не указан второй размер (ширина или высота), будет применено значение по умолчанию = 24px');
  }
  else {
    imageWidth = parseInt(splittedSize[0]);
    imageHeight = parseInt(splittedSize[1]);
  }
}

const NUMBER_OF_WORKERS = argv.w || 2;

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

  const chunks = splitArrayToChunks(files, NUMBER_OF_WORKERS);

  const multiBar = new cliProgress.MultiBar({
    clearOnComplete: false,
    hideCursor: true
  }, cliProgress.Presets.shades_grey);

  const promises = chunks.map((chunk) => {
    const bar = multiBar.create(chunk.length, 0);

    return new Promise((resolve, reject) => {
      const worker = new Worker(getFunctionBody(renameCycle.toString()), {
        eval: true,
        workerData: {
          chunks: chunk,
          resizeOptions: RESIZE_OPTIONS,
        },
      });

      worker.on('message', (value) => {
        if (value.message === 'inc') {
          bar.increment();
        }
      });

      worker.on('error', reject);
      worker.on('exit', (code) => {
        if (code !== 0) {
          reject(new Error(`Worker stopped with exit code ${code}`));
        }

        resolve();
      });
    })
  });

  await Promise.all(promises);

  multiBar.stop();

  await fse.remove(path.join(__dirname, 'temp'), (err) => {
    if (err) {
      console.error('Не получилось удалить temp папку');
      console.error(err);
      return null;
    }
  });
});

function renameCycle() {
  const fs = require('fs');
  const fse = require('fs-extra');
  const path = require('path');
  const gifFrames = require('gif-frames');
  const fileType = require('file-type');
  const { correctImagesPath, resize } = require('./src/utils');
  const { SUPPORTED_FORMATS } = require('./src/constants');
  const { workerData, parentPort } = require('worker_threads');

  const { chunks, resizeOptions } = workerData;

  (async function() {
    const promises = [];

    chunks.forEach((filePath) => {
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
        parentPort.postMessage({ message: 'inc' });
        const replacedPath = correctImagesPath(filePath);

        const type = await fileType.fromBuffer(file);

        if (!type) {
          console.error(`Тип файла ${file} не определен = `, filePath);
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

              await resize(gifFramePath, gifFrame, resizeOptions);
            });
          });

          continue;
        }

        await resize(replacedPath, file, resizeOptions);
      }
  })();
}
