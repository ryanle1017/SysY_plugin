/**
 * SysY语言调试界面
 * 提供编译、运行和调试SysY代码的用户界面
 */

import { compilerService, debuggerService } from "./compiler-service.js";

/**
 * 创建调试UI界面
 */
export class DebugUI {
  constructor(editor, monaco) {
    this.editor = editor;
    this.monaco = monaco;
    this.container = null;
    this.debugPane = null;
    this.outputPane = null;
    this.variablesPane = null;
    this.breakpointsDecorations = [];
    this.currentLineDecoration = null;
    this.isDebugging = false;
  }

  /**
   * 初始化调试界面
   * @param {HTMLElement} parentElement - 父元素
   */
  init(parentElement) {
    // 创建主容器
    this.container = document.createElement("div");
    this.container.className = "debug-container";
    this.container.style.display = "flex";
    this.container.style.flexDirection = "column";
    this.container.style.width = "100%";
    this.container.style.marginTop = "10px";

    // 创建工具栏
    const toolbar = document.createElement("div");
    toolbar.className = "debug-toolbar";
    toolbar.style.display = "flex";
    toolbar.style.marginBottom = "5px";
    toolbar.style.gap = "5px";

    // 编译按钮
    const compileBtn = this.createButton("编译", "compile-btn", () =>
      this.compile()
    );

    // 运行按钮
    const runBtn = this.createButton("运行", "run-btn", () => this.run());
    runBtn.disabled = true;

    // 调试按钮
    const debugBtn = this.createButton("调试", "debug-btn", () =>
      this.startDebug()
    );
    debugBtn.disabled = true;

    // 继续按钮
    const continueBtn = this.createButton("继续(F8)", "continue-btn", () =>
      this.continue()
    );
    continueBtn.disabled = true;

    // 单步执行按钮
    const stepBtn = this.createButton("单步(F10)", "step-btn", () =>
      this.stepOver()
    );
    stepBtn.disabled = true;

    // 停止按钮
    const stopBtn = this.createButton("停止", "stop-btn", () =>
      this.stopDebug()
    );
    stopBtn.disabled = true;

    toolbar.appendChild(compileBtn);
    toolbar.appendChild(runBtn);
    toolbar.appendChild(debugBtn);
    toolbar.appendChild(continueBtn);
    toolbar.appendChild(stepBtn);
    toolbar.appendChild(stopBtn);

    // 保存按钮引用
    this.buttons = {
      compile: compileBtn,
      run: runBtn,
      debug: debugBtn,
      continue: continueBtn,
      step: stepBtn,
      stop: stopBtn,
    };

    // 创建调试面板容器
    this.debugPane = document.createElement("div");
    this.debugPane.className = "debug-pane";
    this.debugPane.style.display = "flex";
    this.debugPane.style.height = "200px";
    this.debugPane.style.border = "1px solid #444";
    this.debugPane.style.backgroundColor = "#1e1e1e";
    this.debugPane.style.marginTop = "5px";
    this.debugPane.style.overflow = "hidden";

    // 创建变量面板
    this.variablesPane = document.createElement("div");
    this.variablesPane.className = "variables-pane";
    this.variablesPane.style.flex = "1";
    this.variablesPane.style.overflow = "auto";
    this.variablesPane.style.padding = "5px";
    this.variablesPane.style.borderRight = "1px solid #444";

    const variablesTitle = document.createElement("div");
    variablesTitle.textContent = "变量";
    variablesTitle.style.fontWeight = "bold";
    variablesTitle.style.marginBottom = "5px";
    variablesTitle.style.borderBottom = "1px solid #555";
    variablesTitle.style.paddingBottom = "3px";

    const variablesList = document.createElement("div");
    variablesList.className = "variables-list";

    this.variablesPane.appendChild(variablesTitle);
    this.variablesPane.appendChild(variablesList);

    // 创建输出面板
    this.outputPane = document.createElement("div");
    this.outputPane.className = "output-pane";
    this.outputPane.style.flex = "2";
    this.outputPane.style.overflow = "auto";
    this.outputPane.style.padding = "5px";
    this.outputPane.style.fontFamily = "monospace";
    this.outputPane.style.fontSize = "12px";

    const outputTitle = document.createElement("div");
    outputTitle.textContent = "编译/运行输出";
    outputTitle.style.fontWeight = "bold";
    outputTitle.style.marginBottom = "5px";
    outputTitle.style.borderBottom = "1px solid #555";
    outputTitle.style.paddingBottom = "3px";

    const outputContent = document.createElement("div");
    outputContent.className = "output-content";

    this.outputPane.appendChild(outputTitle);
    this.outputPane.appendChild(outputContent);

    // 将面板添加到调试面板容器
    this.debugPane.appendChild(this.variablesPane);
    this.debugPane.appendChild(this.outputPane);

    this.debugPane.style.display = "none";

    // 添加组件到主容器
    this.container.appendChild(toolbar);
    this.container.appendChild(this.debugPane);

    // 添加到父元素
    parentElement.appendChild(this.container);

    // 注册编辑器和调试器事件
    this._setupEditorEvents();
    this._setupDebuggerEvents();

    // 注册键盘快捷键
    this._setupKeyboardShortcuts();
  }

