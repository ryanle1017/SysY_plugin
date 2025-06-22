/**
 * SysY语言编译器服务 - 模拟实现
 * 提供编译和执行SysY代码的功能
 */

// 语法分析和编译错误的类型定义
const ErrorType = {
  SYNTAX: "syntax",
  SEMANTIC: "semantic",
  TYPE: "type",
  REFERENCE: "reference",
};

/**
 * 编译结果类
 */
class CompileResult {
  constructor(success, errors = [], warnings = [], executable = null) {
    this.success = success;
    this.errors = errors;
    this.warnings = warnings;
    this.executable = executable;
  }
}

/**
 * 编译错误类
 */
class CompileError {
  constructor(type, message, line, column, endLine, endColumn, code = "") {
    this.type = type;
    this.message = message;
    this.line = line;
    this.column = column;
    this.endLine = endLine || line;
    this.endColumn = endColumn || column + 1;
    this.code = code;
  }
}

/**
 * 可执行代码类 - 模拟
 */
class Executable {
  constructor(instructions, symbolTable) {
    this.instructions = instructions;
    this.symbolTable = symbolTable;
    this.programCounter = 0;
    this.callStack = [];
    this.memory = new Map();
    this.breakpoints = new Set();
    this.running = false;
    this.paused = false;
  }
}

/**
 * 符号表项
 */
class Symbol {
  constructor(name, type, value, lineStart, lineEnd) {
    this.name = name;
    this.type = type;
    this.value = value;
    this.lineStart = lineStart;
    this.lineEnd = lineEnd;
  }
}

/**
 * 简单的SysY编译器 - 模拟实现
 */
class SysYCompiler {
  constructor() {
    this.lastCompileResult = null;
  }

  /**
   * 编译SysY代码
   * @param {string} code - 源代码
   * @returns {CompileResult} - 编译结果
   */
  compile(code) {
    const errors = [];
    const warnings = [];

    try {
      // 第一步：词法和语法分析
      this._performSyntaxAnalysis(code, errors, warnings);

      // 如果有语法错误，立即返回
      if (errors.length > 0) {
        this.lastCompileResult = new CompileResult(false, errors, warnings);
        return this.lastCompileResult;
      }

      // 第二步：语义分析和类型检查
      this._performSemanticAnalysis(code, errors, warnings);

      // 如果有语义错误，立即返回
      if (errors.length > 0) {
        this.lastCompileResult = new CompileResult(false, errors, warnings);
        return this.lastCompileResult;
      }

      // 第三步：代码生成
      const executable = this._generateExecutable(code);

      this.lastCompileResult = new CompileResult(
        true,
        [],
        warnings,
        executable
      );
      return this.lastCompileResult;
    } catch (e) {
      console.error("编译过程中发生未预期的错误:", e);
      errors.push(
        new CompileError(
          ErrorType.SYNTAX,
          "编译器内部错误: " + e.message,
          1,
          1,
          1,
          1
        )
      );
      this.lastCompileResult = new CompileResult(false, errors, warnings);
      return this.lastCompileResult;
    }
  }

  /**
   * 执行语法分析
   * @private
   */
  _performSyntaxAnalysis(code, errors, warnings) {
    const lines = code.split("\n");

    // 检查基本的语法错误
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // 检查缺少分号
      if (
        line &&
        !line.startsWith("//") &&
        !line.endsWith("{") &&
        !line.endsWith("}") &&
        !line.endsWith(";") &&
        line.length > 0
      ) {
        warnings.push(
          new CompileError(
            ErrorType.SYNTAX,
            "语句可能缺少分号",
            i + 1,
            line.length,
            i + 1,
            line.length + 1,
            line
          )
        );
      }

      // 检查括号是否匹配
      let openBrackets = 0;
      for (let j = 0; j < line.length; j++) {
        if (line[j] === "(") openBrackets++;
        else if (line[j] === ")") openBrackets--;

        if (openBrackets < 0) {
          errors.push(
            new CompileError(
              ErrorType.SYNTAX,
              "括号不匹配，多余的右括号",
              i + 1,
              j + 1,
              i + 1,
              j + 2,
              line
            )
          );
          break;
        }
      }

      if (openBrackets > 0) {
        errors.push(
          new CompileError(
            ErrorType.SYNTAX,
            "括号不匹配，缺少右括号",
            i + 1,
            line.length,
            i + 1,
            line.length + 1,
            line
          )
        );
      }

      // 检查数组初始化溢出
      const arrayInitMatch = line.match(/(\w+)\s*\[(\d+)\]\s*=\s*{([^}]*)}/);
      if (arrayInitMatch) {
        const arrayName = arrayInitMatch[1];
        const size = parseInt(arrayInitMatch[2]);
        const initItems = arrayInitMatch[3]
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s.length > 0);

