module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true
  },
  extends: ["eslint:recommended", "plugin:import/recommended", "plugin:n/recommended", "plugin:promise/recommended", "prettier"],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module"
  },
  rules: {
    "import/order": ["error", { "newlines-between": "always" }],
    "n/no-missing-import": "off"
  }
};
