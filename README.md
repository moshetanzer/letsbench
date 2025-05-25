# LetsBench

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

✔ First NPM package: text-toolbox
✔ Second NPM package: scule
✔ text-toolbox loaded
✔ scule loaded
✔ Choose function from text-toolbox: pascalCase
✔ Choose function from scule: pascalCase
✔ Arguments for text-toolbox.pascalCase: hello world
✔ Arguments for scule.pascalCase: ["hello world", {"normalize": true}]
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

1. text-toolbox.pascalCase
   ⏱️  Time: 0.1453ms
   🧠 Memory: +6344 bytes
   ✅ Result: "HelloWorld"

2. scule.pascalCase
   ⏱️  Time: 0.4080ms
   🧠 Memory: +12936 bytes
   ✅ Result: "Hello world"

🚀 Winner: text-toolbox.pascalCase
   2.81x faster than scule.pascalCase
```

## Function Arguments

LetsBench supports flexible argument parsing:

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

## Troubleshooting

### Package Loading Issues

If a package fails to load:

1. **Check package name**: Ensure the package exists on NPM
2. **Version compatibility**: Some packages may not work with your Node.js version
3. **Package format**: Some packages may use unsupported module formats

### Function Not Found

If no functions are discovered:

1. The tool will still allow you to proceed with `default` export
2. Check the package documentation for correct function names
3. Some packages may have non-standard export patterns

### Memory Usage

For packages with high memory usage:

- Consider using fewer runs (`--runs 1`)
- Results may vary based on Node.js garbage collection
- Memory delta shows allocation difference, not total usage

## Performance Tips

- **Multiple runs**: Use `--runs 5-10` for more reliable averages
- **Warm-up**: First run may be slower due to JIT compilation
- **Arguments**: Keep test arguments consistent for fair comparison
- **Environment**: Run in similar conditions for reproducible results

## Limitations

- Packages must be installable via NPM
- Functions must be synchronous or return promises
- Memory measurements are approximations
- Some complex packages may not load correctly
- Temporary files created in `.temp-benchmark` directory (auto-cleaned)

## Requirements

- **Node.js**: Version 14+ (ES modules support)
- **NPM**: For package installation
- **Internet**: To download packages from NPM registry

## Use Cases

Perfect for:

- 🔍 **Library evaluation**: Compare similar packages before choosing
- ⚡ **Performance optimization**: Identify faster alternatives
- 📈 **Benchmarking**: Measure function performance across versions
- 🎯 **Decision making**: Data-driven package selection
- 📚 **Learning**: Understanding performance characteristics of different implementations
