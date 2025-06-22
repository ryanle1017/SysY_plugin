/**
 * SysY语言示例程序加载器
 * 提供加载预设示例程序到编辑器中的功能
 */

// 示例程序列表
const examples = {
  factorial: {
    name: "阶乘计算 (递归示例)",
    description: "演示递归函数计算阶乘",
    path: "examples/factorial.sysy",
  },
  "bubble-sort": {
    name: "冒泡排序 (数组操作示例)",
    description: "演示数组和循环操作实现冒泡排序",
    path: "examples/bubble-sort.sysy",
  },
};

/**
 * 示例程序加载器
 */
export class ExampleLoader {
  /**
   * 创建示例加载器
   * @param {Object} editor - Monaco编辑器实例
   */
  constructor(editor) {
    this.editor = editor;
  }

  /**
   * 初始化示例选择器UI
   * @param {HTMLElement} containerElement - 放置UI的容器元素
   */
  init(containerElement) {
    // 创建示例选择下拉菜单
    const container = document.createElement("div");
    container.className = "example-selector";
    container.style.marginBottom = "10px";
    container.style.display = "flex";
    container.style.alignItems = "center";

    const label = document.createElement("span");
    label.textContent = "加载示例程序: ";
    label.style.marginRight = "10px";
    label.style.color = "#ccc";

    const select = document.createElement("select");
    select.style.padding = "5px";
    select.style.backgroundColor = "#333";
    select.style.color = "#fff";
    select.style.border = "1px solid #555";
    select.style.borderRadius = "3px";
    select.style.width = "200px";

    // 添加默认选项
    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = "-- 选择示例 --";
    select.appendChild(defaultOption);

    // 添加示例选项
    for (const [id, example] of Object.entries(examples)) {
      const option = document.createElement("option");
      option.value = id;
      option.textContent = example.name;
      select.appendChild(option);
    }

    // 按钮样式
    const loadButton = document.createElement("button");
    loadButton.textContent = "加载";
    loadButton.style.marginLeft = "10px";
    loadButton.style.padding = "5px 10px";
    loadButton.style.backgroundColor = "#0e639c";
    loadButton.style.color = "white";
    loadButton.style.border = "none";
    loadButton.style.borderRadius = "3px";
    loadButton.style.cursor = "pointer";

    // 示例描述区域
    const descriptionDiv = document.createElement("div");
    descriptionDiv.className = "example-description";
    descriptionDiv.style.marginLeft = "20px";
    descriptionDiv.style.color = "#999";
    descriptionDiv.style.fontSize = "12px";
    descriptionDiv.style.fontStyle = "italic";

    // 注册事件处理
    select.addEventListener("change", () => {
      const exampleId = select.value;
      if (exampleId && examples[exampleId]) {
        descriptionDiv.textContent = examples[exampleId].description;
      } else {
        descriptionDiv.textContent = "";
      }
    });

    loadButton.addEventListener("click", async () => {
      const exampleId = select.value;
      if (exampleId) {
        await this.loadExample(exampleId);
      }
    });

    // 组装UI元素
    container.appendChild(label);
    container.appendChild(select);
    container.appendChild(loadButton);
    container.appendChild(descriptionDiv);

    // 添加到容器
    containerElement.insertBefore(container, containerElement.firstChild);
  }

  /**
   * 加载指定的示例程序
   * @param {string} exampleId - 示例程序ID
   */
  async loadExample(exampleId) {
    if (!examples[exampleId]) {
      console.error(`未找到示例: ${exampleId}`);
      return;
    }

    try {
      const response = await fetch(examples[exampleId].path);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const code = await response.text();
      this.editor.setValue(code);

      console.log(`示例 "${examples[exampleId].name}" 已加载`);
    } catch (error) {
      console.error(`加载示例时出错: ${error}`);
    }
  }
}
