'use strict'

// minimatch 3 expects brace-expansion to be a callable CommonJS export.
// brace-expansion 5 exports the same implementation as `.expand`; this
// adapter preserves the old shape while retaining the fixed expansion caps.
const safeBraceExpansion = require('brace-expansion-safe')

function expand(pattern, options) {
  return safeBraceExpansion.expand(pattern, options)
}

Object.assign(expand, safeBraceExpansion)
module.exports = expand
