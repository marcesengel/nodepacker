const command = require('commander')
const fs = require('fs')

const readFile = (path) => new Promise((resolve, reject) => fs.readFile(path, 'utf8', (error, data) => error ? reject(error) : resolve(data.replace(';', '\n'))))

const lengthOfRequire = 'require'.length

const parse = async function (path) {
  const data = await readFile(path)

  // find and strip out require statements
  let index = 0
  const requireStatements = []
  while (index > -1) {
    index = data.indexOf('require', index)
    if (index > -1) {
      let endIndex = index + lengthOfRequire + 1
      let openBrackets = 1
      while (openBrackets > 0) {
        const nextClosingBracketIndex = data.indexOf(')', endIndex)
        const nextOpeningBracketIndex = data.indexOf('(', endIndex)
        if (nextOpeningBracketIndex !== -1 && nextOpeningBracketIndex < nextClosingBracketIndex) {
          endIndex = nextOpeningBracketIndex + 1
          openBrackets++
        } else {
          endIndex = nextClosingBracketIndex + 1
          openBrackets--
        }
      }

      requireStatements.push(data.substring(index + lengthOfRequire + 2, endIndex - 2))
      index = endIndex
    }
  }

  const relativeRequireFiles = requireStatements
    .filter((path) => path.startsWith('./'))
    .map((path) => path.substr(1))

  const resolved = await Promise.all(relativeRequireFiles.map((relativePath) => parse(path.substring(0, path.lastIndexOf('/')) + relativePath)))

  return resolved.join('') + data
}

const pack = function (file) {
  parse(file)
    .then(console.log)
    .catch(console.error)
}

command
  .arguments('<file>')
  .action(pack)
  .parse(process.argv)
