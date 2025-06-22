import {
    addMonacoStyles,
    defineUserServices,
    MonacoEditorLanguageClientWrapper,
} from "./bundle/index.js";
import { debuggerService } from "./compiler-service.js";
import { addDebugStyles, DebugUI } from "./debug-ui.js";
import { ExampleLoader } from "./example-loader.js";
import { configureWorker } from "./setup.js";

addMonacoStyles("monaco-editor-styles");

export const setupConfigExtended = () => {
  const extensionFilesOrContents = new Map();
  const languageConfigUrl = new URL(
    "../language-configuration.json",
    window.location.href
  );
  const textmateConfigUrl = new URL(
    "../syntaxes/hello-world.tmLanguage.json",
    window.location.href
  );
  extensionFilesOrContents.set(
    "/language-configuration.json",
    languageConfigUrl
  );
  extensionFilesOrContents.set("/hello-world-grammar.json", textmateConfigUrl);

  return {
    wrapperConfig: {
      serviceConfig: defineUserServices(),
      editorAppConfig: {
        $type: "extended",
        languageId: "hello-world",
        code: `// 在这里编写SysY语言代码
// 例如尝试创建一个数组大小溢出的情况: int numbers[5] = {1, 2, 3, 4, 5, 6};

int main() {
    // 您的代码
    return 0;
}`,
        useDiffEditor: false,
        extensions: [
          {
            config: {
              name: "hello-world-web",
              publisher: "generator-langium",
              version: "1.0.0",
              engines: {
                vscode: "*",
              },
              contributes: {
                languages: [
                  {
                    id: "hello-world",
                    extensions: [".hello-world"],
                    configuration: "./language-configuration.json",
                  },
                ],
                grammars: [
                  {
                    language: "hello-world",
                    scopeName: "source.hello-world",
                    path: "./hello-world-grammar.json",
                  },
                ],
              },
            },
            filesOrContents: extensionFilesOrContents,
          },
        ],
        userConfiguration: {
          json: JSON.stringify({
            "workbench.colorTheme": "Default Dark Modern",
            "editor.semanticHighlighting.enabled": true,
            "editor.bracketPairColorization.enabled": true,
            "editor.guides.bracketPairs": true,
            "editor.formatOnSave": true,
            "editor.formatOnType": true,
            "editor.formatOnPaste": true,
            "editor.autoIndent": "advanced",
            "editor.insertSpaces": true,
            "editor.tabSize": 4,
            "editor.detectIndentation": false,
            "editor.trimAutoWhitespace": true,
            "editor.autoClosingBrackets": "always",
            "editor.autoClosingQuotes": "always",
            "editor.autoSurround": "languageDefined",
            "editor.suggest.insertMode": "insert",
            "editor.acceptSuggestionOnCommitCharacter": true,
            "editor.acceptSuggestionOnEnter": "on",
            "editor.quickSuggestions": {
              "other": true,
              "comments": false,
              "strings": false
            },
            "editor.wordBasedSuggestions": "matchingDocuments",
            "editor.suggestOnTriggerCharacters": true,
            "editor.parameterHints.enabled": true,
            "editor.hover.enabled": true,
            "editor.codeLens": true,
            "editor.lightbulb.enabled": "onCode",
          }),
        },
      },
    },
    languageClientConfig: configureWorker(),
  };
};

