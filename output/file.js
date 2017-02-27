const
    _ = require('lodash'),
    fs = require('fs'),
    path = require('path'),
    kefir = require('kefir');

const
    KILOBYTE = 1000,
    DEFAULT_FILE_SIZE = 5 * KILOBYTE,
    DEFAULT_FILE_ROLL_LIMIT = 3,
    DEFAULT_FILE_PATH = path.join(process.cwd(), 'data'),
    DEFAULT_FILE_NAME_TEMPLATE = (serial)=> `demo_${_.padStart(serial + 1, 3, '0')}.log`;

module.exports = class {

    constructor({
        fileSize = DEFAULT_FILE_SIZE,
        fileRollLimit = DEFAULT_FILE_ROLL_LIMIT,
        filePath = DEFAULT_FILE_PATH,
        fileNameTemplate = DEFAULT_FILE_NAME_TEMPLATE
    } = {}){

        let messageStream = kefir
            .stream(({ emit })=> this.send = emit )
            .map(JSON.stringify)
            .map((message)=> Buffer.from(message + '\n', 'utf8'));

        let outputFileProperty = messageStream
            .map((messageBuffer)=> messageBuffer.length)
            .scan((a,b)=> a+b, 0)
            .map((size)=> ~~(size/fileSize) % fileRollLimit)
            .map((serial)=> path.join(filePath, fileNameTemplate(serial)))
            .skipDuplicates()
            .map((fileName)=> fs.createWriteStream(fileName, {flags: 'w'}))
            .toProperty();

        kefir
            .combine([messageStream], [outputFileProperty])
            .onValue(([ message, fileStream ])=> fileStream.write(message));
    }
};