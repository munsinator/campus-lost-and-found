module.exports = {
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.tsx?$': [
      'babel-jest',
      {
        presets: ['@babel/preset-typescript']
      }
    ]
  },
  coverageProvider: 'v8'
};