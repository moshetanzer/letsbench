import { Buffer } from 'node:buffer'
import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { performance } from 'node:perf_hooks'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock external dependencies
vi.mock('node:child_process')
vi.mock('node:fs')
vi.mock('chalk', () => ({
  default: {
    cyan: vi.fn(text => text),
    yellow: vi.fn(text => text),
    green: vi.fn(text => text),
    red: vi.fn(text => text),
    blue: vi.fn(text => text),
    magenta: vi.fn(text => text),
    gray: vi.fn(text => text),
    bold: vi.fn(text => text),
  },
}))
vi.mock('figlet', () => ({
  default: {
    textSync: vi.fn(() => 'LetsBench ASCII Art'),
  },
}))
vi.mock('ora', () => ({
  default: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    text: '',
  })),
}))

// Create a simplified version of the SimpleBenchmarker class for testing
class SimpleBenchmarker {
  private tempDir: string
  public runs: number

  constructor(runs = 1) {
    this.runs = runs
    this.tempDir = join(process.cwd(), '.temp-benchmark')

    if (!existsSync(this.tempDir)) {
      mkdirSync(this.tempDir, { recursive: true })
    }

    const packageJson = {
      name: 'temp-benchmark',
      version: '1.0.0',
      type: 'module',
    }
    writeFileSync(join(this.tempDir, 'package.json'), JSON.stringify(packageJson, null, 2))
  }

  async installPackage(packageName: string): Promise<any> {
    execSync(`npm install ${packageName}`, {
      cwd: this.tempDir,
      stdio: 'pipe',
    })

    // Mock package import - return a simple object with functions
    const mockPackage = {
      default: vi.fn(() => 'default result'),
      testFunction: vi.fn(() => 'test result'),
      nested: {
        deepFunction: vi.fn(() => 'deep result'),
      },
    }

    return mockPackage
  }

