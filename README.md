# 🎯 SysY编辑器 - SysY2022语言IDE

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-4.9+-blue.svg)](https://www.typescriptlang.org/)
[![Langium](https://img.shields.io/badge/Langium-3.0+-green.svg)](https://langium.org/)
[![Monaco Editor](https://img.shields.io/badge/Monaco%20Editor-Latest-orange.svg)](https://microsoft.github.io/monaco-editor/)

> 🚀 基于Langium框架构建的现代化SysY2022语言集成开发环境，提供专业级的代码编辑、语法检查和智能提示功能。

## ✨ 核心特性

### 🎨 **智能代码编辑**
- **🌈 语法高亮** - 完整的SysY语法高亮支持，包括关键字、类型、操作符、注释等
- **⚡ 自动格式化** - 保存时自动格式化、智能缩进、操作符空格调整
- **🔧 智能补全** - 变量、函数、类型的上下文相关补全
- **📐 代码折叠** - 支持函数、语句块的折叠和展开

### 🔍 **静态分析**
- **❌ 错误检测** - 实时语法错误和语义错误检测
- **🔎 类型检查** - 函数参数、返回值类型验证
- **🚫 重复定义检查** - 变量和函数的重复定义检测
- **📊 数组越界检测** - 智能检测数组初始化越界问题

### 🛠️ **智能修复**
- **💡 快速修复** - 一键修复常见代码问题
- **📝 悬浮提示** - 鼠标悬停显示变量类型和函数签名
- **🎯 诊断建议** - 详细的错误说明和修复建议
- **❌ 重构功能** - 暂未实现（变量重命名、代码提取等）

### 🌐 **多平台支持**
- **💻 VSCode插件** - 完整的VSCode扩展支持
- **🌍 Web编辑器** - 基于Monaco Editor的在线编辑器
- **⚙️ 命令行工具** - CLI代码生成和批处理工具

## 📸 界面预览

```sys
// SysY代码示例 - 支持完整语法高亮和智能提示
int factorial(int n) {
    if (n <= 1) {
        return 1;
    }
    return n * factorial(n - 1);
}

int main() {
    int result = factorial(5);  // 悬浮显示函数签名
    int arr[3] = {1, 2, 3, 4};  // 自动检测数组越界
    return result;
}
```

## 🚀 快速开始

### 📦 安装依赖
```bash
npm install
```

### 🔧 开发模式
```bash
# 启动开发服务器
npm run dev

# 监听文件变化
npm run watch

# 生成语法服务
npm run langium:generate
```

### 🌐 Web端使用
```bash
# 构建Web版本
npm run build:web

# 启动Web服务器
npm run serve
```

访问 `http://localhost:5173` 体验在线编辑器。

### 💻 VSCode插件安装
```bash
# 打包插件
npm run build

# 安装插件（已生成 sysy-language-support-1.0.0.vsix）
code --install-extension sysy-language-support-1.0.0.vsix
```

### 🧪 运行测试
```bash
npm test
```

## 📖 使用指南

### 🎮 快捷键
- `Alt+Shift+F` - 格式化文档
- `Ctrl+D` - 手动触发诊断
- `Ctrl+F9` - 编译代码
- `Ctrl+F5` - 开始调试
- `F8` - 调试时继续执行
- `F10` - 调试时单步执行

### 💡 智能功能
1. **自动修复** - 点击错误提示的灯泡图标查看修复选项
2. **悬浮提示** - 将鼠标悬停在变量或函数上查看详细信息
3. **格式化** - 右键选择"Format Document"或"Format Selection"
4. **代码补全** - 输入时自动显示补全建议

### 📝 支持的语法特性
- ✅ 基本数据类型：`int`, `float`, `void`
- ✅ 变量声明和初始化
- ✅ 数组声明和初始化
- ✅ 函数定义和调用
- ✅ 控制流：`if-else`, `while`, `break`, `continue`, `return`
- ✅ 表达式和运算符
- ✅ 常量定义：`const`

## 🏗️ 项目架构

```
SysY/
├── 📁 src/
│   ├── 📁 language/           # 语言服务核心
│   │   ├── 📄 hello-world.langium      # SysY语法定义(.sys文件支持)
│   │   ├── 📄 formatting-provider.ts   # 格式化服务
│   │   ├── 📄 decl-validator.ts        # 声明验证器
│   │   ├── 📄 funcl-validator.ts       # 函数验证器
│   │   ├── 📄 quickfix-provider.ts     # 快速修复
│   │   ├── 📄 hover-provider.ts        # 悬浮提示
│   │   └── 📁 generated/               # 自动生成代码
│   ├── 📁 extension/          # VSCode扩展
│   └── 📁 cli/               # 命令行工具
├── 📁 static/                # Web端资源
│   ├── 📄 setupExtended.js   # Monaco编辑器配置
│   ├── 📄 debug-ui.js        # 调试界面
│   └── 📁 examples/          # 示例代码
├── 📁 syntaxes/              # 语法高亮配置
├── 📁 test/                  # 测试用例
└── 📄 package.json           # 项目配置
```

## 🔧 技术栈

- **🎯 核心框架**: [Langium](https://langium.org/) - 现代化语言工程框架
- **⚙️ 开发语言**: TypeScript - 类型安全的JavaScript超集
- **🌐 Web编辑器**: [Monaco Editor](https://microsoft.github.io/monaco-editor/) - VSCode同款编辑器内核
- **🧪 测试框架**: [Vitest](https://vitest.dev/) - 快速的单元测试框架
- **📦 构建工具**: Vite + ESBuild - 高性能构建流水线
- **🎨 语法高亮**: TextMate Grammar - 业界标准的语法高亮规则

## 🎯 功能路线图

### ✅ 已完成 (v0.1.0)
- 完整的SysY2022语言支持
- 语法高亮和代码格式化
- 静态语义检查和错误检测
- VSCode插件和Web端编辑器
- 基础调试功能

### 🔄 进行中 (v0.2.0)
- AST可视化工具
- 高级调试功能
- 性能分析工具

### 🎪 计划中 (v0.3.0+)
- 多文件项目支持
- 构建系统集成
- 插件生态系统

## 🤝 贡献指南

我们欢迎任何形式的贡献！

### 🐛 报告问题
- 使用 [Issues](https://github.com/ryanle1017/SysY_plugin/issues) 报告 bug 或提出功能请求
- 提供详细的重现步骤和环境信息

### 💻 参与开发
1. Fork 本仓库
2. 创建特性分支：`git checkout -b feature/amazing-feature`
3. 提交更改：`git commit -m 'Add amazing feature'`
4. 推送分支：`git push origin feature/amazing-feature`
5. 提交 Pull Request

### 📝 开发规范
- 遵循 TypeScript 代码规范
- 添加适当的单元测试
- 更新相关文档

## 📊 项目统计

- **📝 代码行数**: 13,000+
- **🧪 测试覆盖**: 核心功能
- **📦 功能模块**: 25+
- **🎯 完成度**: ~85%

## 👥 开发团队

- **项目负责人**: 乐一然，谭志勇，魏竹松
- **技术栈**: TypeScript + Langium + Monaco Editor
- **开发周期**: 2025春季学期

## 📄 许可证

本项目基于 [MIT License](https://github.com/ustb-software/sysy-editor/blob/main/LICENSE) 开源协议。

## 🙏 致谢

- [Langium团队](https://langium.org/) - 提供优秀的语言工程框架
- [Monaco Editor](https://microsoft.github.io/monaco-editor/) - 强大的Web代码编辑器
- [SysY2022规范](https://gitlab.eduxiji.net/nscscc/compiler2022/-/blob/master/SysY2022%E8%AF%AD%E8%A8%80%E5%AE%9A%E4%B9%89.pdf) - 语言标准参考

---

<div align="center">

**🎉 感谢使用SysY编辑器！**

[📚 查看文档](./功能清单.md) · [🐛 报告问题](https://github.com/ustb-software/sysy-editor/issues) · [💡 功能建议](https://github.com/ustb-software/sysy-editor/issues/new)

Made with ❤️ by USTB 乐一然、谭志勇、魏竹松

</div>