  /**
   * 创建按钮
   * @private
   */
  createButton(text, className, onClick) {
    const button = document.createElement("button");
    button.textContent = text;
    button.className = className;
    button.style.padding = "4px 8px";
    button.style.backgroundColor = "#0e639c";
    button.style.color = "white";
    button.style.border = "none";
    button.style.borderRadius = "2px";
    button.style.cursor = "pointer";

    button.addEventListener("click", onClick);

    return button;
  }

  /**
   * 设置编辑器事件
   * @private
   */
  _setupEditorEvents() {
    // 添加边距点击监听器，用于切换断点
    this.editor.onMouseDown((e) => {
      if (
        e.target.type === this.monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN
      ) {
        const lineNumber = e.target.position.lineNumber;
        this.toggleBreakpoint(lineNumber);
      }
    });
  }

  /**
   * 设置调试器事件
   * @private
   */
  _setupDebuggerEvents() {
    debuggerService.addListener("sessionStarted", () => {
      this.isDebugging = true;
      this._updateButtons();
      this.debugPane.style.display = "flex";
    });

    debuggerService.addListener("sessionEnded", () => {
      this.isDebugging = false;
      this._updateButtons();
      this._clearCurrentLineHighlight();
    });

    debuggerService.addListener("terminated", () => {
      this.isDebugging = false;
      this._updateButtons();
      this._clearCurrentLineHighlight();
      this._appendToOutput("程序执行完毕", "success");
    });

    debuggerService.addListener("paused", (data) => {
      this._highlightCurrentLine(data.line);
      this._updateVariablesView();
      this._updateButtons();
    });

    debuggerService.addListener("resumed", () => {
      this._clearCurrentLineHighlight();
      this._updateButtons();
    });

    debuggerService.addListener("breakpointAdded", (data) => {
      this._updateBreakpointDecorations();
    });

    debuggerService.addListener("breakpointRemoved", (data) => {
      this._updateBreakpointDecorations();
    });
  }

  /**
   * 设置键盘快捷键
   * @private
   */
  _setupKeyboardShortcuts() {
    window.addEventListener("keydown", (e) => {
      // F8键：继续执行
      if (e.key === "F8" && this.isDebugging) {
        e.preventDefault();
        this.continue();
      }

      // F10键：单步执行
      if (e.key === "F10" && this.isDebugging) {
        e.preventDefault();
        this.stepOver();
      }

      // F5键：开始调试
      if (e.key === "F5" && !this.isDebugging) {
        e.preventDefault();
        this.startDebug();
      }
    });
  }

  /**
   * 编译代码
   */
  async compile() {
    const code = this.editor.getValue();
    this._clearOutput();
    this._appendToOutput("正在编译...", "info");

    try {
      const result = await compilerService.compile(code);

      if (result.success) {
        this._appendToOutput("编译成功！", "success");
        this.compileResult = result;
        this.buttons.run.disabled = false;
        this.buttons.debug.disabled = false;
      } else {
        this._appendToOutput("编译失败：", "error");

        // 显示编译错误
        result.errors.forEach((error) => {
          this._appendToOutput(`第${error.line}行: ${error.message}`, "error");
          this._highlightError(error);
        });

        // 显示警告
        result.warnings.forEach((warning) => {
          this._appendToOutput(
            `警告 - 第${warning.line}行: ${warning.message}`,
            "warning"
          );
        });
      }
    } catch (error) {
      this._appendToOutput(`编译器错误: ${error.message}`, "error");
    }
  }

