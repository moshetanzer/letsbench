#!/usr/bin/env node

import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import { dirname, join } from 'node:path'
import { performance } from 'node:perf_hooks'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import chalk from 'chalk'
import { getExports, listExportNames } from 'export-scanner'
import figlet from 'figlet'
import inquirer from 'inquirer'
import minimist from 'minimist'
import ora from 'ora'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

interface BenchmarkResult {
  package: string
  function: string
  time: number
  memory: number
  result: any
  error?: string
}

class SimpleBenchmarker {
  private tempDir = join(process.cwd(), '.temp-benchmark')
  private runs: number

  constructor(runs = 1) {
    this.runs = runs
    if (!existsSync(this.tempDir)) {
      mkdirSync(this.tempDir, { recursive: true })
    }

    // Initialize package.json
    const packageJson = {
      name: 'temp-benchmark',
      version: '1.0.0',
      type: 'module',
    }
    writeFileSync(join(this.tempDir, 'package.json'), JSON.stringify(packageJson, null, 2))
  }

  async runCLI(package1: string, function1: string, args1: string, package2: string, function2: string, args2: string): Promise<void> {
    try {
      console.log(chalk.gray(figlet.textSync('Lets Bench')))
      console.log(chalk.cyan(`Benchmarking: ${package1}.${function1} vs ${package2}.${function2}\n`))

      const pkg1 = await this.installPackage(package1)
      const pkg2 = await this.installPackage(package2)

      const functions1 = this.getFunctions(pkg1)
      const functions2 = this.getFunctions(pkg2)

      const parsedArgs1 = this.parseArguments(args1)
      const parsedArgs2 = this.parseArguments(args2)

      console.log(chalk.gray(`${package1}.${function1} args: ${JSON.stringify(parsedArgs1)}`))
      console.log(chalk.gray(`${package2}.${function2} args: ${JSON.stringify(parsedArgs2)}`))

      const spinner = ora('Running benchmarks...').start()

      const result1 = await this.benchmarkFunction(pkg1, function1, parsedArgs1, functions1.allFinalExports)
      const result2 = await this.benchmarkFunction(pkg2, function2, parsedArgs2, functions2.allFinalExports)

      spinner.succeed('Benchmarks completed')

      const results: BenchmarkResult[] = [
        { package: package1, ...result1 },
        { package: package2, ...result2 },
      ]

      this.displayResults(results)
    }
    catch (error) {
      console.error(chalk.red('❌ Error:'), error instanceof Error ? error.message : error)
    }
    finally {
    // Cleanup
      try {
        execSync(`rm -rf ${this.tempDir}`, { stdio: 'pipe' })
      }
      catch {
      // Ignore cleanup errors
      }
    }
  }

  private async installPackage(packageName: string): Promise<any> {
    const spinner = ora(`Installing ${packageName}`).start()

    try {
      execSync(`npm install ${packageName}`, {
        cwd: this.tempDir,
        stdio: 'pipe',
      })

      spinner.text = `Loading ${packageName}`

      let pkg: any

      try {
        // Try dynamic import first (ES modules)
        const importPath = join(this.tempDir, 'node_modules', packageName)
        pkg = await import(importPath)
      }
      catch (importError) {
        try {
          // Try resolving package entry points
          const packagePath = join(this.tempDir, 'node_modules', packageName)
          const packageJsonPath = join(packagePath, 'package.json')

          if (existsSync(packageJsonPath)) {
            const packageInfo = JSON.parse(readFileSync(packageJsonPath, 'utf8'))

            const entryPoints = [
              packageInfo.exports?.['.']?.import,
              packageInfo.exports?.['.']?.default,
              packageInfo.exports?.['.'],
              packageInfo.module,
              packageInfo.main,
              'index.mjs',
              'index.js',
              'dist/index.mjs',
              'dist/index.js',
              'lib/index.mjs',
              'lib/index.js',
              'src/index.mjs',
              'src/index.js',
              'build/index.mjs',
              'build/index.js',
              'es/index.mjs',
              'es/index.js',
              'esm/index.mjs',
              'esm/index.js',
            ].filter(Boolean)

            for (const entryPoint of entryPoints) {
              try {
                const fullPath = entryPoint?.startsWith('.')
                  ? join(packagePath, entryPoint)
                  : join(packagePath, entryPoint || '')

                if (existsSync(fullPath)) {
                  // Use file:// URL for absolute paths
                  const fileUrl = `file://${fullPath}`
                  pkg = await import(fileUrl)
                  break
                }
              }
              catch {
                continue
              }
            }

            // If still no luck, try the package name directly with file URL
            if (!pkg) {
              try {
                const fileUrl = `file://${packagePath}`
                pkg = await import(fileUrl)
              }
              catch {
                // Last resort: try with node_modules prefix
                pkg = await import(`${this.tempDir}/node_modules/${packageName}`)
              }
            }
          }
        }
        catch {
          throw new Error(
            `Could not load package: ${
              importError instanceof Error ? importError.message : 'Unknown error'
            }`,
          )
        }
      }

      if (!pkg) {
        throw new Error('Package loaded but is empty')
      }

      spinner.succeed(`${packageName} loaded`)
      return pkg
    }
    catch (error) {
      spinner.fail(`Failed to load ${packageName}`)
      throw error
    }
  }

