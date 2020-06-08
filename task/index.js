const fs = require('fs');
const path = require('path');
const util = require('util');
const shell = require('shelljs');
const DATA_FILE_PATH = path.resolve(__dirname, '../data/record.txt');
const EXPORT_FILE_PATH = path.resolve(__dirname, '../data/record.js');
const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);

const main = async () => {
  try {
    const data = await readFile(DATA_FILE_PATH, { encoding: 'utf-8' });
    await writeFile(EXPORT_FILE_PATH, `module.exports=${data}`,{ encoding: 'utf-8' });
  } catch (e) {
    console.log('解析录制文件出错');
    process.exit(1);
  }
  shell.exec('npm run test:e2e');
};

main();