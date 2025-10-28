
#  MyBatis 符号转义

在 MyBatis-Plus 的 XML 映射文件中，由于 XML 本身的语法限制，某些符号需要进行转义处理，尤其是用于 SQL 条件判断的比较符号。以下是常见符号的转义方式：

## 🔧 XML 中的符号转义表

| 符号 | 含义     | XML 转义写法 |
|------|----------|---------------|
| `<`  | 小于号   | `&lt;`        |
| `>`  | 大于号   | `&gt;`        |
| `<=` | 小于等于 | `&lt;=`       |
| `>=` | 大于等于 | `&gt;=`       |
| `!=` | 不等于   | `!=`（无需转义）|
| `<>` | 不等于（SQL写法）| `&lt;&gt;` |
| `&`  | 与符号   | `&amp;`       |
| `'`  | 单引号   | `&apos;`      |
| `"`  | 双引号   | `&quot;`      |

## ✅ 示例片段

```xml
<select id="selectUser" resultType="User">
  SELECT * FROM user
  WHERE age &gt; 18
    AND status &lt;&gt; 'inactive'
</select>
```

## 💡 补充建议

- 如果你使用的是 `<![CDATA[ ... ]]>` 包裹 SQL，可以避免转义问题：
  
  ```xml
  <select id="selectUser" resultType="User">
    <![CDATA[
      SELECT * FROM user
      WHERE age > 18
        AND status <> 'inactive'
    ]]>
  </select>
  ```

这种方式更适合复杂 SQL，尤其是包含大量比较符号时。