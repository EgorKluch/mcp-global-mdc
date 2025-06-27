module.exports = {
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.js", "**/*.(test|spec).js"],
  collectCoverageFrom: [
    "src/**/*.js",
    "!src/**/*.test.js",
  ],
  transformIgnorePatterns: [
    "/node_modules/(?!(@modelcontextprotocol/sdk)/)",
  ],
  transform: {
    "^.+\\.js$": "babel-jest",
  },
};