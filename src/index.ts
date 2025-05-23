#!/usr/bin/env node

import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import { join } from 'node:path'
import { performance } from 'node:perf_hooks'
import process from 'node:process'
import chalk from 'chalk'
import inquirer from 'inquirer'
import ora from 'ora'

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
  private require: NodeRequire

  constructor() {
    if (!existsSync(this.tempDir)) {
      mkdirSync(this.tempDir, { recursive: true })
    }

    // Initialize package.json for CommonJS
    const packageJson = {
      name: 'temp-benchmark',
      version: '1.0.0',
      type: 'commonjs',
    }
    writeFileSync(join(this.tempDir, 'package.json'), JSON.stringify(packageJson, null, 2))

    // Create require function for the temp directory
    this.require = createRequire(join(this.tempDir, 'package.json'))
  }

  private async installPackage(packageName: string): Promise<any> {
    const spinner = ora(`Installing ${packageName}`).start()

    try {
      execSync(`npm install ${packageName}`, {
        cwd: this.tempDir,
        stdio: 'pipe',
      })

      spinner.text = `Loading ${packageName}`

      // Try multiple ways to load the package
      let pkg: any

      try {
        // Try CommonJS require first
        pkg = this.require(packageName)
      }
      catch (requireError) {
        try {
          // Try direct path resolution
          const packagePath = join(this.tempDir, 'node_modules', packageName)
          const packageJsonPath = join(packagePath, 'package.json')

          if (existsSync(packageJsonPath)) {
            const packageInfo = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
            const mainFile = packageInfo.main || packageInfo.module || 'index.js'
            const fullPath = join(packagePath, mainFile)

            if (existsSync(fullPath)) {
              pkg = this.require(fullPath)
            }
            else {
              // Try common entry points
              const commonEntries = [
                'index.js',
                'index.mjs',
                'index.cjs',
                'index.ts',
                'index.tsx',
                'index.jsx',
                'lib/index.js',
                'lib/index.mjs',
                'lib/index.ts',
                'dist/index.js',
                'dist/index.mjs',
                'dist/index.cjs',
                'src/index.js',
                'src/index.mjs',
                'src/index.ts',
                'build/index.js',
                'build/index.mjs',
                'es/index.js',
                'es/index.mjs',
                'esm/index.js',
                'esm/index.mjs',
                'cjs/index.js',
                'cjs/index.cjs',
                'main.js',
                'main.mjs',
                'main.ts',
                `${packageInfo.name}.js`,
                `${packageInfo.name}.mjs`,
              ]
              for (const entry of commonEntries) {
                const entryPath = join(packagePath, entry)
                if (existsSync(entryPath)) {
                  pkg = this.require(entryPath)
                  break
                }
              }
            }
          }
        }
        // catch (pathError) {
        catch {
          // Try ES module import as last resort
          try {
            const importPath = join(this.tempDir, 'node_modules', packageName)
            pkg = await import(importPath)
          }
          // catch (importError) {
          catch {
            throw new Error(
              `Could not load package: ${
                typeof requireError === 'object' && requireError !== null && 'message' in requireError
                  ? (requireError as any).message
                  : 'Unknown error'
              }`,
            )
          }
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