        if (initItems.length > size) {
          errors.push(
            new CompileError(
              ErrorType.SEMANTIC,
              `数组 ${arrayName} 的初始化元素数量(${initItems.length})超过了数组大小(${size})`,
              i + 1,
              line.indexOf("[") + 1,
              i + 1,
              line.indexOf("]"),
              line
            )
          );
        }
      }
    }
  }

  /**
   * 执行语义分析和类型检查
   * @private
   */
  _performSemanticAnalysis(code, errors, warnings) {
    // 在这个简单的模拟实现中，我们只进行基本的符号检查
    // 符号表(简化)
    const symbols = new Map();
    // 当前作用域
    let scope = "global";

    const lines = code.split("\n");
    const variableDeclarationRegex =
      /(int|float|void)\s+(\w+)(?:\s*\[(\d+)\])?\s*(?:=\s*([^;]*))?/;
    const functionDeclarationRegex = /(int|float|void)\s+(\w+)\s*\(([^)]*)\)/;
    const variableUseRegex = /(\w+)(?:\s*\[\s*([^\]]*)\])?/g;

    // 第一遍：收集声明
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // 忽略注释和空行
      if (line.startsWith("//") || line.length === 0) continue;

      // 检查变量声明
      const varMatch = line.match(variableDeclarationRegex);
      if (varMatch) {
        const type = varMatch[1];
        const name = varMatch[2];
        const isArray = !!varMatch[3];

        // 检查变量重定义
        if (symbols.has(`${scope}.${name}`)) {
          errors.push(
            new CompileError(
              ErrorType.SEMANTIC,
              `变量 '${name}' 在当前作用域中已被定义`,
              i + 1,
              line.indexOf(name),
              i + 1,
              line.indexOf(name) + name.length,
              line
            )
          );
        } else {
          symbols.set(`${scope}.${name}`, {
            type,
            isArray,
            scope,
            line: i + 1,
          });
        }
      }

      // 检查函数声明
      const funcMatch = line.match(functionDeclarationRegex);
      if (funcMatch) {
        const returnType = funcMatch[1];
        const name = funcMatch[2];

        // 函数体开始时，更新作用域
        scope = name;

        // 检查函数重定义
        if (symbols.has(`global.${name}`)) {
          errors.push(
            new CompileError(
              ErrorType.SEMANTIC,
              `函数 '${name}' 已被定义`,
              i + 1,
              line.indexOf(name),
              i + 1,
              line.indexOf(name) + name.length,
              line
            )
          );
        } else {
          symbols.set(`global.${name}`, {
            type: "function",
            returnType,
            scope: "global",
            line: i + 1,
          });
        }
      }

      // 检测作用域结束
      if (line === "}") {
        // 如果在函数内部，则返回全局作用域
        if (scope !== "global") {
          scope = "global";
        }
      }
    }

    // 第二遍：检查使用
    scope = "global";
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // 忽略注释和空行
      if (line.startsWith("//") || line.length === 0) continue;

      // 检测作用域变化
      if (line.match(functionDeclarationRegex)) {
        scope = line.match(functionDeclarationRegex)[2];
      }

      // 检测作用域结束
      if (line === "}") {
        if (scope !== "global") {
          scope = "global";
        }
      }

      // 检查变量使用
      let varUseMatch;
      while ((varUseMatch = variableUseRegex.exec(line)) !== null) {
        const varName = varUseMatch[1];

        // 忽略关键字和声明
        if (
          [
            "int",
            "float",
            "void",
            "if",
            "else",
            "while",
            "for",
            "return",
          ].includes(varName)
        ) {
          continue;
        }

        // 在当前行中检查是否为声明语句
        if (line.match(new RegExp(`(int|float|void)\\s+${varName}`))) {
          continue;
        }

        // 检查变量是否已声明
        if (
          !symbols.has(`${scope}.${varName}`) &&
          !symbols.has(`global.${varName}`)
        ) {
          errors.push(
            new CompileError(
              ErrorType.REFERENCE,
              `未定义的变量或函数 '${varName}'`,
              i + 1,
              line.indexOf(varName),
              i + 1,
              line.indexOf(varName) + varName.length,
              line
            )
          );
        }

        // 如果是数组访问，检查索引
        if (varUseMatch[2]) {
          const index = varUseMatch[2].trim();

          // 如果索引是字面量数字，检查是否越界
          if (/^\d+$/.test(index)) {
            const symbol =
              symbols.get(`${scope}.${varName}`) ||
              symbols.get(`global.${varName}`);
            if (symbol && symbol.isArray) {
              // 在这个简化模型中，我们没有存储数组大小，所以不检查越界
            }
          }
        }
      }
    }
  }

  /**
   * 生成可执行代码
   * @private
   */
  _generateExecutable(code) {
    // 在这个模拟实现中，我们创建一个简单的指令集和符号表
    const instructions = [];
    const symbolTable = new Map();
    const lines = code.split("\n");

    // 为每行代码生成一个简单的"指令"
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line && !line.startsWith("//")) {
        instructions.push({
          line: i + 1,
          code: line,
          operation: this._getOperation(line),
        });
      }
    }

    // 提取变量声明到符号表
    this._buildSymbolTable(code, symbolTable);

    return new Executable(instructions, symbolTable);
  }

  /**
   * 从代码行推断操作类型
   * @private
   */
  _getOperation(line) {
    if (line.includes("=") && !line.startsWith("if") && !line.includes("=="))
      return "assignment";
    if (line.startsWith("if")) return "condition";
    if (line.startsWith("while")) return "loop";
    if (line.startsWith("for")) return "loop";
    if (line.includes("return")) return "return";
    if (line.match(/\w+\s*\(/)) return "call";
    if (line.match(/^(int|float|void)/)) return "declaration";
    return "other";
  }

  /**
   * 构建符号表
   * @private
   */
  _buildSymbolTable(code, symbolTable) {
    const lines = code.split("\n");
    const variableDeclarationRegex =
      /(int|float|void)\s+(\w+)(?:\s*\[(\d+)\])?\s*(?:=\s*([^;]*))?/;
    let currentFunction = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // 检测函数定义
      if (line.includes("(") && line.match(/^(int|float|void)/)) {
        const funcMatch = line.match(/(int|float|void)\s+(\w+)\s*\(/);
        if (funcMatch) {
          currentFunction = funcMatch[2];
          symbolTable.set(
            currentFunction,
            new Symbol(
              currentFunction,
              "function",
              null,
              i + 1,
              null // 结束行待定
            )
          );
        }
      }

      // 检测函数结束
      if (line === "}") {
        if (currentFunction && symbolTable.has(currentFunction)) {
          const funcSymbol = symbolTable.get(currentFunction);
          funcSymbol.lineEnd = i + 1;
          currentFunction = null;
        }
      }

      // 检测变量声明
      const varMatch = line.match(variableDeclarationRegex);
      if (varMatch) {
        const type = varMatch[1];
        const name = varMatch[2];

        symbolTable.set(
          name,
          new Symbol(
            name,
            type,
            null, // 初始值为null
            i + 1,
            i + 1
          )
        );
      }
    }
  }

  /**
   * 获取最后一次编译结果
   * @returns {CompileResult} - 编译结果
   */
  getLastResult() {
    return this.lastCompileResult;
  }
}

