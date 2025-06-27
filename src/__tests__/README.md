# Test Setup Documentation

## Overview

This test suite is designed to test the GlobalRulesServer functionality without depending on the actual `.cursor/rules` directory or the real `config.json` file. 

## Test Strategy

### 1. Isolated Test Environment
- Each test creates its own temporary directories using `fs.mkdtemp()`
- Tests use completely isolated file systems that don't interfere with each other
- No dependency on the actual project structure

### 2. Config Mocking
- Tests mock the `loadConfig()` method to use test-specific configurations
- Each test can specify its own `globalRulesSourceDir` path
- No dependency on the actual `config.json` file

### 3. Directory Structure
```
/tmp/global-rules-test-XXXXXX/
├── source-rules/           # Test global rules source directory
│   ├── g-test1.mdc        # Global rule files (start with 'g-')
│   ├── g-test2.mdc
│   └── normal-rule.mdc    # Non-global files (should be ignored)
├── target-project/        # Test target project
│   └── .cursor/
│       └── rules/         # Where global rules get copied to
└── global-storage/        # Test global storage directory
    └── (saved global rules)
```

## Test Cases

### loadGlobalRules Tests
1. **Success with no global files** - Verifies system works when source directory is empty
2. **Error on missing source directory** - Tests error handling when globalRulesSourceDir doesn't exist
3. **Copy global files** - Tests actual file copying functionality
4. **Handle empty config** - Tests validation of configuration

### saveGlobalRules Tests
1. **Success with no global files** - Verifies system works when project has no global rules
2. **Save global files** - Tests saving global rules from project to global storage
3. **Error on missing project** - Tests error handling when project directory doesn't exist

## Key Features

- **No Real File System Dependencies**: Tests don't rely on actual `.cursor/rules` or `config.json`
- **Complete Isolation**: Each test runs in its own temporary environment
- **Comprehensive Coverage**: Tests both success and error scenarios
- **Config Flexibility**: Demonstrates how the system works with any `globalRulesSourceDir` path 