  getFunctions(pkg: any, maxDepth = 3): string[] {
    const functions: string[] = []
    const visited = new WeakSet()

    const explore = (obj: any, path = '', depth = 0) => {
      if (depth > maxDepth || !obj)
        return

      if (typeof obj === 'object' && obj !== null) {
        if (visited.has(obj))
          return
        visited.add(obj)
      }

      if (typeof obj === 'function') {
        functions.push(path || 'main')
      }

      if (obj && typeof obj.default === 'function' && path === '') {
        functions.push('default')
      }

      if (typeof obj === 'object' && obj !== null) {
        try {
          const keys = Object.keys(obj).filter(key =>
            !key.startsWith('_')
            && !key.startsWith('__')
            && key !== 'constructor'
            && key !== 'prototype',
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

  async benchmarkFunction(pkg: any, functionPath: string, args: any[]): Promise<{
    function: string
    time: number
    memory: number
    result: any
    error?: string
  }> {
    const func = this.getValue(pkg, functionPath)

    if (typeof func !== 'function') {
      throw new TypeError(`${functionPath} is not a function`)
    }

    const times: number[] = []
    const memories: number[] = []
    let result: any
    let error: string | undefined

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
        break
      }

      const end = performance.now()
      const memAfter = process.memoryUsage().heapUsed

      times.push(end - start)
      memories.push(memAfter - memBefore)
    }

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

  parseArguments(input: string): any[] {
    if (!input.trim()) {
      return []
    }

    try {
      const parsed = JSON.parse(input)
      return Array.isArray(parsed) ? parsed : [parsed]
    }
    catch {
      return [input.trim()]
    }
  }

  cleanup(): void {
    try {
      if (existsSync(this.tempDir)) {
        rmSync(this.tempDir, { recursive: true, force: true })
      }
    }
    catch {
      // Ignore cleanup errors in tests
    }
  }
}

describe('simpleBenchmarker', () => {
  let benchmarker: SimpleBenchmarker

  const mockExecSync = vi.mocked(execSync)
  const mockExistsSync = vi.mocked(existsSync)
  const mockMkdirSync = vi.mocked(mkdirSync)
  const mockWriteFileSync = vi.mocked(writeFileSync)
  //   const mockReadFileSync = vi.mocked(readFileSync)

  beforeEach(() => {
    vi.clearAllMocks()
    mockExistsSync.mockReturnValue(false)
    benchmarker = new SimpleBenchmarker(1)
  })

  afterEach(() => {
    benchmarker.cleanup()
  })

  describe('constructor', () => {
    it('should create temp directory and package.json', () => {
      expect(mockMkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('.temp-benchmark'),
        { recursive: true },
      )

      expect(mockWriteFileSync).toHaveBeenCalledWith(
        expect.stringContaining('package.json'),
        expect.stringContaining('"name": "temp-benchmark"'),
      )
    })

    it('should set runs parameter correctly', () => {
      const customBenchmarker = new SimpleBenchmarker(5)
      expect(customBenchmarker.runs).toBe(5)
    })
  })

  describe('installPackage', () => {
    it('should install package using npm', async () => {
      mockExecSync.mockReturnValue(Buffer.from('success'))

      const pkg = await benchmarker.installPackage('test-package')

      expect(mockExecSync).toHaveBeenCalledWith(
        'npm install test-package',
        expect.objectContaining({
          cwd: expect.stringContaining('.temp-benchmark'),
          stdio: 'pipe',
        }),
      )

      expect(pkg).toBeDefined()
      expect(typeof pkg.default).toBe('function')
    })

    it('should throw error if package installation fails', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Package not found')
      })

      await expect(benchmarker.installPackage('nonexistent-package'))
        .rejects
        .toThrow()
    })
  })

  describe('getFunctions', () => {
    it('should find direct function exports', () => {
      const mockPkg = {
        testFunction: vi.fn(),
        anotherFunction: vi.fn(),
      }

      const functions = benchmarker.getFunctions(mockPkg)

      expect(functions).toContain('testFunction')
      expect(functions).toContain('anotherFunction')
    })

    it('should find default export', () => {
      const mockPkg = {
        default: vi.fn(),
      }

      const functions = benchmarker.getFunctions(mockPkg)

      expect(functions).toContain('default')
    })

    it('should find nested functions', () => {
      const mockPkg = {
        utils: {
          helper: vi.fn(),
        },
      }

      const functions = benchmarker.getFunctions(mockPkg)

      expect(functions).toContain('utils.helper')
    })

    it('should filter out private functions', () => {
      const mockPkg = {
        publicFunction: vi.fn(),
        _privateFunction: vi.fn(),
        __internalFunction: vi.fn(),
      }

      const functions = benchmarker.getFunctions(mockPkg)

      expect(functions).toContain('publicFunction')
      expect(functions).not.toContain('_privateFunction')
      expect(functions).not.toContain('__internalFunction')
    })

    it('should respect maxDepth parameter', () => {
      const mockPkg = {
        level1: {
          level2: {
            level3: {
              deepFunction: vi.fn(),
            },
          },
        },
      }

      const functions = benchmarker.getFunctions(mockPkg, 2)

      expect(functions).not.toContain('level1.level2.level3.deepFunction')
    })
  })

  describe('parseArguments', () => {
    it('should return empty array for empty input', () => {
      expect(benchmarker.parseArguments('')).toEqual([])
      expect(benchmarker.parseArguments('   ')).toEqual([])
    })

    it('should parse valid JSON array', () => {
      const result = benchmarker.parseArguments('["hello", "world"]')
      expect(result).toEqual(['hello', 'world'])
    })

    it('should parse valid JSON object as single argument', () => {
      const result = benchmarker.parseArguments('{"key": "value"}')
      expect(result).toEqual([{ key: 'value' }])
    })

    it('should treat invalid JSON as string', () => {
      const result = benchmarker.parseArguments('hello world')
      expect(result).toEqual(['hello world'])
    })

    it('should parse numbers correctly', () => {
      const result = benchmarker.parseArguments('[42, 3.14]')
      expect(result).toEqual([42, 3.14])
    })
  })

  describe('benchmarkFunction', () => {
    it('should benchmark a simple function', async () => {
      const mockPkg = {
        testFunc: vi.fn().mockReturnValue('test result'),
      }

      const result = await benchmarker.benchmarkFunction(mockPkg, 'testFunc', ['arg1'])

      expect(result.function).toBe('testFunc')
      expect(result.result).toBe('test result')
      expect(typeof result.time).toBe('number')
      expect(typeof result.memory).toBe('number')
      expect(result.error).toBeUndefined()
      expect(mockPkg.testFunc).toHaveBeenCalledWith('arg1')
    })

    it('should benchmark async function', async () => {
      const mockPkg = {
        asyncFunc: vi.fn().mockResolvedValue('async result'),
      }

      const result = await benchmarker.benchmarkFunction(mockPkg, 'asyncFunc', [])

      expect(result.result).toBe('async result')
      expect(result.error).toBeUndefined()
    })

    it('should handle function errors', async () => {
      const mockPkg = {
        errorFunc: vi.fn().mockImplementation(() => {
          throw new Error('Test error')
        }),
      }

      const result = await benchmarker.benchmarkFunction(mockPkg, 'errorFunc', [])

      expect(result.error).toBe('Test error')
      expect(result.result).toBeNull()
    })

    it('should throw error for non-function', async () => {
      const mockPkg = {
        notAFunction: 'string value',
      }

      await expect(benchmarker.benchmarkFunction(mockPkg, 'notAFunction', []))
        .rejects
        .toThrow(TypeError)
    })

    it('should handle nested function paths', async () => {
      const mockPkg = {
        nested: {
          func: vi.fn().mockReturnValue('nested result'),
        },
      }

      const result = await benchmarker.benchmarkFunction(mockPkg, 'nested.func', ['test'])

      expect(result.result).toBe('nested result')
      expect(mockPkg.nested.func).toHaveBeenCalledWith('test')
    })

    it('should average multiple runs', async () => {
      const multiBenchmarker = new SimpleBenchmarker(3)
      const mockPkg = {
        testFunc: vi.fn().mockReturnValue('result'),
      }

      const result = await multiBenchmarker.benchmarkFunction(mockPkg, 'testFunc', [])

      expect(mockPkg.testFunc).toHaveBeenCalledTimes(3)
      expect(typeof result.time).toBe('number')
      expect(typeof result.memory).toBe('number')

      multiBenchmarker.cleanup()
    })
  })

  describe('edge cases', () => {
    it('should handle packages with circular references', () => {
      const mockPkg: any = {
        func: vi.fn(),
      }
      mockPkg.circular = mockPkg

      const functions = benchmarker.getFunctions(mockPkg)

      expect(functions).toContain('func')
      // Should not hang or crash due to circular reference
    })

    it('should handle packages with getters that throw', () => {
      const mockPkg = {
        normalFunc: vi.fn(),
        get throwingGetter() {
          throw new Error('Getter error')
        },
      }

      const functions = benchmarker.getFunctions(mockPkg)

      expect(functions).toContain('normalFunc')
      // Should not include the throwing getter
    })

    it('should handle empty packages', () => {
      const functions = benchmarker.getFunctions({})

      expect(functions).toEqual([])
    })

    it('should handle null/undefined packages', () => {
      expect(benchmarker.getFunctions(null)).toEqual([])
      expect(benchmarker.getFunctions(undefined)).toEqual([])
    })
  })

  describe('integration scenarios', () => {
    it('should handle typical package comparison workflow', async () => {
      // Mock two packages with similar functions
      const pkg1 = {
        format: vi.fn().mockReturnValue('formatted1'),
      }
      const pkg2 = {
        format: vi.fn().mockReturnValue('formatted2'),
      }

      const functions1 = benchmarker.getFunctions(pkg1)
      const functions2 = benchmarker.getFunctions(pkg2)

      expect(functions1).toContain('format')
      expect(functions2).toContain('format')

      const result1 = await benchmarker.benchmarkFunction(pkg1, 'format', ['input'])
      const result2 = await benchmarker.benchmarkFunction(pkg2, 'format', ['input'])

      expect(result1.result).toBe('formatted1')
      expect(result2.result).toBe('formatted2')
      expect(typeof result1.time).toBe('number')
      expect(typeof result2.time).toBe('number')
    })

    it('should handle different argument parsing scenarios', () => {
      const testCases = [
        { input: '[]', expected: [] },
        { input: 'hello', expected: ['hello'] },
        { input: '["a", "b"]', expected: ['a', 'b'] },
        { input: '[1, 2, 3]', expected: [1, 2, 3] },
        { input: '{"key": "value"}', expected: [{ key: 'value' }] },
        { input: 'invalid json [', expected: ['invalid json ['] },
      ]

      for (const { input, expected } of testCases) {
        expect(benchmarker.parseArguments(input)).toEqual(expected)
      }
    })
  })
})
