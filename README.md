# 🏁 LetsBench

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![Codecov][codecov-src]][codecov-href]
[![bundle size](https://img.shields.io/bundlephobia/minzip/letsbench)](https://bundlephobia.com/package/letsbench)

A simple CLI tool to run head-to-head function benchmarking across NPM packages. Perfect for comparing the performance of similar functions from different libraries.

## Quick Start

Run LetsBench directly with npx:

```bash
npx letsbench
```

## Features

- 🏆 **Head-to-head comparison** of functions from two NPM packages
- ⚡ **Performance metrics** including execution time and memory usage
- 🔍 **Automatic function discovery** from package exports
- 📊 **Detailed results** with system information and winner declaration
- 🎯 **Multiple runs** support for more accurate averages
- 🎨 **Colorful CLI interface** with visual feedback

## Usage

### Basic Usage

Simply run the command and follow the interactive prompts:

```bash
npx letsbench
```

The tool will guide you through:

1. **Package Selection**: Enter two NPM package names to compare
2. **Function Selection**: Choose specific functions from each package
3. **Arguments**: Provide test arguments for the functions
4. **Results**: View detailed benchmark results

### Advanced Usage

Run multiple iterations for more accurate averages:

```bash
npx letsbench --runs 10
# or
npx letsbench -r 10
```

**Options:**
- `--runs, -r`: Number of runs per function (1-100, default: 1)

## Example Session

```
➜ npx letsbench

  _         _         ____                  _
 | |    ___| |_ ___  | __ )  ___ _ __   ___| |__
 | |   / _ \ __/ __| |  _ \ / _ \ '_ \ / __| '_ \
 | |__|  __/ |_\__ \ | |_) |  __/ | | | (__| | | |
 |_____\___|\__|___/ |____/ \___|_| |_|\___|_| |_|

A simple CLI to run head-to-head function benchmarking across NPM packages

✔ First NPM package: demo-package1
✔ Second NPM package: demo-package2
✔ demo-package1 loaded
✔ demo-package2 loaded
✔ Choose function from demo-package1: pascalCase
✔ Choose function from demo-package2: casePascal
✔ Arguments for demo-package1.pascalCase: hello world
✔ Arguments for demo-package2.casePascal: ["hello world", {"normalize": true}]
✔ Benchmarks completed

🏆 BENCHMARK RESULTS
==================================================

💻 System Info:
Platform: darwin arm64
CPU: Apple M1
Memory: 8GB
Node: v23.10.0
Runs: 1

📊 Results:

1. demo-pacakge1.pascalCase
   ⏱️  Time: 0.1453ms
   🧠 Memory: +6344 bytes
   ✅ Result: "HelloWorld"

2. demo-pacakge2.casePascal
   ⏱️  Time: 0.4080ms
   🧠 Memory: +12936 bytes
   ✅ Result: "HelloWorld"

🚀 Winner: demo-pacakge1.pascalCase
   2.81x faster than demo-pacakge2.casePascal
```

## Function Arguments

LetsBench supports flexible argument parsing:

### Argument Examples

| Input | Parsed As | Description |
|-------|-----------|-------------|
| `hello world` | `hello world` | Single string (auto-parsed) |
| `[]` | `[]` | No arguments |
| `["hello world"]` | `["hello world"]` | Single string (explicit) |
| `["hello", {"normalize": true}]` | `["hello", {"normalize": true}]` | String with options object |
| `[42, 100]` | `[42, 100]` | Two numbers |
| `[[1,2,3]]` | `[[1,2,3]]` | Array as argument |

### Argument Parsing Rules

1. **Empty input**: Returns empty array `[]`
2. **Valid JSON**: Parses as JSON (arrays remain arrays, objects become single arguments)
3. **Invalid JSON**: Treats as single string argument

## How It Works

1. **Package Installation**: Downloads packages to a temporary directory
2. **Function Discovery**: Automatically scans package exports to find available functions
3. **Dynamic Loading**: Loads packages using ES module imports with fallback strategies
4. **Benchmarking**: Measures execution time and memory usage using Node.js performance APIs
5. **Results**: Displays comprehensive comparison with system information

## Supported Package Types

LetsBench supports various NPM package formats:

- ✅ **ES Modules** (modern packages with `"type": "module"`)
- ✅ **CommonJS** packages
- ✅ **Packages with multiple entry points**
- ✅ **TypeScript packages** (compiled to JavaScript)
- ✅ **Packages with complex export maps**

## Function Discovery

The tool automatically discovers functions by:

- Scanning direct exports
- Checking `default` exports
- Exploring nested object properties (up to 3 levels deep)
- Filtering out internal/private methods (starting with `_` or `__`)

## Output Metrics

Each benchmark result includes:

- **⏱️ Time**: Average execution time in milliseconds
- **🧠 Memory**: Memory usage delta in bytes
- **✅ Result**: Function return value (truncated if long)
- **❌ Error**: Error message if function throws

## System Information

Results include comprehensive system details:

- Operating system and architecture
- CPU model
- Total system memory
- Node.js version
- Number of benchmark runs

## License

MIT

<!-- Badges -->
[npm-version-src]: https://img.shields.io/npm/v/letsbench?style=flat
[npm-version-href]: https://npmjs.com/package/letsbench
[npm-downloads-src]: https://img.shields.io/npm/dm/letsbench?style=flat
[npm-downloads-href]: https://npmjs.com/package/letsbench
[codecov-src]: https://img.shields.io/codecov/c/gh/moshetanzer/letsbench/main?style=flat
[codecov-href]: https://codecov.io/gh/moshetanzer/letsbench
