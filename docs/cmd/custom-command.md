# PowerShell 封装自定义命令：从环境变量到一键执行

在日常开发中，我们经常需要重复执行一组固定的 PowerShell 命令，例如设置代理、初始化环境、启动某个工具。每次手动输入不仅繁琐，还容易出错。

**本文介绍一种通用方法：将多条 PowerShell 命令封装成一个可直接调用的自定义命令。**

最终效果是：你只需要在终端输入一个词，例如：

```
popencode
```

即可自动完成「设置代理环境变量 → 启动 opencode」的所有逻辑。

---

## 一、为什么要封装成命令？

| 优势 | 说明 |
|------|------|
| 减少重复操作 | 常用命令一次性封装，随时调用 |
| 避免输入错误 | 复杂环境变量不再手敲 |
| 可移植性强 | 配置 `$PROFILE` 文件可同步到多台机器 |
| 可扩展性强 | 后续可继续加入更多逻辑 |

PowerShell 本身就支持**函数、别名和配置文件**，因此实现方式非常自然。

---

## 二、目标示例：封装代理环境变量 + 执行程序

假设你有如下三条环境变量设置命令，并希望执行 `opencode`：

```powershell
$env:HTTPS_PROXY="http://10.154.1.42:10808"
$env:HTTP_PROXY="http://10.154.1.42:10808"
$env:NO_PROXY="localhost,127.0.0.1"

opencode
```

封装成一个命令 `popencode`，即可一键完成上述全部操作。

---

## 三、使用 PowerShell Profile 封装命令

PowerShell 提供了用户级配置文件 `$PROFILE`，每次启动 PowerShell 时都会自动加载。我们可以在其中定义函数和别名，让它们永久生效。

### 1. 检查 Profile 是否存在

```powershell
Test-Path $PROFILE
```

如果返回 `False`，则创建它：

```powershell
New-Item -ItemType File -Path $PROFILE -Force
```

### 2. 编辑 Profile 文件

```powershell
notepad $PROFILE
```

在文件末尾追加以下内容：

```powershell
function Invoke-OpenCodeProxy {
    $env:HTTPS_PROXY = "http://10.154.1.42:10808"
    $env:HTTP_PROXY  = "http://10.154.1.42:10808"
    $env:NO_PROXY    = "localhost,127.0.0.1"

    opencode
}

Set-Alias popencode Invoke-OpenCodeProxy
```

保存并关闭。

### 3. 重启 PowerShell 验证

重新打开终端后，直接输入：

```
popencode
```

它会自动：

- 设置代理环境变量
- 执行 `opencode`
- 不影响终端其他程序的代理配置

---

## 四、为什么推荐「函数 + 别名」的方式？

### 1. 加载自动化
Profile 在每次启动 PowerShell 时自动加载，无需手动执行脚本。

### 2. 命令更简洁
通过 `Set-Alias` 可以让命令变得非常短，例如 `popencode`。

### 3. 可扩展性强
未来可以继续往函数里添加逻辑，例如：

- 自动检测代理是否可用
- 自动清理环境变量
- 增加参数（如 `popencode --no-proxy`）
- 日志输出
- 异常处理

### 4. 跨设备同步方便
只需同步 `$PROFILE` 文件即可。

---

## 五、进阶：让命令更智能（可选）

### 1. 检查代理端口是否可用

```powershell
Test-NetConnection -ComputerName 10.154.1.42 -Port 10808
```

### 2. 增加参数支持

```powershell
param(
    [switch]$NoProxy
)
```

### 3. 自动恢复环境变量

```powershell
Remove-Item Env:HTTPS_PROXY
Remove-Item Env:HTTP_PROXY
Remove-Item Env:NO_PROXY
```

### 4. 完整增强版示例

把以下完整代码复制进 `$PROFILE`，即可得到一个支持参数、自动检测、异常清理的完整版本：

```powershell
function Invoke-OpenCodeProxy {
    param(
        [switch]$NoProxy,
        [switch]$Clean
    )

    if ($Clean) {
        Remove-Item Env:HTTPS_PROXY -ErrorAction SilentlyContinue
        Remove-Item Env:HTTP_PROXY  -ErrorAction SilentlyContinue
        Remove-Item Env:NO_PROXY    -ErrorAction SilentlyContinue
        Write-Host "已清理代理环境变量" -ForegroundColor Green
        return
    }

    if ($NoProxy) {
        Write-Host "跳过代理设置，直接启动 opencode" -ForegroundColor Yellow
        opencode
        return
    }

    $proxy = "http://10.154.1.42:10808"
    if (Test-NetConnection -ComputerName 10.154.1.42 -Port 10808 -InformationLevel Quiet) {
        $env:HTTPS_PROXY = $proxy
        $env:HTTP_PROXY  = $proxy
        $env:NO_PROXY    = "localhost,127.0.0.1"
        Write-Host "代理已生效：$proxy" -ForegroundColor Green
    } else {
        Write-Host "代理端口 10808 不可用，跳过代理设置" -ForegroundColor Yellow
    }

    opencode
}

Set-Alias popencode Invoke-OpenCodeProxy

# 增加一个清理代理的别名
Set-Alias cleanproxy Invoke-OpenCodeProxy -Option AllScope
```

> 使用技巧：`popencode`（带代理启动）、`popencode -NoProxy`（不带代理）、`cleanproxy -Clean`（清理代理变量）。

---

## 六、总结

通过 PowerShell 的 `$PROFILE`，我们可以轻松将多条命令封装成一个随时调用的自定义命令。这种方式不仅适用于代理设置，还适用于：

- 启动开发环境
- 初始化项目
- 切换 Node / Python 版本
- 启动 Docker 服务
- 自动化构建脚本

| 步骤 | 命令 / 操作 |
|------|------------|
| 检测 Profile | `Test-Path $PROFILE` |
| 创建 Profile | `New-Item -ItemType File -Path $PROFILE -Force` |
| 编辑 Profile | `notepad $PROFILE` |
| 定义函数 | `function Invoke-OpenCodeProxy { ... }` |
| 设置别名 | `Set-Alias popencode Invoke-OpenCodeProxy` |
| 生效并验证 | 重启终端，输入 `popencode` |

只要愿意，几乎任何重复操作都可以封装成一个命令。