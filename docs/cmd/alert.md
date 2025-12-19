
# 使用 Windows 批处理脚本创建一次性定时提醒任务

在日常工作中，我们可能需要在某个时间点弹出提醒，例如促销信息、会议提示等。本文分享一个利用 **批处理脚本（.bat）** 和 **Windows 任务计划程序（schtasks）** 的小技巧：自动创建一次性定时任务，执行提醒脚本，并在运行后自动删除任务。

---

## 完整代码（含详细注释）

```bat
@echo off
chcp 65001
set taskname=alertMsg
set time=09:58
set scriptpath=%~dp0alertMsg.bat

:: ================================
:: 如果提醒脚本不存在，则自动生成
:: ================================
if not exist "%scriptpath%" (
    echo @echo off > "%scriptpath%"
    echo chcp 65001 >> "%scriptpath%"          :: 设置编码为 UTF-8，避免中文乱码
    echo title alertMsg >> "%scriptpath%"      :: 设置窗口标题
    echo echo. >> "%scriptpath%"               :: 输出空行
    echo echo ======================================== >> "%scriptpath%"
    echo echo 京东9.9包邮 >> "%scriptpath%"    :: 提醒内容，可自行修改
    echo echo ======================================== >> "%scriptpath%"
    echo echo. >> "%scriptpath%"
    echo pause >> "%scriptpath%"               :: 暂停，等待用户按键关闭
    echo schtasks /delete /tn "%taskname%" /f >> "%scriptpath%" :: 执行完毕后删除任务
)

:: ================================
:: 获取当前日期（格式 yyyy/mm/dd）
:: ================================
for /f "tokens=2 delims==" %%i in ('"wmic os get localdatetime /value"') do set datetime=%%i
set date=%datetime:~0,4%/%datetime:~4,2%/%datetime:~6,2%

:: ================================
:: 创建一次性定时任务
:: ================================
schtasks /create ^
    /tn "%taskname%" ^                         :: 任务名称
    /tr "\"%scriptpath%\"" ^                   :: 要执行的脚本路径
    /sc once ^                                 :: 执行频率：一次性
    /st %time% ^                               :: 执行时间（时:分）
    /sd %date% ^                               :: 执行日期（当天）
    /f                                         :: 强制覆盖同名任务

echo.
echo 一次性定时任务已创建：将在 %date% %time% 执行提醒，并自动删除任务
pause
```

---

## 代码逻辑解析

- **任务名称设置**  
  `set taskname=alertMsg` 定义任务名，方便后续删除。

- **提醒脚本生成**  
  如果 `alertMsg.bat` 不存在，脚本会自动生成一个提醒脚本，内容包括提示信息和删除任务的命令。

- **日期获取**  
  使用 `wmic os get localdatetime` 获取系统时间，再通过字符串截取得到 `yyyy/mm/dd` 格式。

- **定时任务创建**  
  `schtasks /create` 用于创建一次性任务，指定执行时间和日期。

- **任务自动删除**  
  提醒脚本最后一行包含 `schtasks /delete`，确保任务在执行后自动清理，不会残留。

---

## 使用场景

- 🛒 **购物提醒**：如京东促销、淘宝秒杀。  
- 📅 **会议提醒**：在开会前弹出提示。  
- ⏰ **个人事务**：如吃药、锻炼、写博客等。  

---

## 优化建议

- 可以将提醒内容改为参数传入，提升灵活性。  
- 可结合 `msg * "提醒内容"` 直接弹窗，而不是 echo。  
- 如果需要循环提醒，可将 `/sc once` 改为 `/sc daily` 或 `/sc weekly`。  

---

这样，你就拥有一个 **轻量级提醒工具**，无需第三方软件，完全依赖 Windows 自带的任务计划程序和批处理脚本。  