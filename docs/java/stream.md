
# 🌊 Java Stream 

Java 8 引入了 Stream API，它让我们可以用更简洁、函数式的方式处理集合数据。本文将带你一步步了解 Stream 的核心概念、常用操作和典型应用场景。

---

## 🧠 什么是 Stream？

Stream 是对集合数据的高级抽象，它就像一条流水线，把数据从源头（如 List）经过一系列处理，最终输出结果。

- ✅ 不存储数据，只负责处理。
- ✅ 支持链式调用，代码更简洁。
- ✅ 惰性执行，只有终端操作才真正触发。

---

## 🛠️ 如何创建 Stream？

```java
List<String> list = Arrays.asList("apple", "banana", "cherry");

// 从集合创建
Stream<String> stream1 = list.stream();

// 从数组创建
Stream<Integer> stream2 = Arrays.stream(new Integer[]{1, 2, 3});

// 直接创建
Stream<String> stream3 = Stream.of("A", "B", "C");
```

---

## 🔧 常用中间操作（不会触发执行）

| 方法       | 作用说明                     | 示例代码 |
|------------|------------------------------|----------|
| `filter()` | 过滤元素                     | `.filter(s -> s.length() > 5)` |
| `map()`    | 映射转换                     | `.map(String::toUpperCase)` |
| `flatMap()`| 扁平化嵌套结构               | `.flatMap(s -> Arrays.stream(s.split(" ")))` |
| `distinct()`| 去重                        | `.distinct()` |
| `sorted()` | 排序                         | `.sorted()` |
| `peek()`   | 查看中间结果（调试用）       | `.peek(System.out::println)` |

---

## 🎯 常用终端操作（触发执行）

| 方法         | 作用说明                     | 示例代码 |
|--------------|------------------------------|----------|
| `collect()`  | 收集结果                     | `.collect(Collectors.toList())` |
| `forEach()`  | 遍历每个元素                 | `.forEach(System.out::println)` |
| `count()`    | 统计数量                     | `.count()` |
| `reduce()`   | 聚合计算                     | `.reduce(0, Integer::sum)` |
| `anyMatch()` | 是否有任意元素满足条件       | `.anyMatch(s -> s.contains("a"))` |

---

## 📌 示例：处理字符串列表

```java
List<String> fruits = Arrays.asList("apple", "banana", "cherry", "date");

List<String> result = fruits.stream()
    .filter(f -> f.length() > 5)
    .map(String::toUpperCase)
    .sorted()
    .collect(Collectors.toList());

System.out.println(result); // 输出：[BANANA, CHERRY]
```

---

## 🧮 示例：数字求和与去重

```java
List<Integer> numbers = Arrays.asList(1, 2, 2, 3, 4, 4, 5);

int sum = numbers.stream()
    .distinct()
    .reduce(0, Integer::sum);

System.out.println(sum); // 输出：15
```

---

## 🧩 示例：嵌套结构扁平化

```java
List<String> sentences = Arrays.asList("hello world", "java stream");

List<String> words = sentences.stream()
    .flatMap(s -> Arrays.stream(s.split(" ")))
    .collect(Collectors.toList());

System.out.println(words); // 输出：[hello, world, java, stream]
```

---

## 🚀 并行流（Parallel Stream）

适合处理大数据量，自动利用多核 CPU：

```java
list.parallelStream()
    .filter(...)
    .map(...)
    .collect(Collectors.toList());
```

---

## 🧠 小结

- Stream 是处理集合的利器，代码更简洁、可读性更强。
- 熟练掌握 `filter`、`map`、`collect`、`reduce` 等方法是关键。
- 遇到嵌套结构时用 `flatMap`，调试时用 `peek`。
- 大数据量时可尝试 `parallelStream` 提升性能。

---

如果你想把这篇文章发布到博客，我可以帮你生成 Markdown 文件结构、目录导航，甚至配图。如果你有特定的应用场景（比如日志处理、数据库结果处理），我也可以帮你定制 Stream 模板。要不要我继续扩展成完整博客项目结构？
