
# 💡使用 Notepad++ 快速提取 SQL 表名的技巧

在日常开发或数据分析中，我们常常需要从大量 SQL 语句中提取出涉及的表名，进行统计、优化或重构。本文将介绍如何使用 Notepad++ 的正则表达式功能，快速从 SQL 文件中提取表名，提升效率。

---

## 🧠 常见 SQL 表名提取场景

SQL 中的表名通常出现在以下几类语句中：

| SQL 类型       | 示例语句                                      | 表名位置           |
|----------------|-----------------------------------------------|--------------------|
| SELECT         | `SELECT * FROM users WHERE id = 1;`           | `FROM users`       |
| JOIN           | `INNER JOIN orders ON users.id = orders.uid`  | `JOIN orders`      |
| INSERT         | `INSERT INTO products (name, price) VALUES...`| `INTO products`    |
| UPDATE         | `UPDATE customers SET name = 'Tom'`           | `UPDATE customers` |
| DELETE         | `DELETE FROM logs WHERE time < NOW()`         | `FROM logs`        |

---

## 🛠 操作步骤：使用 Notepad++ 提取表名

### 1️⃣ 打开 Notepad++ 并加载 SQL 文件

将你的 SQL 文件拖入 Notepad++，或直接粘贴 SQL 内容。

### 2️⃣ 打开“查找”窗口

- 快捷键：`Ctrl + F`
- 切换到“查找”或“查找全部”标签页
- 在底部选择“搜索模式” → 勾选“正则表达式”

### 3️⃣ 输入正则表达式提取表名

根据不同语句类型，使用以下正则表达式：

#### ✅ 提取 SELECT / DELETE 中的表名
```
(?i)\bFROM\s+([a-zA-Z0-9_]+)
```

#### ✅ 提取 INSERT INTO 表名
```
(?i)\bINTO\s+([a-zA-Z0-9_]+)
```

#### ✅ 提取 UPDATE 表名
```
(?i)\bUPDATE\s+([a-zA-Z0-9_]+)
```

#### ✅ 提取 JOIN 表名
```
(?i)\bJOIN\s+([a-zA-Z0-9_]+)
```

> 📌 提示：`(?i)` 表示忽略大小写，`[a-zA-Z0-9_]+` 匹配表名（字母、数字、下划线）

### 4️⃣ 查看匹配结果

点击“查找全部”或“在当前文档中查找”，Notepad++ 会列出所有匹配项，表名会显示在结果中。

---

## 🔍 进阶技巧

- 如果表名带有反引号或双引号，可使用更宽容的表达式：
  ```
  (?i)\bFROM\s+[`"]?([a-zA-Z0-9_]+)[`"]?
  ```
- 可结合“替换”功能，将表名提取出来并保存为新文件。
- 若需批量去重或统计表名频次，建议导出结果后使用 Excel 或脚本处理。

---

## 🧩 总结

使用 Notepad++ 的正则表达式功能，可以高效地从 SQL 中提取表名，适用于代码审查、数据库分析、重构等场景。无需借助复杂工具，轻量级编辑器也能完成强大的文本处理任务。