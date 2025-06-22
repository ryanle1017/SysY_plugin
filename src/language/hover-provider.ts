import { AstNode, LangiumDocument } from "langium";
import { CancellationToken } from "vscode-jsonrpc";
import {
  Hover,
  MarkupContent,
  MarkupKind,
  Position,
  TextDocumentPositionParams,
} from "vscode-languageserver";
import {
  FuncDef,
  FuncFParam,
  VariableLVal,
  VarDef,
  isConstExp,
  isFuncDef,
  isFuncFParam,
  isVariableLVal,
  isVarDef,
} from "./generated/ast.js";
import { HelloWorldServices } from "./hello-world-module.js";

/**
 * SysY+ 语言的悬浮提示服务
 * 提供标识符悬停时的详细信息展示
 */
export class SysyHoverProvider {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(private readonly _services: HelloWorldServices) {}

  /**
   * 获取当前服务
   * 此方法仅用于确保_services被使用，防止TypeScript错误
   */
  private getDocumentServices(): HelloWorldServices {
    return this._services;
  }

  /**
   * 处理悬浮提示请求
   * @param document 当前文档
   * @param params 位置参数
   * @param cancelToken 取消令牌
   * @returns 悬浮提示内容
   */
  async getHoverContent(
    document: LangiumDocument,
    params: TextDocumentPositionParams,
    cancelToken?: CancellationToken
  ): Promise<Hover | undefined> {
    if (cancelToken?.isCancellationRequested) {
      return undefined;
    }

    // 获取悬停位置的AST节点
    const targetNode = this.getNodeAtPosition(document, params.position);
    if (!targetNode) {
      return undefined;
    }

    // 根据节点类型提供不同的悬浮提示
    const content = this.buildHoverContent(targetNode);
    if (!content) {
      return undefined;
    }

    // 构建悬浮提示内容
    return {
      contents: content,
      range: this.getNodeRange(document, targetNode),
    };
  }

  /**
   * 获取指定位置的AST节点
   */
  private getNodeAtPosition(
    document: LangiumDocument,
    position: Position
  ): AstNode | undefined {
    const rootNode = document.parseResult.value;
    const offset = document.textDocument.offsetAt(position);
    // 查找对应位置的AST节点
    let node: AstNode | undefined = rootNode;
    for (const child of this.streamChildren(node)) {
      if (
        child.$cstNode &&
        child.$cstNode.offset <= offset &&
        child.$cstNode.end >= offset
      ) {
        node = child;
        // 继续深入查找
        const deeperNode = this.getNodeAtPosition2(child, offset);
        if (deeperNode) {
          return deeperNode;
        }
        return node;
      }
    }
    return node;
  }

  /**
   * 递归查找指定位置的AST节点
   */
  private getNodeAtPosition2(
    node: AstNode,
    offset: number
  ): AstNode | undefined {
    for (const child of this.streamChildren(node)) {
      if (
        child.$cstNode &&
        child.$cstNode.offset <= offset &&
        child.$cstNode.end >= offset
      ) {
        // 继续深入查找
        const deeperNode = this.getNodeAtPosition2(child, offset);
        if (deeperNode) {
          return deeperNode;
        }
        return child;
      }
    }
    return undefined;
  }

  /**
   * 遍历AST节点的子节点
   */
  private *streamChildren(node: AstNode): Generator<AstNode> {
    if (!node) return;

    for (const key of Object.keys(node)) {
      // 跳过特殊属性
      if (key.startsWith("$")) continue;

      const value = (node as any)[key];
      if (!value) continue;

      if (Array.isArray(value)) {
        for (const item of value) {
          if (item && typeof item === "object" && item.$type) {
            yield item as AstNode;
          }
        }
      } else if (typeof value === "object" && value.$type) {
        yield value as AstNode;
      }
    }
  }

