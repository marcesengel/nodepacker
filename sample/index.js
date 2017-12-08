require('./test.js').test()

const hi = function () {
  console.log('hi')
  let test = 1
  test = test + 1
  console.log(test)
}

hi()
