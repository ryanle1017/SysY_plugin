// import { HelloWorldServices } from "./hello-world-module.js";

// 错误码类型定义
export enum ErrorCategory {
  VARIABLE = "VAR",
  FUNCTION = "FUNC",
  ARRAY = "ARR",
  TYPE = "TYPE",
  CONTROL = "CTRL",
  OTHER = "OTHER",
}

// 错误码结构
export interface ErrorInfo {
  message: string;
  suggestion: string;
  category: ErrorCategory;
}

/**
 * SysY+ 语言的错误消息提供者
 * 提供更详细的错误信息和修复建议
 */
export class ErrorMessageProvider {
  // 错误信息的扩展描述，提供更详细的错误解释和修复建议
  private static readonly ERROR_DETAILS: Record<string, ErrorInfo> = {
    // 变量相关错误
    无法重新声明块范围变量: {
      message:
        "在同一个作用域中，每个变量名只能声明一次。请使用不同的变量名或在不同的作用域中声明。",
      suggestion: "使用不同的变量名或移除重复声明",
      category: ErrorCategory.VARIABLE,
    },
    使用了未定义的变量: {
      message:
        "尝试使用一个未在当前作用域中声明的变量。请确保在使用前先声明变量。",
      suggestion: "先声明变量再使用",
      category: ErrorCategory.VARIABLE,
    },
    未声明的变量: {
      message: "引用了一个在当前作用域中不存在的变量。变量必须在使用前声明。",
      suggestion: "声明该变量或检查变量名是否拼写错误",
      category: ErrorCategory.VARIABLE,
    },
    数组的初始化元素数量超过了数组大小: {
      message:
        "数组初始化时提供的元素数量不能超过数组声明的大小。请减少初始化元素的数量或增加数组大小。",
      suggestion: "增大数组声明大小或减少初始化元素",
      category: ErrorCategory.ARRAY,
    },

    // 函数相关错误
    调用了未定义的函数: {
      message: "尝试调用一个未声明的函数。请确保在调用前先定义该函数。",
      suggestion: "定义该函数或检查函数名是否拼写错误",
      category: ErrorCategory.FUNCTION,
    },
    函数名已经定义过: {
      message: "在同一个作用域中，每个函数名只能定义一次。请使用不同的函数名。",
      suggestion: "使用不同的函数名或移除重复定义",
      category: ErrorCategory.FUNCTION,
    },
    参数个数不匹配: {
      message:
        "函数调用时提供的参数数量与函数定义时的参数数量不匹配。请检查函数定义并提供正确数量的参数。",
      suggestion: "调整参数数量以匹配函数定义",
      category: ErrorCategory.FUNCTION,
    },
    "非循环块中使用了 Stmtbreak 语句": {
      message: "break语句只能用在循环内部。请移除不在循环体内的break语句。",
      suggestion: "移除break语句或将其放在循环内",
      category: ErrorCategory.CONTROL,
    },
    "非循环块中使用了 Stmtcontinue 语句": {
      message:
        "continue语句只能用在循环内部。请移除不在循环体内的continue语句。",
      suggestion: "移除continue语句或将其放在循环内",
      category: ErrorCategory.CONTROL,
    },
    "有返回值的函数缺少 return 语句": {
      message:
        "有返回值类型的函数必须包含至少一个return语句。请添加带有适当返回值的return语句。",
      suggestion: "添加带有适当返回值的return语句",
      category: ErrorCategory.FUNCTION,
    },
    有返回值的函数不应返回为空: {
      message:
        "有返回值的函数需要在return语句中提供一个值。请在return语句中添加适当的返回值。",
      suggestion: "在return语句中添加返回值",
      category: ErrorCategory.FUNCTION,
    },
    "void 函数不应存在非空返回值": {
      message: "void类型的函数不应该有返回值。请移除return语句中的表达式。",
      suggestion: "移除return语句中的表达式或使用'return;'",
      category: ErrorCategory.FUNCTION,
    },
    不能将void类型变量参与运算或用于赋值: {
      message:
        "void类型的函数返回值不能用于赋值或参与运算。请使用有返回值的函数。",
      suggestion: "修改函数返回类型或不将结果用于赋值",
      category: ErrorCategory.TYPE,
    },

    // 类型相关错误
    类型不匹配: {
      message:
        "表达式的类型与预期的类型不匹配。请确保类型兼容或添加适当的类型转换。",
      suggestion: "修改表达式或添加类型转换",
      category: ErrorCategory.TYPE,
    },

    // 数组相关错误
    "数组.*初始化元素数量超过了数组大小": {
      message:
        "数组初始化时提供的元素数量不能超过数组声明的大小。请减少初始化元素的数量或增加数组大小。",
      suggestion: "增大数组大小或减少初始化元素",
      category: ErrorCategory.ARRAY,
    },
  };

  constructor() {}

  /**
   * 获取增强的错误消息
   * @param message 原始错误消息
   * @returns 增强后的错误消息
   */
  getEnhancedMessage(message: string): string {
    if (!message) {
      return "未知错误";
    }

    // 尝试找到精确匹配
    for (const errorPattern in ErrorMessageProvider.ERROR_DETAILS) {
      if (message.includes(errorPattern)) {
        const errorInfo = ErrorMessageProvider.ERROR_DETAILS[errorPattern];
        return `${message}\n\n详细信息：${errorInfo.message}\n建议：${errorInfo.suggestion}`;
      }
    }

    // 尝试正则表达式匹配
    for (const errorPattern in ErrorMessageProvider.ERROR_DETAILS) {
      if (errorPattern.startsWith('"') && errorPattern.endsWith('"')) {
        // 这是一个正则表达式模式
        const regexPattern = errorPattern.substring(1, errorPattern.length - 1);
        const regex = new RegExp(regexPattern);
        if (regex.test(message)) {
          const errorInfo = ErrorMessageProvider.ERROR_DETAILS[errorPattern];
          return `${message}\n\n详细信息：${errorInfo.message}\n建议：${errorInfo.suggestion}`;
        }
      }
    }

    // 默认信息
    return message;
  }

  /**
   * 获取安全的增强错误消息，即使出错也会返回原始消息而不是抛出异常
   */
  getSafeEnhancedMessage(message: string): string {
    try {
      return this.getEnhancedMessage(message);
    } catch (error) {
      console.error("获取增强消息时出错:", error);
      return message || "未知错误";
    }
  }

  /**
   * 获取错误的类别信息
   * @param message 错误消息
   * @returns 错误类别或未定义
   */
  getErrorCategory(message: string): ErrorCategory | undefined {
    if (!message) {
      return undefined;
    }

    // 尝试找到精确匹配
    for (const errorPattern in ErrorMessageProvider.ERROR_DETAILS) {
      if (message.includes(errorPattern)) {
        return ErrorMessageProvider.ERROR_DETAILS[errorPattern].category;
      }
    }

    // 尝试正则表达式匹配
    for (const errorPattern in ErrorMessageProvider.ERROR_DETAILS) {
      if (errorPattern.startsWith('"') && errorPattern.endsWith('"')) {
        const regexPattern = errorPattern.substring(1, errorPattern.length - 1);
        const regex = new RegExp(regexPattern);
        if (regex.test(message)) {
          return ErrorMessageProvider.ERROR_DETAILS[errorPattern].category;
        }
      }
    }

    return ErrorCategory.OTHER;
  }
}