// 注册自定义的CodeAction提供程序
function registerQuickFixProvider(monaco, wrapper) {
  const editor = wrapper.getEditor();
  if (!editor || !monaco) return;

  // 注册数组大小溢出的诊断类型
  const ARRAY_SIZE_OVERFLOW = "array-size-overflow";

  // 模拟服务器诊断，检测数组大小溢出问题
  function detectArraySizeOverflow(model) {
    const markers = [];
    const text = model.getValue();
    const lines = text.split("\n");

    // 添加日志以帮助调试
    console.log("正在分析文档检测数组溢出...");

    lines.forEach((line, i) => {
      // 更宽泛的模式匹配，支持更多的数组声明和初始化形式
      if (line.includes("[") && line.includes("]") && line.includes("=")) {
        console.log(`检查第${i + 1}行: ${line}`);

        // 提取数组名和大小 - 使用更灵活的正则表达式
        const arrayMatch = line.match(/(\w+)\s*\[(\d+)\]/);
        if (arrayMatch && arrayMatch[1] && arrayMatch[2]) {
          const arrayName = arrayMatch[1];
          const currentSize = parseInt(arrayMatch[2], 10);
          console.log(`- 找到数组: ${arrayName}[${currentSize}]`);

          // 检查是否有初始化列表
          if (line.includes("{") && line.includes("}")) {
            // 提取括号内的内容
            const initListMatch = line.match(/=\s*{([^}]*)}/);
            if (initListMatch && initListMatch[1]) {
              const initContent = initListMatch[1].trim();
              const initElements = initContent.split(",").length;
              console.log(
                `- 初始化元素: ${initElements}个, 声明大小: ${currentSize}`
              );

              // 如果初始化元素数量超过声明大小，创建诊断标记
              if (initElements > currentSize) {
                console.log(
                  `- 检测到溢出! 数组 ${arrayName} 大小为 ${currentSize}，但有 ${initElements} 个初始化元素`
                );

                // 找到数组名和大小的位置
                const nameIndex = line.indexOf(arrayName);
                const sizeStart = line.indexOf("[", nameIndex) + 1;
                const sizeEnd = line.indexOf("]", sizeStart);

                // 创建错误标记
                const marker = {
                  severity: monaco.MarkerSeverity.Error,
                  startLineNumber: i + 1,
                  startColumn: sizeStart + 1,
                  endLineNumber: i + 1,
                  endColumn: sizeEnd + 1,
                  message: `数组 ${arrayName} 的初始化元素数量(${initElements})超过了数组大小(${currentSize})。`,
                  code: ARRAY_SIZE_OVERFLOW,
                  source: "hello-world",
                  tags: [],
                  relatedInformation: [],
                  data: {
                    arrayName,
                    currentSize,
                    initElements,
                  },
                };

                markers.push(marker);
              }
            }
          }
        }
      }
    });

    console.log(`共找到 ${markers.length} 个数组大小溢出问题`);

    // 将标记设置到模型
    monaco.editor.setModelMarkers(model, "hello-world-validator", markers);
    return markers;
  }

  // 当文档内容变化时重新运行诊断
  editor.onDidChangeModelContent(() => {
    const model = editor.getModel();
    if (model) {
      detectArraySizeOverflow(model);
    }
  });

  // 初始运行诊断
  setTimeout(() => {
    const model = editor.getModel();
    if (model) {
      detectArraySizeOverflow(model);
    }
  }, 1000);

  // 注册代码操作提供程序
  monaco.languages.registerCodeActionProvider("hello-world", {
    provideCodeActions(model, range, context, token) {
      console.log("CodeActionProvider被调用", context);
      const actions = [];

      // 检查是否有数组大小溢出错误
      const markers = context.markers || [];
      console.log(`发现 ${markers.length} 个标记`);

      for (const marker of markers) {
        console.log("处理标记:", marker);
        if (marker.code === ARRAY_SIZE_OVERFLOW && marker.data) {
          const { arrayName, currentSize, initElements } = marker.data;
          console.log(`为 ${arrayName} 创建修复操作`);

          // 创建修复操作
          const action = {
            title: `将数组 '${arrayName}' 的大小从 ${currentSize} 增大到 ${initElements}`,
            kind: "quickfix",
            diagnostics: [marker],
            isPreferred: true,
            edit: {
              edits: [
                {
                  resource: model.uri,
                  textEdit: {
                    range: {
                      startLineNumber: marker.startLineNumber,
                      startColumn: marker.startColumn,
                      endLineNumber: marker.endLineNumber,
                      endColumn: marker.endColumn,
                    },
                    text: initElements.toString(),
                  },
                },
              ],
            },
          };

          actions.push(action);
        }
      }

      console.log(`返回 ${actions.length} 个修复操作`);

      return {
        actions,
        dispose: () => {},
      };
    },
  });

  // 添加控制台命令以手动触发诊断
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyD, () => {
    const model = editor.getModel();
    if (model) {
      console.log("手动触发诊断...");
      detectArraySizeOverflow(model);
    }
  });

  console.log("QuickFix提供程序已注册");
}

