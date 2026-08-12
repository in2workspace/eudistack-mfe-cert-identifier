/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-preset-angular',
  setupFilesAfterEnv: ['<rootDir>/setup-jest.ts'],
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/dist/'],
  transform: {
    '^.+\\.(ts|mjs|js|html)$': [
      'jest-preset-angular',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
        stringifyContentPathRegex: '\\.(html|svg)$',
      },
    ],
  },
  transformIgnorePatterns: ['node_modules/(?!.*\\.mjs$)'],
  moduleFileExtensions: ['ts', 'js', 'html'],
  collectCoverage: true,
  coverageDirectory: './coverage/app',
  coverageReporters: ['lcov', 'text-summary', 'cobertura', 'html', 'json-summary', 'json'],
  collectCoverageFrom: [
    'src/app/**/*.ts',
    '!<rootDir>/node_modules/',
    '!<rootDir>/test/',
    '!src/app/**/*.module.ts',
  ],
};