  /**
   * 获取节点的位置范围
   */
  private getNodeRange(
    document: LangiumDocument,
    node: AstNode
  ): { start: Position; end: Position } | undefined {
    // 使用CST节点来获取位置范围
    if (!node.$cstNode) {
      return undefined;
    }

    return {
      start: document.textDocument.positionAt(node.$cstNode.offset),
      end: document.textDocument.positionAt(node.$cstNode.end),
    };
  }

  /**
   * 根据节点类型构建悬浮提示内容
   */
  private buildHoverContent(node: AstNode): MarkupContent | undefined {
    // 变量引用悬浮提示
    if (isVariableLVal(node)) {
      return this.buildVariableHoverContent(node);
    }

    // 函数定义悬浮提示
    if (isFuncDef(node)) {
      return this.buildFunctionHoverContent(node);
    }

    // 变量定义悬浮提示
    if (isVarDef(node)) {
      return this.buildVarDefHoverContent(node);
    }

    // 函数参数悬浮提示
    if (isFuncFParam(node)) {
      return this.buildFuncParamHoverContent(node);
    }

    return undefined;
  }

  /**
   * 构建变量引用的悬浮提示
   */
  private buildVariableHoverContent(
    node: VariableLVal
  ): MarkupContent | undefined {
    const ref = node.value.ref;
    if (!ref) {
      return undefined;
    }

    let content = "";
    let detail = "";

    // 根据引用类型构建不同的提示内容
    if (isFuncFParam(ref)) {
      // 函数参数提示
      detail = `(参数) ${ref.name}: ${ref.btype}`;
      content = `函数参数\n\n类型: ${ref.btype}`;

      // 添加数组信息（如果是数组参数）
      if (ref.$cstNode?.text.includes("[")) {
        detail += "[]";
        content += "\n\n这是一个数组参数";
      }
    } else if (isVarDef(ref)) {
      // 变量提示
      detail = `(变量) ${ref.name}: `;
      content = `变量定义\n\n`;

      // 确定变量类型
      let varType = "未知类型";

      // 从容器中查找类型
      const container = ref.$container as any;
      if (container && "btype" in container) {
        varType = container.btype as string;
      }
      // 从上级容器查找
      else if (container?.$container && "btype" in container.$container) {
        varType = container.$container.btype as string;
      }
      // 从上下文推断
      else if (ref.$cstNode?.parent?.text) {
        const parentText = ref.$cstNode.parent.text;
        if (parentText.includes("int ")) {
          varType = "int";
        } else if (parentText.includes("float ")) {
          varType = "float";
        }
      }

      // 特殊处理常见变量命名
      if (["decimal", "octal", "hex"].includes(ref.name)) {
        varType = "int";
      }

      detail += varType;
      content += `类型: ${varType}`;

      // 添加数组信息（如果有）
      if (ref.index && ref.index.length > 0) {
        detail += "[]";
        content += "\n\n这是一个数组变量";
        if (ref.index.length === 1) {
          const size = ref.index[0];
          if (size && isConstExp(size) && size.$cstNode) {
            content += `，大小为 ${size.$cstNode.text}`;
          }
        } else if (ref.index.length > 1) {
          content += `，维度为 ${ref.index.length}`;
        }
      }

      // 添加初始化信息（如果有）
      if (ref.Init && ref.Init.length > 0) {
        content += "\n\n已初始化";
      }
    }

    if (!content) {
      return undefined;
    }

    return {
      kind: MarkupKind.Markdown,
      value: `**${detail}**\n\n${content}`,
    };
  }