// 注册代码格式化提供程序
function registerFormattingProvider(monaco) {
  monaco.languages.registerDocumentFormattingEditProvider("hello-world", {
    provideDocumentFormattingEdits(model, options, token) {
      return formatCode(model, options);
    }
  });

  monaco.languages.registerDocumentRangeFormattingEditProvider("hello-world", {
    provideDocumentRangeFormattingEdits(model, range, options, token) {
      return formatCodeRange(model, range, options);
    }
  });

  monaco.languages.registerOnTypeFormattingEditProvider("hello-world", {
    provideOnTypeFormattingEdits(model, position, ch, options, token) {
      return formatOnType(model, position, ch, options);
    }
  });

  console.log("格式化提供程序已注册");
}

// 格式化整个文档
function formatCode(model, options) {
  const text = model.getValue();
  const formatted = applyFormatting(text, options);
  
  if (formatted === text) {
    return [];
  }

  return [{
    range: model.getFullModelRange(),
    text: formatted
  }];
}

// 格式化指定范围
function formatCodeRange(model, range, options) {
  const text = model.getValueInRange(range);
  const formatted = applyFormatting(text, options);
  
  if (formatted === text) {
    return [];
  }

  return [{
    range: range,
    text: formatted
  }];
}

// 输入时格式化
function formatOnType(model, position, ch, options) {
  const edits = [];
  
  // 在输入 '}' 时自动调整缩进
  if (ch === '}') {
    const lineNumber = position.lineNumber;
    const line = model.getLineContent(lineNumber);
    const trimmedLine = line.trim();
    
    if (trimmedLine === '}') {
      // 找到匹配的 '{'
      let braceCount = 1;
      let indentLevel = 0;
      
      for (let i = lineNumber - 1; i >= 1 && braceCount > 0; i--) {
        const currentLine = model.getLineContent(i);
        for (const char of currentLine) {
          if (char === '{') braceCount--;
          if (char === '}') braceCount++;
        }
        if (braceCount === 0) {
          // 找到匹配的行，计算其缩进
          const match = currentLine.match(/^(\s*)/);
          indentLevel = match ? match[1].length : 0;
          break;
        }
      }
      
      const indentString = options.insertSpaces ? 
        ' '.repeat(indentLevel) : '\t'.repeat(Math.floor(indentLevel / options.tabSize));
      
      edits.push({
        range: {
          startLineNumber: lineNumber,
          startColumn: 1,
          endLineNumber: lineNumber,
          endColumn: line.length + 1
        },
        text: indentString + '}'
      });
    }
  }
  
  // 在输入 '{' 后的下一行自动缩进
  if (ch === '\n') {
    const lineNumber = position.lineNumber - 1;
    const prevLine = model.getLineContent(lineNumber);
    
    if (prevLine.trim().endsWith('{')) {
      const prevIndent = prevLine.match(/^(\s*)/);
      const currentIndent = prevIndent ? prevIndent[1].length : 0;
      const newIndent = currentIndent + (options.insertSpaces ? options.tabSize : 1);
      const indentString = options.insertSpaces ? 
        ' '.repeat(newIndent) : '\t'.repeat(Math.floor(newIndent / options.tabSize));
      
      edits.push({
        range: {
          startLineNumber: position.lineNumber,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: 1
        },
        text: indentString
      });
    }
  }
  
  return edits;
}

// 核心格式化逻辑
function applyFormatting(code, options) {
  const lines = code.split('\n');
  const formatted = [];
  let indentLevel = 0;
  const indentString = options.insertSpaces ? 
    ' '.repeat(options.tabSize) : '\t';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // 跳过空行
    if (line === '') {
      formatted.push('');
      continue;
    }

    // 处理注释行
    if (line.startsWith('//') || line.startsWith('/*')) {
      formatted.push(indentString.repeat(indentLevel) + line);
      continue;
    }

    // 处理减少缩进的行（右大括号）
    if (line.startsWith('}')) {
      indentLevel = Math.max(0, indentLevel - 1);
    }

    // 格式化当前行
    const formattedLine = formatLine(line, indentLevel, indentString, options);
    formatted.push(formattedLine);

    // 处理增加缩进的行（左大括号）
    if (line.endsWith('{')) {
      indentLevel++;
    }
  }

  return formatted.join('\n');
}