  /**
   * 运行代码
   */
  async run() {
    if (!this.compileResult || !this.compileResult.executable) {
      this._appendToOutput("请先编译代码", "warning");
      return;
    }

    this._appendToOutput("运行程序...", "info");

    try {
      const result = await compilerService.run(this.compileResult.executable);

      if (result.success) {
        this._appendToOutput("程序执行结果:", "success");
        this._appendToOutput(result.output);
      } else {
        this._appendToOutput(`运行时错误: ${result.error}`, "error");
      }
    } catch (error) {
      this._appendToOutput(`运行时异常: ${error.message}`, "error");
    }
  }

  /**
   * 开始调试
   */
  startDebug() {
    if (!this.compileResult || !this.compileResult.executable) {
      this._appendToOutput("请先编译代码", "warning");
      return;
    }

    this._clearOutput();
    this._appendToOutput("开始调试...", "info");

    // 启动调试会话
    debuggerService.startSession(this.compileResult.executable);

    // 更新按钮状态
    this._updateButtons();

    // 显示调试面板
    this.debugPane.style.display = "flex";

    // 更新断点装饰器
    this._updateBreakpointDecorations();
  }

  /**
   * 继续执行
   */
  continue() {
    if (!this.isDebugging) return;

    debuggerService.continue();
    this._updateButtons();
  }

  /**
   * 单步执行
   */
  stepOver() {
    if (!this.isDebugging) return;

    debuggerService.stepOver();
    this._updateButtons();
  }

  /**
   * 停止调试
   */
  stopDebug() {
    if (!this.isDebugging) return;

    debuggerService.endSession();
    this._clearCurrentLineHighlight();
    this._updateButtons();
    this._appendToOutput("调试已停止", "info");
  }

  /**
   * 切换断点
   */
  toggleBreakpoint(line) {
    debuggerService.toggleBreakpoint(line);
  }

  /**
   * 更新按钮状态
   * @private
   */
  _updateButtons() {
    const session = debuggerService.currentSession;
    const isRunning = session && session.running;
    const isPaused = session && session.paused;

    this.buttons.compile.disabled = this.isDebugging;
    this.buttons.run.disabled = this.isDebugging || !this.compileResult;
    this.buttons.debug.disabled = this.isDebugging || !this.compileResult;
    this.buttons.continue.disabled =
      !this.isDebugging || isRunning || !isPaused;
    this.buttons.step.disabled = !this.isDebugging || isRunning || !isPaused;
    this.buttons.stop.disabled = !this.isDebugging;
  }

  /**
   * 添加输出内容
   * @private
   */
  _appendToOutput(text, type = "normal") {
    const outputContent = this.outputPane.querySelector(".output-content");
    const line = document.createElement("div");
    line.textContent = text;

    switch (type) {
      case "error":
        line.style.color = "#f48771";
        break;
      case "warning":
        line.style.color = "#cca700";
        break;
      case "success":
        line.style.color = "#89d185";
        break;
      case "info":
        line.style.color = "#75beff";
        break;
      default:
        line.style.color = "#cccccc";
    }

    outputContent.appendChild(line);
    outputContent.scrollTop = outputContent.scrollHeight;
  }

  /**
   * 清空输出
   * @private
   */
  _clearOutput() {
    const outputContent = this.outputPane.querySelector(".output-content");
    outputContent.innerHTML = "";
  }

  /**
   * 更新变量视图
   * @private
   */
  _updateVariablesView() {
    const variablesList = this.variablesPane.querySelector(".variables-list");
    variablesList.innerHTML = "";

    const variables = debuggerService.getVariables();

    if (variables.size === 0) {
      const emptyMsg = document.createElement("div");
      emptyMsg.textContent = "没有可用变量";
      emptyMsg.style.color = "#999";
      emptyMsg.style.fontStyle = "italic";
      variablesList.appendChild(emptyMsg);
      return;
    }

    // 创建变量表格
    const table = document.createElement("table");
    table.style.width = "100%";
    table.style.borderCollapse = "collapse";

    // 添加表头
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");

    const nameHeader = document.createElement("th");
    nameHeader.textContent = "名称";
    nameHeader.style.textAlign = "left";
    nameHeader.style.padding = "3px";

    const valueHeader = document.createElement("th");
    valueHeader.textContent = "值";
    valueHeader.style.textAlign = "left";
    valueHeader.style.padding = "3px";

    headerRow.appendChild(nameHeader);
    headerRow.appendChild(valueHeader);
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // 添加表体
    const tbody = document.createElement("tbody");

    variables.forEach((value, name) => {
      const row = document.createElement("tr");

      const nameCell = document.createElement("td");
      nameCell.textContent = name;
      nameCell.style.padding = "3px";

      const valueCell = document.createElement("td");
      valueCell.textContent = value;
      valueCell.style.padding = "3px";

      row.appendChild(nameCell);
      row.appendChild(valueCell);
      tbody.appendChild(row);
    });

    table.appendChild(tbody);
    variablesList.appendChild(table);
  }