  private getFunctions(pkg: any) {
    try {
    // Try different targets in order of preference
      const targets = [
        pkg.default, // ES module default export
        pkg, // The module itself
        pkg.module?.exports, // CommonJS exports
      ].filter(Boolean)

      for (const target of targets) {
        try {
          const functionNames = listExportNames(target, {
            maxDepth: 2, // Reduce depth to avoid deep nesting
            includePrivate: false,
            includeNonFunctions: true,
            followPrototypes: false, // Turn off to get cleaner results
            debug: false,
          })

          if (functionNames.length > 0) {
            const allFinalExports = getExports(target, {
              maxDepth: 2,
              includePrivate: false,
              followPrototypes: false,
              includeClasses: true,
              debug: false,
            })

            const normalizedExports = allFinalExports.functions ? allFinalExports.functions : allFinalExports
            return { allFinalExports: normalizedExports, functionNames }
          }
        }
        catch {
          continue
        }
      }

      throw new Error('No functions found')
    }
    catch (error) {
      console.warn(chalk.yellow(`⚠️  Analysis failed`))
      throw error
    }
  }

  private getValue(obj: any, path: string): any {
    if (path === 'default')
      return obj.default || obj
    if (path === 'main')
      return obj

    return path.split('.').reduce((current, key) => {
      return current?.[key]
    }, obj)
  }

  // eslint-disable-next-line ts/no-unsafe-function-type
  private async benchmarkFunction(pkg: any, functionPath: string, args: any[], callables: Record<string, Function>): Promise<Omit<BenchmarkResult, 'package'>> {
    let func = callables[functionPath]

    if (!func) {
      func = this.getValue(pkg, functionPath)
    }

    if (!func) {
      if (pkg.default && pkg.default[functionPath]) {
        func = pkg.default[functionPath]
      }

      if (!func && pkg[functionPath]) {
        func = pkg[functionPath]
      }
    }

    if (typeof func !== 'function') {
      throw new TypeError(`${functionPath} is not a function`)
    }

    const times: number[] = []
    const memories: number[] = []
    let result: any
    let error: string | undefined

    // Run multiple times for better averages
    for (let i = 0; i < this.runs; i++) {
      const memBefore = process.memoryUsage().heapUsed
      const start = performance.now()

      try {
        // eslint-disable-next-line prefer-spread
        result = func.apply(null, args)
        if (result && typeof result.then === 'function') {
          result = await result
        }
      }
      catch (err) {
        error = err instanceof Error ? err.message : 'Unknown error'
        result = null
        break // Stop on first error
      }

      const end = performance.now()
      const memAfter = process.memoryUsage().heapUsed

      times.push(end - start)
      memories.push(memAfter - memBefore)
    }

    // Calculate averages
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length
    const avgMemory = memories.reduce((a, b) => a + b, 0) / memories.length

    return {
      function: functionPath,
      time: avgTime,
      memory: avgMemory,
      result,
      error,
    }
  }

