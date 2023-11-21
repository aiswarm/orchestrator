export default {
  testEnvironment: 'node',
  coverageDirectory: './coverage/',
  collectCoverage: true,
  testMatch: ['**/test/**/*.test.js'],
  transform: {
    '^.+\\.m?jsx?$': 'babel-jest',
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(@aiswarm)/)',
    '/node_modules/(?!onall).+\\.js$',
  ],
}
