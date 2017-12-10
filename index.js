const command = require('commander')
const fs = require('fs')
const uuidv5 = require('uuid/v5')

const resolvePath = (path) => new Promise((resolve, reject) => fs.realpath(path, (error, resolvedPath) => error ? reject(error) : resolve(resolvedPath)))
const readFile = (path) => new Promise((resolve, reject) => fs.readFile(path, 'utf8', (error, data) => error ? reject(error) : resolve(data.replace(';', '\n'))))

const pathToModuleMapping = {}
const fileAlreadyParsed = async (path) => {
  const absolutePath = await resolvePath(path)
  return !!pathToModuleMapping[absolutePath]
}
const resolve = async (path) => {
  const absolutePath = await resolvePath(path)
  return pathToModuleMapping[absolutePath]
}
const register = async (path, moduleId) => {
  const absolutePath = await resolvePath(path)
  pathToModuleMapping[absolutePath] = moduleId
}

const pathIsRelative = (path) => path.startsWith('.')

const lengthOfRequire = 'require'.length
const resolveRequires = async (data, path) => {
  let index = 0
  let codeWithResolvedRequires = data
  let dependencies = []

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

      const requiredPath = data.substring(index + lengthOfRequire + 2, endIndex - 2)
      let resolvedRequire
      if (pathIsRelative(requiredPath)) {
        const absolutePath = path.substring(0, path.lastIndexOf('/')) + requiredPath.substr(1)

        if (!await fileAlreadyParsed(absolutePath)) {
          const parsed = await parse(absolutePath)
          dependencies = dependencies.concat(parsed)
        }

        codeWithResolvedRequires = codeWithResolvedRequires.substring(0, index) + await resolve(absolutePath) + codeWithResolvedRequires.substring(endIndex)
      }

      index = endIndex
    }
  }

  return {
    dependencies,
    codeWithResolvedRequires
  }
}

const allowedCharsBefore = [
  '.',
  ' ',
  '(',
  ')',
  '=',
  ',',
  '[',
  ']',
  '\n',
  '' //start of file (see: https://developer.mozilla.org/de/docs/Web/JavaScript/Reference/Global_Objects/String/charAt)
]

const allowedCharsAfter = [
  '.',
  ' ',
  '(',
  ')',
  '=',
  ',',
  '[',
  ']',
  '\n',
  '' // end of file (see: https://developer.mozilla.org/de/docs/Web/JavaScript/Reference/Global_Objects/String/charAt)
]

const withNamespace = (code, namespace, upperScopeDeclaredVariables = {}) => {
  const declaredVariables = { ...upperScopeDeclaredVariables }
  let index = 0

  while (true) {
    let nextVar = code.indexOf('var', index)
    nextVar = nextVar === -1 ? code.length : nextVar
    let nextLet = code.indexOf('let', index)
    nextLet = nextLet === -1 ? code.length : nextLet
    let nextConst = code.indexOf('const', index)
    nextConst = nextConst === -1 ? code.length : nextConst

    const nextVariableDeclaration = nextVar < nextLet && nextVar < nextConst
      ? nextVar
      : nextLet < nextVar && nextLet < nextConst
        ? nextLet
        : nextConst

    const nextScopeBegin = code.indexOf('{', index)
    const nextScopeEnd = code.indexOf('}', index)

    if (nextScopeBegin >= 0 && nextScopeBegin < nextVariableDeclaration && nextScopeBegin < nextScopeEnd) { // before the next declaration a new scope begins
      const result = withNamespace(code.substr(nextScopeBegin + 1), namespace + index, declaredVariables)
      result.index = nextScopeBegin + 1 + result.index
      code = code.substring(0, nextScopeBegin + 1) + result.code + code.substr(result.index)
      index = nextScopeBegin + result.code.length /* align current index to length of inserted code */ + 1
    } else if (nextScopeEnd >= 0 && nextScopeEnd < nextVariableDeclaration) { // before the next declaration the current scope ends
      index = nextScopeEnd + 1
      break
    } else if (nextVariableDeclaration < code.length) {
      let offset = 0
      switch(nextVariableDeclaration) {
        case nextConst:
          offset = 5
          break
        default:
          offset = 3
      }

      const variableName = code.substring(nextVariableDeclaration + offset, code.indexOf('=', nextVariableDeclaration)).trim()
      declaredVariables[variableName] = namespace + '_' + variableName
      index = nextVariableDeclaration + offset
    } else { // finished
      index = code.length
      break
    }
  }

  let indexWithNamespacedVars = index
  Object.keys(declaredVariables).forEach((variableName) => {
    let currentIndex = 0
    while (currentIndex > -1 && currentIndex < indexWithNamespacedVars) {
      const nextString = code.indexOf('\'', currentIndex)
      let nextOccurance = code.indexOf(variableName, currentIndex)
      if (nextString > -1 && nextString < nextOccurance) {
        const stringEnd = code.indexOf('\'', nextString + 1)
        nextOccurance = code.indexOf(variableName, stringEnd + 1)
      }
      currentIndex = nextOccurance

      if (currentIndex > -1 && currentIndex < indexWithNamespacedVars) {
        const charBefore = code.charAt(currentIndex - 1)
        const charAfter = code.charAt(currentIndex + variableName.length)

        if (allowedCharsBefore.includes(charBefore) && allowedCharsAfter.includes(charAfter)) {
          const lengthBefore = code.length
          code = code.substring(0, currentIndex) + declaredVariables[variableName] + code.substr(currentIndex + variableName.length)
          indexWithNamespacedVars = indexWithNamespacedVars + (code.length - lengthBefore)
        }

        currentIndex = currentIndex + variableName.length
      }
    }
  })

  return {
    code: code.substring(0, indexWithNamespacedVars),
    index
  }
}

const parse = async function (path) {
  const data = await readFile(path)

  // find and strip out require statements
  const resolved = await resolveRequires(data, path)

  const moduleId = 'v' + uuidv5(path, uuidv5.URL).replace(/-/g, '')
  await register(path, moduleId)

  return resolved.dependencies.join('\n') + withNamespace(resolved.codeWithResolvedRequires, moduleId, {
    'module.exports': moduleId
  }).code
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
