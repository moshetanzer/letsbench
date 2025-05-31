# 🏁 LetsBench

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![Codecov][codecov-src]][codecov-href]

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
- ⚡ **Direct CLI syntax** for quick comparisons

## Usage

### Interactive Mode

Simply run the command and follow the interactive prompts:

```bash
npx letsbench
```

The tool will guide you through:

1. **Package Selection**: Enter two NPM package names to compare
2. **Function Selection**: Choose specific functions from each package
3. **Arguments**: Provide test arguments for the functions
4. **Results**: View detailed benchmark results

### Direct CLI Mode

Compare functions directly from the command line using natural syntax:

```bash
# Basic comparison
npx letsbench lodash map "data" vs ramda map

# Different arguments for each function
npx letsbench lodash map "data" vs ramda map "different data"

# Multiple runs for better accuracy
npx letsbench --runs 10 lodash map "data" vs ramda map
```

**CLI Syntax:**

```bash
npx letsbench [options] <package1> <function1> <args1> vs <package2> <function2> [args2]
```

- If `args2` is omitted, `args1` will be used for both functions
- Arguments are parsed the same way as in interactive mode

### Options

- `--runs, -r`: Number of runs per function (1-100, default: 1)

## Example Sessions

### Interactive Mode

```shell
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

### Direct CLI Mode

```shell
➜ npx letsbench lodash map "[1,2,3]" vs ramda map

🏆 BENCHMARK RESULTS
==================================================

💻 System Info:
Platform: darwin arm64
CPU: Apple M1
Memory: 8GB
Node: v23.10.0
Runs: 1

📊 Results:

1. lodash.map
   ⏱️  Time: 0.0234ms
   🧠 Memory: +2456 bytes
   ✅ Result: [1,2,3]

2. ramda.map
   ⏱️  Time: 0.0891ms
   🧠 Memory: +4123 bytes
   ✅ Result: [1,2,3]

🚀 Winner: lodash.map
   3.81x faster than ramda.map
```

## Function Arguments

LetsBench supports flexible argument parsing in both interactive and CLI modes:

### Argument Examples

| Input | Parsed As | Description |
|-------|-----------|-------------|
| `hello world` | `["hello world"]` | Single string (auto-parsed) |
| `[]` | `[]` | No arguments |
| `["hello world"]` | `["hello world"]` | Single string (explicit) |
| `["hello", {"normalize": true}]` | `["hello", {"normalize": true}]` | String with options object |
| `[42, 100]` | `[42, 100]` | Two numbers |
| `[[1,2,3]]` | `[[1,2,3]]` | Array as argument |

### Argument Parsing Rules

1. **Empty input**: Returns empty array `[]`
2. **Valid JSON**: Parses as JSON (arrays remain arrays, objects become single arguments)
3. **Invalid JSON**: Treats as single string argument

## CLI Examples

```bash
# String manipulation comparison
npx letsbench lodash kebabCase "hello world" vs change-case kebab "hello world"

# Array operations
npx letsbench lodash uniq "[1,2,2,3]" vs ramda uniq

# With options objects
npx letsbench lodash merge "[{a:1}, {b:2}]" vs ramda mergeWith "[{a:1}, {b:2}]"

# Multiple runs for accuracy
npx letsbench --runs 50 lodash debounce "[function(){}, 100]" vs underscore debounce

# Different arguments for each function
npx letsbench package1 func1 "args1" vs package2 func2 "args2"
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

<!-- Badges -->
[npm-version-src]: https://img.shields.io/npm/v/letsbench?style=flat
[npm-version-href]: https://npmjs.com/package/letsbench
[npm-downloads-src]: https://img.shields.io/npm/dm/letsbench?style=flat
[npm-downloads-href]: https://npmjs.com/package/letsbench
[codecov-src]: https://img.shields.io/codecov/c/gh/moshetanzer/letsbench/main?style=flat
[codecov-href]: https://codecov.io/gh/moshetanzer/letsbench