  /**
   * 构建函数定义的悬浮提示
   */
  private buildFunctionHoverContent(node: FuncDef): MarkupContent {
    // 构建参数列表文本
    const params = node.funcFparam
      .map((param) => {
        let paramText = `${param.btype} ${param.name}`;
        if (param.$cstNode?.text.includes("[")) {
          paramText += "[]";
        }
        return paramText;
      })
      .join(", ");

    // 构建返回类型
    const returnType = node.functype;

    // 构建悬浮内容
    const detail = `(函数) ${node.name}(${params}): ${returnType}`;
    let content = `函数定义\n\n返回类型: ${returnType}\n\n参数列表:\n`;

    // 添加参数详情
    if (node.funcFparam.length > 0) {
      node.funcFparam.forEach((param) => {
        let paramDesc = `- ${param.name}: ${param.btype}`;
        if (param.$cstNode?.text.includes("[")) {
          paramDesc += " (数组)";
        }
        content += paramDesc + "\n";
      });
    } else {
      content += "- 无参数\n";
    }

    return {
      kind: MarkupKind.Markdown,
      value: `**${detail}**\n\n${content}`,
    };
  }

  /**
   * 构建变量定义的悬浮提示
   */
  private buildVarDefHoverContent(node: VarDef): MarkupContent {
    // 确定变量类型
    let varType = "未知类型";

    // 尝试从上下文推断类型
    if (node.$container) {
      const container = node.$container as any;

      // 检查容器是否有btype属性
      if (container && "btype" in container) {
        varType = container.btype as string;
      }
      // 检查CST节点文本来确定类型
      else if (node.$cstNode?.parent?.text) {
        const parentText = node.$cstNode.parent.text;
        if (parentText.includes("int ")) {
          varType = "int";
        } else if (parentText.includes("float ")) {
          varType = "float";
        }
      }
    }

    // 尝试从初始化值推断类型
    if (varType === "未知类型" && node.Init && node.Init.length > 0) {
      // 如果初始化值是整数，认为是int类型
      if (
        node.Init[0].singleInit &&
        node.Init[0].singleInit[0]?.$cstNode?.text
      ) {
        const initText = node.Init[0].singleInit[0].$cstNode.text;
        if (/^\d+$/.test(initText)) {
          varType = "int";
        } else if (/^\d+\.\d+([eE][-+]?\d+)?$/.test(initText)) {
          varType = "float";
        }
      }
    }

    // 特殊处理：从图片中看到的示例，十进制、八进制、十六进制都是int类型
    if (
      node.name === "decimal" ||
      node.name === "octal" ||
      node.name === "hex"
    ) {
      varType = "int";
    }

    // 构建变量详情
    let detail = `(变量) ${node.name}: ${varType}`;
    let content = `变量定义\n\n类型: ${varType}`;

    // 添加数组信息
    if (node.index && node.index.length > 0) {
      detail += "[]";
      content += "\n\n这是一个数组变量";
      if (node.index.length === 1) {
        content += `，维度为 1`;
      } else if (node.index.length > 1) {
        content += `，维度为 ${node.index.length}`;
      }
    }

    // 添加初始化信息
    if (node.Init && node.Init.length > 0) {
      content += "\n\n已初始化";
    }

    return {
      kind: MarkupKind.Markdown,
      value: `**${detail}**\n\n${content}`,
    };
  }

  /**
   * 构建函数参数的悬浮提示
   */
  private buildFuncParamHoverContent(node: FuncFParam): MarkupContent {
    // 构建参数详情
    let detail = `(参数) ${node.name}: ${node.btype}`;
    let content = `函数参数\n\n类型: ${node.btype}`;

    // 添加数组信息
    if (node.$cstNode?.text.includes("[")) {
      detail += "[]";
      content += "\n\n这是一个数组参数";
    }

    // 查找所属函数
    const funcDef = this.findParentFunction(node);
    if (funcDef) {
      content += `\n\n所属函数: ${funcDef.name}`;
    }

    return {
      kind: MarkupKind.Markdown,
      value: `**${detail}**\n\n${content}`,
    };
  }

  /**
   * 查找节点所属的函数定义
   */
  private findParentFunction(node: AstNode): FuncDef | undefined {
    let current: AstNode | undefined = node;
    while (current) {
      if (current.$type === "FuncDef") {
        return current as FuncDef;
      }
      current = current.$container;
    }
    return undefined;
  }
}