  private displayResults(results: BenchmarkResult[]): void {
    console.log(`\n${chalk.cyan('🏆 BENCHMARK RESULTS')}`)
    console.log(chalk.cyan('='.repeat(50)))

    console.log(chalk.yellow('\n💻 System Info:'))
    console.log(`Platform: ${os.platform()} ${os.arch()}`)
    console.log(`CPU: ${os.cpus()[0]!.model}`)
    console.log(`Memory: ${Math.round(os.totalmem() / 1024 / 1024 / 1024)}GB`)
    console.log(`Node: ${process.version}`)
    console.log(`Runs: ${this.runs} ${this.runs > 1 ? '(averaged)' : ''}`)

    console.log(chalk.yellow('\n📊 Results:'))

    results.forEach((result, i) => {
      console.log(`\n${i + 1}. ${chalk.bold(result.package)}.${chalk.green(result.function)}`)
      console.log(`   ⏱️  Time: ${chalk.magenta(result.time.toFixed(4))}ms`)
      console.log(`   🧠 Memory: ${chalk.blue(result.memory > 0 ? '+' : '')}${chalk.blue(result.memory)} bytes`)

      if (result.error) {
        console.log(`   ❌ Error: ${chalk.red(result.error)}`)
      }
      else {
        const resultStr = JSON.stringify(result.result)
        const displayResult = resultStr.length > 80 ? `${resultStr.substring(0, 80)}...` : resultStr
        console.log(`   ✅ Result: ${chalk.gray(displayResult)}`)
      }
    })

    // Winner
    const successfulResults = results.filter(r => !r.error)
    if (successfulResults.length === 2) {
      const winner = successfulResults[0]!.time < successfulResults[1]!.time ? successfulResults[0] : successfulResults[1]
      const loser = successfulResults[0]!.time < successfulResults[1]!.time ? successfulResults[1] : successfulResults[0]
      const ratio = (loser!.time / winner!.time).toFixed(2)

      console.log(`\n🚀 ${chalk.green('Winner:')} ${winner!.package}.${winner!.function}`)
      console.log(`   ${ratio}x faster than ${loser!.package}.${loser!.function}`)
      const result1Str = JSON.stringify(successfulResults[0]!.result)
      const result2Str = JSON.stringify(successfulResults[1]!.result)

      if (result1Str !== result2Str) {
        console.log(`\n${chalk.yellow('⚠️  Note:')} These functions don't return the same value! If you are looking for a fair comparison, ensure both functions have the same return value.`)
      }
    }
  }

  private parseArguments(input: string): any[] {
    // Handle empty input
    if (!input.trim()) {
      return []
    }

    // First, try to parse as JSON
    try {
      const parsed = JSON.parse(input)
      // If it's already an array, return it
      if (Array.isArray(parsed)) {
        return parsed
      }
      // If it's a single value, wrap it in an array
      return [parsed]
    }
    catch (jsonError) {
      // If JSON parsing fails, check if it looks like it should be JSON but has syntax errors
      const trimmed = input.trim()

      // If it starts and ends with brackets, it was probably meant to be JSON
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        console.log(chalk.yellow(`⚠️  Invalid JSON syntax: ${jsonError instanceof Error ? jsonError.message : 'Unknown error'}`))
        console.log(chalk.yellow(`   Input: ${input}`))
        throw new Error(`Invalid JSON array syntax. Please check your brackets, quotes, and commas.`)
      }

      // If it starts and ends with braces, it was probably meant to be a JSON object
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        console.log(chalk.yellow(`⚠️  Invalid JSON syntax: ${jsonError instanceof Error ? jsonError.message : 'Unknown error'}`))
        console.log(chalk.yellow(`   Input: ${input}`))
        throw new Error(`Invalid JSON object syntax. Please check your brackets, quotes, and commas.`)
      }

