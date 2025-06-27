// 自动修复数组大小溢出问题的简单工具
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 如果在命令行中提供了文件路径，则使用它，否则使用当前工作目录下的所有.sys文件
const filePath = process.argv[2];
let filesToProcess = [];

if (filePath) {
  filesToProcess.push(filePath);
} else {
  const files = fs.readdirSync(process.cwd());
      filesToProcess = files.filter((file) => file.endsWith(".sys"));
}

// 处理每个文件
filesToProcess.forEach((file) => {
  try {
    const fullPath = path.resolve(process.cwd(), file);
    console.log(`处理文件: ${fullPath}`);

    // 读取文件内容
    const content = fs.readFileSync(fullPath, "utf8");
    const lines = content.split("\n");

    let modified = false;
    const newLines = lines.map((line) => {
      // 检测数组声明和初始化的行
      if (
        line.includes("[") &&
        line.includes("]") &&
        line.includes("=") &&
        line.includes("{") &&
        line.includes("}")
      ) {
        // 提取数组名和大小
        const arrayMatch = line.match(/(\w+)\s*\[(\d+)\]\s*=/);
        if (arrayMatch && arrayMatch[1] && arrayMatch[2]) {
          const arrayName = arrayMatch[1];
          const currentSize = parseInt(arrayMatch[2], 10);

          // 检查初始化列表元素数量
          const initListMatch = line.match(/=\s*{([^}]*)}/);
          if (initListMatch && initListMatch[1]) {
            const initElements = initListMatch[1].split(",").length;

            // 如果初始化元素数量超过声明大小，则调整大小
            if (initElements > currentSize) {
              const newSize = initElements;
              const newLine = line.replace(
                new RegExp(`${arrayName}\\s*\\[${currentSize}\\]`),
                `${arrayName}[${newSize}]`
              );

              console.log(
                `修复数组 ${arrayName}: [${currentSize}] -> [${newSize}]`
              );
              modified = true;
              return newLine;
            }
          }
        }
      }
      return line;
    });

    // 如果文件被修改，则写回
    if (modified) {
      fs.writeFileSync(fullPath, newLines.join("\n"), "utf8");
      console.log(`已修复文件 ${file} 中的数组大小溢出问题`);
    } else {
      console.log(`文件 ${file} 中未检测到需要修复的数组大小溢出`);
    }
  } catch (err) {
    console.error(`处理文件 ${file} 时出错:`, err);
  }
});

console.log("处理完成!");