  /**
   * 高亮当前行
   * @private
   */
  _highlightCurrentLine(lineNumber) {
    this._clearCurrentLineHighlight();

    this.currentLineDecoration = this.editor.deltaDecorations(
      [],
      [
        {
          range: new this.monaco.Range(lineNumber, 1, lineNumber, 1),
          options: {
            isWholeLine: true,
            className: "current-line-highlight",
            glyphMarginClassName: "current-line-glyph",
          },
        },
      ]
    );

    // 确保当前行可见
    this.editor.revealLineInCenter(lineNumber);
  }

  /**
   * 清除当前行高亮
   * @private
   */
  _clearCurrentLineHighlight() {
    if (this.currentLineDecoration) {
      this.currentLineDecoration = this.editor.deltaDecorations(
        this.currentLineDecoration,
        []
      );
    }
  }

  /**
   * 高亮错误
   * @private
   */
  _highlightError(error) {
    const errorDecoration = this.editor.deltaDecorations(
      [],
      [
        {
          range: new this.monaco.Range(
            error.line,
            error.column,
            error.endLine,
            error.endColumn
          ),
          options: {
            className: "error-highlight",
            hoverMessage: { value: error.message },
          },
        },
      ]
    );

    // 5秒后清除高亮
    setTimeout(() => {
      this.editor.deltaDecorations(errorDecoration, []);
    }, 5000);
  }

  /**
   * 更新断点装饰器
   * @private
   */
  _updateBreakpointDecorations() {
    const breakpoints = debuggerService.getBreakpoints();
    const decorations = [];

    breakpoints.forEach((line) => {
      decorations.push({
        range: new this.monaco.Range(line, 1, line, 1),
        options: {
          isWholeLine: true,
          glyphMarginClassName: "breakpoint-glyph",
        },
      });
    });

    this.breakpointsDecorations = this.editor.deltaDecorations(
      this.breakpointsDecorations,
      decorations
    );
  }
}

/**
 * 添加必要的CSS样式
 */
export function addDebugStyles() {
  const styleSheet = document.createElement("style");
  styleSheet.type = "text/css";
  styleSheet.textContent = `
    .current-line-highlight {
      background-color: rgba(58, 58, 127, 0.5);
    }
    .current-line-glyph {
      background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath fill='%23FC6' d='M4.5 9H4v1h.5l.5-.5L5 9h-.5z'/%3E%3Cpath fill='%23FC6' d='M8 1c3.9 0 7 3.1 7 7s-3.1 7-7 7-7-3.1-7-7 3.1-7 7-7zm0 1c-3.3 0-6 2.7-6 6s2.7 6 6 6 6-2.7 6-6-2.7-6-6-6z'/%3E%3Cpath fill='%23FC6' d='M11 7v1L9 8V7h2z'/%3E%3Cpath fill='%23FC6' d='M12 10H7V5h1v4h4v1z'/%3E%3C/svg%3E") center center no-repeat;
    }
    .breakpoint-glyph {
      background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Ccircle fill='%23E51400' cx='8' cy='8' r='5' stroke='white' stroke-width='1'/%3E%3C/svg%3E") center center no-repeat;
    }
    .error-highlight {
      background-color: rgba(255, 18, 18, 0.3);
      border-bottom: 2px wavy #f48771;
    }
    .debug-container button:hover:not([disabled]) {
      background-color: #1177bb;
    }
    .debug-container button:disabled {
      background-color: #4f4f4f;
      cursor: default;
      opacity: 0.7;
    }
  `;
  document.head.appendChild(styleSheet);
}
