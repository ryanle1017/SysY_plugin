import { LangiumDocument } from "langium";
import {
    FormattingOptions,
    Range,
    TextEdit,
} from "vscode-languageserver";
import { HelloWorldServices } from "./hello-world-module.js";

/**
 * SysY语言格式化服务
 * 基于Langium框架提供代码自动格式化功能
 */
export class SysyFormattingService {
    
    constructor(private readonly services: HelloWorldServices) {}

    /**
     * 格式化整个文档
     */
    async formatDocument(
        document: LangiumDocument,
        options: FormattingOptions
    ): Promise<TextEdit[]> {
        const text = document.textDocument.getText();
        const formatted = this.formatCode(text, options);
        
        if (formatted === text) {
            return [];
        }

        return [{
            range: {
                start: { line: 0, character: 0 },
                end: {
                    line: document.textDocument.lineCount - 1,
                    character: document.textDocument.getText().split('\n').pop()?.length || 0
                }
            },
            newText: formatted
        }];
    }

    /**
     * 格式化指定范围的代码
     */
    async formatRange(
        document: LangiumDocument,
        range: Range,
        options: FormattingOptions
    ): Promise<TextEdit[]> {
        const text = document.textDocument.getText(range);
        const formatted = this.formatCode(text, options);
        
        if (formatted === text) {
            return [];
        }

        return [{
            range: range,
            newText: formatted
        }];
    }

    /**
     * 核心格式化逻辑
     */
    private formatCode(code: string, options: FormattingOptions): string {
        const lines = code.split('\n');
        const formatted: string[] = [];
        let indentLevel = 0;
        const indentString = options.insertSpaces ? 
            ' '.repeat(options.tabSize) : '\t';

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // 跳过空行，但保留其在代码中的位置
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
            const formattedLine = this.formatLine(line, indentLevel, indentString, options);
            formatted.push(formattedLine);

            // 处理增加缩进的行（左大括号）
            if (line.endsWith('{')) {
                indentLevel++;
            }
        }

        return formatted.join('\n');
    }

    /**
     * 格式化单行代码
     */
    private formatLine(line: string, indentLevel: number, indentString: string, options: FormattingOptions): string {
        // 基础缩进
        let formatted = indentString.repeat(indentLevel) + line;

        // 在操作符周围添加空格
        formatted = this.addSpacesAroundOperators(formatted);

        // 在逗号后添加空格
        formatted = this.addSpacesAfterCommas(formatted);

        // 在关键字后添加空格
        formatted = this.addSpacesAfterKeywords(formatted);

        // 清理多余的空格
        formatted = this.cleanExtraSpaces(formatted);

        return formatted;
    }

    /**
     * 在操作符周围添加空格
     */
    private addSpacesAroundOperators(line: string): string {
        // 赋值操作符
        line = line.replace(/\s*=\s*/g, ' = ');
        
        // 比较操作符
        line = line.replace(/\s*(==|!=|<=|>=)\s*/g, ' $1 ');
        line = line.replace(/\s*([<>])\s*/g, ' $1 ');
        
        // 逻辑操作符
        line = line.replace(/\s*(&&|\|\|)\s*/g, ' $1 ');
        
        // 算术操作符（注意不要影响负号）
        line = line.replace(/\s*([+\-*/%])\s*/g, ' $1 ');
        
        // 修复可能的负号问题
        line = line.replace(/\(\s*-\s*/g, '(-');
        line = line.replace(/=\s*-\s*/g, '= -');
        
        return line;
    }

    /**
     * 在逗号后添加空格
     */
    private addSpacesAfterCommas(line: string): string {
        return line.replace(/,\s*/g, ', ');
    }

    /**
     * 在关键字后添加空格
     */
    private addSpacesAfterKeywords(line: string): string {
        const keywords = ['if', 'while', 'for', 'return', 'const', 'int', 'float', 'void'];
        
        for (const keyword of keywords) {
            const regex = new RegExp(`\\b${keyword}\\s*`, 'g');
            line = line.replace(regex, `${keyword} `);
        }
        
        return line;
    }

    /**
     * 清理多余的空格
     */
    private cleanExtraSpaces(line: string): string {
        // 移除多余的空格，但保留字符串内的空格
        let inString = false;
        let stringChar = '';
        const result: string[] = [];
        let lastWasSpace = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (!inString && (char === '"' || char === "'")) {
                inString = true;
                stringChar = char;
                result.push(char);
                lastWasSpace = false;
            } else if (inString && char === stringChar) {
                inString = false;
                result.push(char);
                lastWasSpace = false;
            } else if (inString) {
                result.push(char);
                lastWasSpace = false;
            } else if (char === ' ') {
                if (!lastWasSpace) {
                    result.push(char);
                    lastWasSpace = true;
                }
            } else {
                result.push(char);
                lastWasSpace = false;
            }
        }

        return result.join('').replace(/\s+$/, ''); // 移除行尾空格
    }
} 