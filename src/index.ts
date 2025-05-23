#!/usr/bin/env node

import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import { dirname, join } from 'node:path'
import { performance } from 'node:perf_hooks'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import chalk from 'chalk'
import inquirer from 'inquirer'
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

  constructor() {
    if (!existsSync(this.tempDir)) {
      mkdirSync(this.tempDir, { recursive: true })
    }

    // Initialize package.json for ES modules
    const packageJson = {
      name: 'temp-benchmark',
      version: '1.0.0',
      type: 'module',
    }
    writeFileSync(join(this.tempDir, 'package.json'), JSON.stringify(packageJson, null, 2))
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

            // Try different entry points
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

  private getFunctions(pkg: any, maxDepth = 3): string[] {
    const functions: string[] = []
    const visited = new WeakSet()

    const explore = (obj: any, path = '', depth = 0) => {
      if (depth > maxDepth || !obj) {
        return
      }

      // Avoid circular references
      if (typeof obj === 'object' && obj !== null) {
        if (visited.has(obj))
          return
        visited.add(obj)
      }

      // Handle direct function
      if (typeof obj === 'function') {
        functions.push(path || 'main')
      }

      // Handle default export
      if (obj && typeof obj.default === 'function' && path === '') {
        functions.push('default')
      }

      // Explore object properties
      if (typeof obj === 'object' && obj !== null) {
        try {
          // Get all enumerable properties including getters
          const keys = [
            ...Object.keys(obj),
            ...Object.getOwnPropertyNames(obj).filter(key =>
              !Object.keys(obj).includes(key)
              && typeof obj[key] === 'function',
            ),
          ].filter(key =>
            !key.startsWith('_')
            && !key.startsWith('__')
            && key !== 'constructor'
            && key !== 'prototype'
            && key !== 'caller'
            && key !== 'arguments'
            && key !== 'name'
            && key !== 'length',
          )

          for (const key of keys) {
            try {
              const value = obj[key]
              const newPath = path ? `${path}.${key}` : key

              if (typeof value === 'function') {
                functions.push(newPath)
              }
              else if (typeof value === 'object' && value !== null && depth < maxDepth) {
                explore(value, newPath, depth + 1)
              }
            }
            catch {
              // Skip properties that can't be accessed
            }
          }
        }
        catch {
          // Skip if can't enumerate properties
        }
      }
    }

    explore(pkg)
    return [...new Set(functions)]
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

  private async benchmarkFunction(pkg: any, functionPath: string, args: any[]): Promise<Omit<BenchmarkResult, 'package'>> {
    const func = this.getValue(pkg, functionPath)

    if (typeof func !== 'function') {
      throw new TypeError(`${functionPath} is not a function`)
    }

    const memBefore = process.memoryUsage().heapUsed
    const start = performance.now()

    let result: any
    let error: string | undefined

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
    }

    const end = performance.now()
    const memAfter = process.memoryUsage().heapUsed

    return {
      function: functionPath,
      time: end - start,
      memory: memAfter - memBefore,
      result,
      error,
    }
  }

  private displayResults(results: BenchmarkResult[]): void {
    console.log(`\n${chalk.cyan('🏆 BENCHMARK RESULTS')}`)
    console.log(chalk.cyan('='.repeat(50)))

    // System info
    console.log(chalk.yellow('\n💻 System Info:'))
    console.log(`Platform: ${os.platform()} ${os.arch()}`)
    console.log(`CPU: ${os.cpus()[0]!.model}`)
    console.log(`Memory: ${Math.round(os.totalmem() / 1024 / 1024 / 1024)}GB`)
    console.log(`Node: ${process.version}`)

    // Results
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
    }
  }

  async run(): Promise<void> {
    console.log(chalk.cyan.bold('🔬 NPM Package Benchmarker\n'))

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

      if (functions1.length === 0) {
        console.log(chalk.yellow(`⚠️  No functions found in ${package1}, but proceeding...`))
        functions1.push('default')
      }
      if (functions2.length === 0) {
        console.log(chalk.yellow(`⚠️  No functions found in ${package2}, but proceeding...`))
        functions2.push('default')
      }

      // Select functions
      const { function1, function2 } = await inquirer.prompt([
        {
          type: 'list',
          name: 'function1',
          message: `Choose function from ${package1}:`,
          choices: functions1,
        },
        {
          type: 'list',
          name: 'function2',
          message: `Choose function from ${package2}:`,
          choices: functions2,
        },
      ])

      // Get test data
      const { args1, args2 } = await inquirer.prompt([
        {
          type: 'input',
          name: 'args1',
          message: `Arguments for ${package1}.${function1} (JSON array, e.g., ["hello world"] or []):`,
          default: '[]',
          filter: (input: string) => {
            try {
              const parsed = JSON.parse(input || '[]')
              return Array.isArray(parsed) ? parsed : [parsed]
            }
            catch {
              // If not valid JSON, treat as single string argument
              return input.trim() ? [input.trim()] : []
            }
          },
        },
        {
          type: 'input',
          name: 'args2',
          message: `Arguments for ${package2}.${function2} (JSON array, e.g., ["hello world"] or []):`,
          default: '[]',
          filter: (input: string) => {
            try {
              const parsed = JSON.parse(input || '[]')
              return Array.isArray(parsed) ? parsed : [parsed]
            }
            catch {
              // If not valid JSON, treat as single string argument
              return input.trim() ? [input.trim()] : []
            }
          },
        },
      ])

      // Run benchmarks
      const spinner = ora('Running benchmarks...').start()

      const result1 = await this.benchmarkFunction(pkg1, function1, args1)
      const result2 = await this.benchmarkFunction(pkg2, function2, args2)

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

// Run the CLI
new SimpleBenchmarker().run().catch(console.error)