// 格式化单行代码
function formatLine(line, indentLevel, indentString, options) {
  // 基础缩进
  let formatted = indentString.repeat(indentLevel) + line;

  // 在操作符周围添加空格
  formatted = formatted.replace(/\s*=\s*/g, ' = ');
  formatted = formatted.replace(/\s*(==|!=|<=|>=)\s*/g, ' $1 ');
  formatted = formatted.replace(/\s*([<>])\s*/g, ' $1 ');
  formatted = formatted.replace(/\s*(&&|\|\|)\s*/g, ' $1 ');
  formatted = formatted.replace(/\s*([+\-*/%])\s*/g, ' $1 ');
  
  // 修复负号问题
  formatted = formatted.replace(/\(\s*-\s*/g, '(-');
  formatted = formatted.replace(/=\s*-\s*/g, '= -');
  
  // 在逗号后添加空格
  formatted = formatted.replace(/,\s*/g, ', ');
  
  // 在关键字后添加空格
  const keywords = ['if', 'while', 'for', 'return', 'const', 'int', 'float', 'void'];
  for (const keyword of keywords) {
    const regex = new RegExp(`\\b${keyword}\\s*`, 'g');
    formatted = formatted.replace(regex, `${keyword} `);
  }
  
  // 清理多余的空格
  formatted = formatted.replace(/\s+/g, ' ').replace(/\s+$/, '');
  
  return formatted;
}

export const executeExtended = async (htmlElement) => {
  const userConfig = setupConfigExtended();
  const wrapper = new MonacoEditorLanguageClientWrapper();
  await wrapper.initAndStart(userConfig, htmlElement);

  // 当Monaco实例和编辑器都准备好后，注册Quick Fix提供程序和格式化提供程序
  const monaco = wrapper.getMonaco();
  const editor = wrapper.getEditor();
  if (monaco && editor) {
    registerQuickFixProvider(monaco, wrapper);
    registerFormattingProvider(monaco);

    // 确保编辑器有行号和装订线边距
    editor.updateOptions({
      lineNumbers: "on",
      glyphMargin: true, // 用于断点
      folding: true,
      renderLineHighlight: "all",
      scrollBeyondLastLine: false,
      automaticLayout: true,
      minimap: {
        enabled: true,
      },
    });

    // 添加示例程序加载器
    const exampleLoader = new ExampleLoader(editor);
    exampleLoader.init(htmlElement.parentElement);

    // 添加调试样式
    addDebugStyles();

    // 初始化调试UI
    const debugUI = new DebugUI(editor, monaco);
    const debugContainer = document.createElement("div");
    debugContainer.className = "debug-container-wrapper";
    htmlElement.parentElement.appendChild(debugContainer);
    debugUI.init(debugContainer);

    // 注册Monaco编辑器的断点事件处理
    editor.onMouseDown((e) => {
      if (e.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
        const lineNumber = e.target.position.lineNumber;
        debuggerService.toggleBreakpoint(lineNumber);
      }
    });

    // 添加键盘快捷键
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF9, () => {
      // F9: 编译
      if (debugUI) debugUI.compile();
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF5, () => {
      // F5: 开始调试
      if (debugUI) debugUI.startDebug();
    });
  }

  // 添加提示信息
  const infoDiv = document.createElement("div");
  infoDiv.style.color = "#ccc";
  infoDiv.style.fontSize = "12px";
  infoDiv.style.padding = "5px";
  infoDiv.style.marginTop = "5px";
  infoDiv.innerHTML =
    "✨ <strong>SysY编辑器功能说明：</strong><br><br>" +
    "🔍 <strong>智能检测：</strong>当您输入类似 <code>int arr[2] = {1, 2, 3};</code> 的代码时，系统会自动检测数组溢出并提供修复选项。<br>" +
    "💡 <strong>快速修复：</strong>将鼠标悬停在错误处，点击灯泡图标查看修复选项。<br>" +
    "🎨 <strong>代码格式化：</strong><br>" +
    "- 自动保存时格式化<br>" +
    "- 右键菜单选择 'Format Document' 格式化整个文档<br>" +
    "- 选中代码后右键选择 'Format Selection' 格式化选中部分<br>" +
    "- 输入时自动调整缩进和空格<br><br>" +
    "⌨️ <strong>快捷键：</strong><br>" +
    "- Ctrl+D：手动触发诊断<br>" +
    "- Alt+Shift+F：格式化文档<br>" +
    "- Ctrl+F9：编译代码<br>" +
    "- Ctrl+F5：开始调试<br>" +
    "- F8：调试时继续执行<br>" +
    "- F10：调试时单步执行";

  htmlElement.parentElement.appendChild(infoDiv);

  return wrapper;
};
