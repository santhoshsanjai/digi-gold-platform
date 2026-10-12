const expo = require('eslint-config-expo/flat')

module.exports = [...expo, { ignores: ['dist/*', 'src/api/schema.d.ts'] }]