      // Otherwise, treat as a single string argument
      return [trimmed]
    }
  }

  async run(): Promise<void> {
    console.log(chalk.gray(figlet.textSync('Lets Bench')))
    console.log(chalk.gray('A simple CLI to run head-to-head function benchmarking across NPM packages\n'))

    try {
      // Get package names
      const { package1, package2 } = await inquirer.prompt([
        {
          type: 'input',
          name: 'package1',
          message: 'First NPM package:',
          validate: (input: string) => input.trim() !== '' || 'Package name required',
        },
        {
          type: 'input',
          name: 'package2',
          message: 'Second NPM package:',
          validate: (input: string) => input.trim() !== '' || 'Package name required',
        },
      ])

      // Install packages
      const pkg1 = await this.installPackage(package1)
      const pkg2 = await this.installPackage(package2)

      // Get functions
      const functions1 = this.getFunctions(pkg1)
      const functions2 = this.getFunctions(pkg2)

      if (functions1.functionNames.length === 0) {
        console.log(chalk.yellow(`⚠️  No functions found in ${package1}, but proceeding...`))
      }
      if (functions2.functionNames.length === 0) {
        console.log(chalk.yellow(`⚠️  No functions found in ${package2}, but proceeding...`))
      }

      // Select functions
      const { function1, function2 } = await inquirer.prompt([
        {
          type: 'list',
          name: 'function1',
          message: `Choose function from ${package1}:`,
          choices: functions1.functionNames,
        },
        {
          type: 'list',
          name: 'function2',
          message: `Choose function from ${package2}:`,
          choices: functions2.functionNames,
        },
      ])

      // Show examples and hints
      console.log(chalk.cyan('\n💡 Argument Examples:'))
      console.log(chalk.gray('  hello world                    → Single string (auto-parsed)'))
      console.log(chalk.gray('  []                             → No arguments'))
      console.log(chalk.gray('  ["hello world"]                → Single string (explicit)'))
      console.log(chalk.gray('  ["hello", {"normalize": true}] → String with options'))
      console.log(chalk.gray('  [42, 100]                      → Two numbers'))
      console.log(chalk.gray('  [[1,2,3]]                      → Array as argument'))

      // Get test data with better validation and debugging
      const { args1 } = await inquirer.prompt([
        {
          type: 'input',
          name: 'args1',
          message: `Arguments for ${package1}.${function1}:`,
          default: 'hello world',
          validate: (input: string) => {
            if (!input.trim()) {
              return 'Enter something or [] for no arguments'
            }
            try {
              this.parseArguments(input)
              return true
            }
            catch (error) {
              return error instanceof Error ? error.message : 'Invalid argument format'
            }
          },
        },
      ])

      const parsedArgs1 = this.parseArguments(args1)
      console.log(chalk.gray(`   Parsed as: ${JSON.stringify(parsedArgs1)}`))

      const { args2 } = await inquirer.prompt([
        {
          type: 'input',
          name: 'args2',
          message: `Arguments for ${package2}.${function2}:`,
          default: args1, // Use same args as first function by default this this is a sane default
          validate: (input: string) => {
            if (!input.trim()) {
              return 'Enter something or [] for no arguments'
            }
            try {
              this.parseArguments(input)
              return true
            }
            catch (error) {
              return error instanceof Error ? error.message : 'Invalid argument format'
            }
          },
        },
      ])

      const parsedArgs2 = this.parseArguments(args2)
      console.log(chalk.gray(`   Parsed as: ${JSON.stringify(parsedArgs2)}`))

      // Run benchmarks
      const spinner = ora('Running benchmarks...').start()

      // FIXED: Pass the correct callables objects
      const result1 = await this.benchmarkFunction(pkg1, function1, parsedArgs1, functions1.allFinalExports)
      const result2 = await this.benchmarkFunction(pkg2, function2, parsedArgs2, functions2.allFinalExports)

      spinner.succeed('Benchmarks completed')

      const results: BenchmarkResult[] = [
        { package: package1, ...result1 },
        { package: package2, ...result2 },
      ]

      this.displayResults(results)
    }
    catch (error) {
      console.error(chalk.red('❌ Error:'), error instanceof Error ? error.message : error)
    }
    finally {
      // Cleanup
      try {
        execSync(`rm -rf ${this.tempDir}`, { stdio: 'pipe' })
      }
      catch {
        // Ignore cleanup errors
      }
    }
  }
}

const argv = minimist(process.argv.slice(2))
const runs = Number.parseInt(argv.runs || argv.r || '1', 10)

const args = argv._

const vsIndex = args.findIndex(arg => arg === 'vs')

if (vsIndex !== -1 && vsIndex >= 2) {
  const pkg1 = args[0]
  const func1 = args[1]
  const args1Parts = args.slice(2, vsIndex)
  const args1Input = args1Parts.join(' ')

  const remainingAfterVs = args.slice(vsIndex + 1)
  if (remainingAfterVs.length < 2) {
    console.error(chalk.red('Usage: <package1> <function1> <args> vs <package2> <function2> [args2]'))
    console.error(chalk.red('Example: lodash map "data" vs ramda map "data"'))
    process.exit(1)
  }

  const pkg2 = remainingAfterVs[0]
  const func2 = remainingAfterVs[1]
  const args2Parts = remainingAfterVs.slice(2)
  const args2Input = args2Parts.length > 0 ? args2Parts.join(' ') : args1Input

  new SimpleBenchmarker(runs).runCLI(
    pkg1 ?? '',
    func1 ?? '',
    args1Input ?? '',
    pkg2 ?? '',
    func2 ?? '',
    args2Input ?? '',
  ).catch(console.error)
}
else if (args.length >= 3) {
  const pkg1 = args[0]
  const func1 = args[1]
  const args1Input = args.slice(2).join(' ')

  console.log(chalk.yellow('Running single benchmark. Use "vs" for comparison:'))
  console.log(chalk.green(`Example: ${pkg1} ${func1} ${args1Input} vs <package2> <function2>`))

  new SimpleBenchmarker(runs).run().catch(console.error)
}
else {
  // Interactive mode or show usage
  if (args.length === 0) {
    new SimpleBenchmarker(runs).run().catch(console.error)
  }
  else {
    console.error(chalk.red('Usage: <package1> <function1> <args> vs <package2> <function2> [args2]'))
    console.error('')
    console.error(chalk.green('Examples:'))
    console.error(chalk.green('  lodash map "data" vs ramda map'))
    console.error(chalk.green('  lodash map "data" vs ramda map "different data"'))
    console.error(chalk.green('  --runs 100 lodash map "data" vs ramda map'))
    console.error('')
    console.error(chalk.yellow('Options:'))
    console.error(chalk.yellow('  --runs, -r    Number of benchmark runs (default: 1)'))
    process.exit(1)
  }
}