// 导出编译器服务
export const compilerService = {
  /**
   * 编译代码
   * @param {string} code - 源代码
   * @returns {Promise<CompileResult>} - 编译结果
   */
  compile(code) {
    const compiler = new SysYCompiler();
    const result = compiler.compile(code);
    return Promise.resolve(result);
  },

  /**
   * 运行编译后的代码
   * @param {Executable} executable - 可执行代码
   * @param {Object} options - 执行选项
   * @returns {Promise<Object>} - 执行结果
   */
  run(executable, options = {}) {
    if (!executable) {
      return Promise.reject(new Error("没有可执行的代码"));
    }

    return new Promise((resolve, reject) => {
      try {
        // 模拟执行，仅返回成功结果
        setTimeout(() => {
          resolve({
            success: true,
            output: "程序执行成功",
            exitCode: 0,
          });
        }, 1000);
      } catch (error) {
        reject(error);
      }
    });
  },
};

// 导出调试器服务
export const debuggerService = {
  /**
   * 当前调试会话
   */
  currentSession: null,

  /**
   * 事件监听器
   */
  listeners: new Map(),

  /**
   * 启动调试会话
   * @param {Executable} executable - 可执行代码
   */
  startSession(executable) {
    if (this.currentSession) {
      this.endSession();
    }

    this.currentSession = {
      executable: executable,
      currentLine: 0,
      variables: new Map(),
      callStack: [],
      breakpoints: new Set(),
      paused: false,
      running: false,
    };

    this._emit("sessionStarted", { session: this.currentSession });
    return this.currentSession;
  },

  /**
   * 结束调试会话
   */
  endSession() {
    if (this.currentSession) {
      this._emit("sessionEnded", { session: this.currentSession });
      this.currentSession = null;
    }
  },

  /**
   * 设置断点
   * @param {number} line - 行号
   */
  toggleBreakpoint(line) {
    if (!this.currentSession) return;

    if (this.currentSession.breakpoints.has(line)) {
      this.currentSession.breakpoints.delete(line);
      this._emit("breakpointRemoved", { line });
    } else {
      this.currentSession.breakpoints.add(line);
      this._emit("breakpointAdded", { line });
    }
  },

  /**
   * 获取所有断点
   * @returns {Set<number>} - 断点集合
   */
  getBreakpoints() {
    return this.currentSession ? this.currentSession.breakpoints : new Set();
  },

  /**
   * 运行代码直到下一个断点
   */
  continue() {
    if (!this.currentSession || this.currentSession.running) return;

    this.currentSession.running = true;
    this.currentSession.paused = false;
    this._emit("resumed", { session: this.currentSession });

    // 模拟执行到下一个断点
    setTimeout(() => {
      // 找到断点对应的指令
      const instructions = this.currentSession.executable.instructions;
      const breakpoints = this.currentSession.breakpoints;

      let nextBreakpointIndex = -1;
      for (
        let i = this.currentSession.currentLine + 1;
        i < instructions.length;
        i++
      ) {
        if (breakpoints.has(instructions[i].line)) {
          nextBreakpointIndex = i;
          break;
        }
      }

      if (nextBreakpointIndex !== -1) {
        this.currentSession.currentLine = nextBreakpointIndex;
        this.currentSession.paused = true;
        this.currentSession.running = false;
        this._emit("paused", {
          reason: "breakpoint",
          line: instructions[nextBreakpointIndex].line,
          session: this.currentSession,
        });
      } else {
        // 如果没有断点，执行到结束
        this.currentSession.currentLine = instructions.length - 1;
        this.currentSession.running = false;
        this._emit("terminated", { session: this.currentSession });
      }
    }, 1000);
  },

  /**
   * 单步执行
   */
  stepOver() {
    if (!this.currentSession || this.currentSession.running) return;

    this.currentSession.running = true;
    this._emit("stepping", { session: this.currentSession });

    // 模拟单步执行
    setTimeout(() => {
      const instructions = this.currentSession.executable.instructions;

      if (this.currentSession.currentLine < instructions.length - 1) {
        this.currentSession.currentLine++;
        this.currentSession.paused = true;
        this.currentSession.running = false;

        // 更新变量值（模拟）
        if (
          instructions[this.currentSession.currentLine].operation ===
          "assignment"
        ) {
          const line = instructions[this.currentSession.currentLine].code;
          const assignMatch = line.match(/(\w+)\s*=\s*([^;]+)/);

          if (assignMatch) {
            const varName = assignMatch[1];
            const value = Math.floor(Math.random() * 100); // 模拟值

            this.currentSession.variables.set(varName, value);
          }
        }

        this._emit("paused", {
          reason: "step",
          line: instructions[this.currentSession.currentLine].line,
          session: this.currentSession,
        });
      } else {
        // 执行到结束
        this.currentSession.running = false;
        this._emit("terminated", { session: this.currentSession });
      }
    }, 500);
  },

  /**
   * 获取变量值
   * @returns {Map<string, any>} - 变量表
   */
  getVariables() {
    return this.currentSession ? this.currentSession.variables : new Map();
  },

  /**
   * 添加事件监听器
   * @param {string} event - 事件名称
   * @param {Function} callback - 回调函数
   */
  addListener(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
  },

  /**
   * 移除事件监听器
   * @param {string} event - 事件名称
   * @param {Function} callback - 回调函数
   */
  removeListener(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  },

  /**
   * 触发事件
   * @private
   */
  _emit(event, data) {
    if (this.listeners.has(event)) {
      for (const callback of this.listeners.get(event)) {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${event} listener:`, error);
        }
      }
    }
  },
};
