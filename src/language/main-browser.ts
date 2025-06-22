import { EmptyFileSystem } from "langium";
import { startLanguageServer } from "langium/lsp";
import {
  BrowserMessageReader,
  BrowserMessageWriter,
  CodeActionParams,
  createConnection,
  DiagnosticSeverity,
  ProposedFeatures,
  PublishDiagnosticsParams,
} from "vscode-languageserver/browser.js";
import { URI } from "vscode-uri";
import { createHelloWorldServices } from "./hello-world-module.js";

declare const self: DedicatedWorkerGlobalScope;

const messageReader = new BrowserMessageReader(self);
const messageWriter = new BrowserMessageWriter(self);

const connection = createConnection(messageReader, messageWriter);

const { shared, HelloWorld } = createHelloWorldServices({
  connection,
  ...EmptyFileSystem,
});

// 注册自定义服务 (如悬浮提示提供者)
connection.onHover(async (params, token) => {
  const document = await shared.workspace.LangiumDocuments.getOrCreateDocument(
    URI.parse(params.textDocument.uri)
  );
  return HelloWorld.lsp.HoverProvider.getHoverContent(document, params, token);
});

// 增强诊断信息
const originalSendDiagnostics = connection.sendDiagnostics;
connection.sendDiagnostics = (
  params: PublishDiagnosticsParams
): Promise<void> => {
  // 增强诊断消息的精确位置
  if (params.diagnostics && params.diagnostics.length > 0) {
    // 使用我们的错误消息提供者来增强诊断消息
    params.diagnostics.forEach((diagnostic) => {
      // 确保诊断有一个代码，这样在UI中会更突出
      if (!diagnostic.code) {
        diagnostic.code = "SYSY-ERROR";
      }

      // 确保严重性级别正确设置
      if (!diagnostic.severity) {
        diagnostic.severity = DiagnosticSeverity.Error;
      }
    });
  }

  // 调用原始的发送诊断方法
  return originalSendDiagnostics(params);
};

// 注册代码操作
connection.onCodeAction(async (params: CodeActionParams) => {
  const document = await shared.workspace.LangiumDocuments.getOrCreateDocument(
    URI.parse(params.textDocument.uri)
  );
  return HelloWorld.lsp.QuickFixProvider.getCodeActions(params);
});

// 注册自定义命令处理器
connection.onRequest("sysy.fixArraySize", async (params) => {
  const { uri, arrayName, range } = params;
  const document = await shared.workspace.LangiumDocuments.getOrCreateDocument(
    URI.parse(uri)
  );

  try {
    // 获取当前行内容
    const text = document.textDocument.getText();
    const lines = text.split("\n");
    const line = lines[range.start.line];

    // 尝试找出数组的当前大小和需要的大小
    const sizeMatch = line.match(new RegExp(`${arrayName}\\s*\\[(\\d+)\\]`));
    if (!sizeMatch || !sizeMatch[1]) return null;

    const currentSize = parseInt(sizeMatch[1], 10);

    // 查找初始化列表中的元素数量
    const initListMatch = line.match(/=\s*{([^}]*)}/);
    if (!initListMatch || !initListMatch[1]) return null;

    const initElements = initListMatch[1].split(",").length;
    const newSize = Math.max(currentSize, initElements);

    // 创建文本编辑，修改数组大小
    const newText = line.replace(
      new RegExp(`${arrayName}\\s*\\[${currentSize}\\]`),
      `${arrayName}[${newSize}]`
    );

    // 应用编辑
    return {
      changes: {
        [uri]: [
          {
            range: {
              start: { line: range.start.line, character: 0 },
              end: { line: range.start.line + 1, character: 0 },
            },
            newText: newText + "\n",
          },
        ],
      },
    };
  } catch (error) {
    console.error("修复数组大小时出错:", error);
    return null;
  }
});

connection.onRequest("sysy.adjustParameters", async (params) => {
  const { uri, range, expectedCount } = params;
  const document = await shared.workspace.LangiumDocuments.getOrCreateDocument(
    URI.parse(uri)
  );

  try {
    const text = document.textDocument.getText();
    const lines = text.split("\n");

    // 获取包含函数调用的行
    const line = lines[range.start.line];

    // 查找函数调用和参数
    const funcCallRegex = /(\w+)\s*\((.*)\)/;
    const match = line.match(funcCallRegex);

    if (match) {
      const funcName = match[1];
      const paramsText = match[2];
      const params = paramsText.split(",").map((p) => p.trim());
      const actualCount = params.length;

      let newParams: string[];

      if (actualCount > expectedCount) {
        // 删除多余的参数
        newParams = params.slice(0, expectedCount);
      } else {
        // 添加缺少的参数
        newParams = [...params];
        for (let i = actualCount; i < expectedCount; i++) {
          newParams.push(`0 /* 参数${i + 1} */`);
        }
      }

      // 构建新的函数调用
      const startIdx = line.indexOf(match[0]);
      const newCall = `${funcName}(${newParams.join(", ")})`;

      // 应用编辑
      return {
        changes: {
          [uri]: [
            {
              range: {
                start: { line: range.start.line, character: startIdx },
                end: {
                  line: range.start.line,
                  character: startIdx + match[0].length,
                },
              },
              newText: newCall,
            },
          ],
        },
      };
    }

    return null;
  } catch (error) {
    console.error("调整参数时出错:", error);
    return null;
  }
});

connection.onRequest("sysy.addReturnStatement", async (params) => {
  const { uri, range, returnType } = params;
  const document = await shared.workspace.LangiumDocuments.getOrCreateDocument(
    URI.parse(uri)
  );

  try {
    // 查找函数体的结束位置
    const text = document.textDocument.getText();
    const functionBody = text.substring(
      text.indexOf("{", document.textDocument.offsetAt(range.start))
    );

    // 计算括号的平衡，找到函数结束的位置
    let braceCount = 1;
    let endOffset = 0;

    for (let i = 1; i < functionBody.length; i++) {
      if (functionBody[i] === "{") braceCount++;
      else if (functionBody[i] === "}") braceCount--;

      if (braceCount === 0) {
        endOffset = i;
        break;
      }
    }

    if (endOffset === 0) return null;

    // 找到函数体结束前的位置
    const insertPosition =
      document.textDocument.offsetAt(range.start) +
      functionBody.lastIndexOf("\n", endOffset);
    const position = document.textDocument.positionAt(insertPosition);

    // 确定适当的缩进
    const line = document.textDocument.getText({
      start: { line: position.line, character: 0 },
      end: { line: position.line + 1, character: 0 },
    });
    const indent = line.match(/^\s*/)?.[0] || "    ";

    // 根据返回类型生成默认返回值
    let defaultReturnValue = "0";
    if (returnType === "float" || returnType === "double") {
      defaultReturnValue = "0.0";
    }

    // 应用编辑
    return {
      changes: {
        [uri]: [
          {
            range: {
              start: { line: position.line, character: indent.length },
              end: { line: position.line, character: indent.length },
            },
            newText: `return ${defaultReturnValue};\n${indent}`,
          },
        ],
      },
    };
  } catch (error) {
    console.error("添加return语句时出错:", error);
    return null;
  }
});

startLanguageServer(shared);
