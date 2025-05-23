# NPM Package Benchmarker 🔬

A simple command-line tool to benchmark and compare the performance of functions from different NPM packages. Perfect for evaluating alternatives, optimizing dependencies, or making data-driven decisions about which package to use in your project.

## Features

- 🚀 **Easy Setup**: No configuration needed - just run and go
- 📦 **Dynamic Package Loading**: Automatically installs and loads any NPM package
- 🔍 **Smart Function Discovery**: Automatically finds available functions in packages
- ⚡ **Performance Metrics**: Measures execution time and memory usage
- 🎯 **Side-by-Side Comparison**: Compare two packages head-to-head
- 📊 **Detailed Results**: Clear output with system info and performance ratios
- 🛡️ **Error Handling**: Graceful handling of failed function calls
- 🧹 **Auto Cleanup**: Temporary files are automatically removed

## Usage

Simply run the script and follow the interactive prompts:

```bash
npx letsbench
```

### Example Session

```
🔬 NPM Package Benchmarker

? First NPM package: lodash
? Second NPM package: ramda
✓ lodash loaded
✓ ramda loaded
? Choose function from lodash: map
? Choose function from ramda: map
? Arguments for lodash.map (JSON array): [[1,2,3], "x => x * 2"]
? Arguments for ramda.map (JSON array): ["x => x * 2", [1,2,3]]
✓ Benchmarks completed

🏆 BENCHMARK RESULTS
==================================================

💻 System Info:
Platform: darwin arm64
CPU: Apple M1 Pro
Memory: 32GB
Node: v18.17.0

📊 Results:

1. lodash.map
   ⏱️  Time: 0.1234ms
   🧠 Memory: +128 bytes
   ✅ Result: [2,4,6]

2. ramda.map
   ⏱️  Time: 0.2456ms
   🧠 Memory: +256 bytes
   ✅ Result: [2,4,6]

🚀 Winner: lodash.map
   1.99x faster than ramda.map
```

## Input Format

### Package Names
- Standard NPM package names (e.g., `lodash`, `moment`, `axios`)
- Scoped packages work too (e.g., `@babel/core`, `@types/node`)

### Function Arguments
Arguments should be provided as JSON arrays:
- Simple: `["hello world"]` for a single string argument
- Multiple: `[1, 2, "test"]` for multiple arguments
- Objects: `[{"key": "value"}, true]` for complex data
- None: `[]` for functions with no arguments

### Function Discovery
The tool automatically discovers functions by:
- Scanning object properties up to 3 levels deep
- Finding both direct exports and nested functions
- Handling CommonJS and ES modules
- Supporting default exports

## Supported Package Types

- ✅ CommonJS packages (`module.exports`)
- ✅ ES6 modules (`export default`, `export const`)
- ✅ Mixed export patterns
- ✅ TypeScript compiled packages
- ✅ Packages with multiple entry points

## Limitations

- Functions must be synchronous or return promises
- Complex object arguments may not display fully in results
- Some packages with native dependencies might not load properly
- Memory measurements are approximate due to garbage collection

## Error Handling

The tool gracefully handles:
- Package installation failures
- Missing or invalid functions
- Runtime errors during function execution
- Invalid JSON arguments
- Network timeouts

Errors are displayed in the results without stopping the benchmark process.

## Use Cases

- **Library Selection**: Compare performance between similar packages
- **Migration Planning**: Benchmark before switching dependencies
- **Performance Optimization**: Identify bottlenecks in your dependencies
- **Documentation**: Generate performance comparisons for technical decisions
- **Learning**: Understand real-world performance differences

## Technical Details

- **Execution**: Uses `performance.now()` for high-precision timing
- **Memory**: Measures heap usage before and after execution
- **Isolation**: Each package runs in a temporary directory
- **Cleanup**: Automatically removes temporary files and dependencies
- **Safety**: Handles circular references and protected properties

## Contributing

Feel free to submit issues or pull requests for:
- Additional package loading strategies
- Better function discovery algorithms
- Enhanced result formatting
- Performance improvements
- Bug fixes

## License

MIT License - feel free to use this tool in your projects!

---

**Happy benchmarking!** 🚀
