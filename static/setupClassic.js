import {
  addMonacoStyles,
  defineUserServices,
  MonacoEditorLanguageClientWrapper,
} from "./bundle/index.js";
import monarchSyntax from "../syntaxes/hello-world.monarch.js";
import { configureWorker } from "./setup.js";
import { compilerService, debuggerService } from "./compiler-service.js";
import { DebugUI, addDebugStyles } from "./debug-ui.js";
import { ExampleLoader } from "./example-loader.js";

addMonacoStyles("monaco-editor-styles");

export const setupConfigClassic = () => {
  return {
    wrapperConfig: {
      serviceConfig: defineUserServices(),
      editorAppConfig: {
        $type: "classic",
        languageId: "hello-world",
        code: `// 在这里编写SysY语言代码
// 例如尝试创建一个数组大小溢出的情况: int numbers[5] = {1, 2, 3, 4, 5, 6};

int main() {
    // 您的代码
    return 0;
}`,
        useDiffEditor: false,
        languageExtensionConfig: { id: "langium" },
        languageDef: monarchSyntax,
        editorOptions: {
          "semanticHighlighting.enabled": true,
          theme: "vs-dark",
          "bracketPairColorization.enabled": true,
          "guides.bracketPairs": true,
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

export const executeClassic = async (htmlElement) => {
  const userConfig = setupConfigClassic();
  const wrapper = new MonacoEditorLanguageClientWrapper();
  await wrapper.initAndStart(userConfig, htmlElement);

  // 当Monaco实例和编辑器都准备好后，注册Quick Fix提供程序
  const monaco = wrapper.getMonaco();
  const editor = wrapper.getEditor();
  if (monaco && editor) {
    registerQuickFixProvider(monaco, wrapper);

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
    "提示：当您输入类似 <code>int arr[2] = {1, 2, 3};</code> 的代码时，系统会检测数组溢出并提供修复选项。<br>" +
    "您可以将鼠标悬停在错误处，然后点击灯泡图标查看修复选项。<br>" +
    "按下Ctrl+D可以手动触发诊断。<br><br>" +
    "编译/调试快捷键：<br>" +
    "- Ctrl+F9：编译代码<br>" +
    "- Ctrl+F5：开始调试<br>" +
    "- F8：调试时继续执行<br>" +
    "- F10：调试时单步执行";

  htmlElement.parentElement.appendChild(infoDiv);

  return wrapper;
};
