# WSL 使用 Windows v2rayN 代理（10808 端口）完整教程

---

## 1. 确认 Windows 主机的真实 IP（WSL 访问 Windows 必须用它）

在 WSL 中执行：

```
ip route
```

你会看到类似(PS:如果你看到的地址，在下面测试时不可用，那么就去windows中使用cmd命令ipconfig查看你windows的ip地址，可以用那个地址)：

```
default via 10.154.1.42 dev eth0
```

其中：

- **10.154.1.42** 就是 Windows 主机的真实 IP  
- WSL 不能用 127.0.0.1 访问 Windows  
- 必须用这个 IP 才能访问 Windows 的代理端口

你已经确认 Windows 主机 IP 为 **10.154.1.42**。

---

## 2. 测试 WSL 是否能访问 Windows 的代理端口

在 WSL 中执行：

```
nc -vz 10.154.1.42 10808
```

你得到：

```
Connection to 10.154.1.42 10808 port [tcp/*] succeeded!
```

说明：

- Windows v2rayN 的代理端口 **10808 正在监听**
- WSL 可以访问这个端口
- 网络链路正常

---

## 3. 在 WSL 中设置持久化代理变量（写入 ~/.bashrc）

打开 `.bashrc`：

```
vi ~/.bashrc
```

加入以下内容（使用你的端口 10808 和 Windows 主机 IP 10.154.1.42）：

```
export http_proxy="http://10.154.1.42:10808"
export https_proxy="http://10.154.1.42:10808"
export all_proxy="socks5://10.154.1.42:10808"
export no_proxy="127.0.0.1,localhost,::1"
```

保存后让它生效：

```
source ~/.bashrc
```

---

## 4. 验证代理变量是否加载成功

```
env | grep -i proxy
```

你应该看到：

```
http_proxy=http://10.154.1.42:10808
https_proxy=http://10.154.1.42:10808
all_proxy=socks5://10.154.1.42:10808
```

说明 WSL 已经加载代理变量。

---

## 5. 测试 WSL 是否真正走代理（最关键）

执行：

```
wget https://www.google.com
```

你得到：

```
Connecting to 10.154.1.42:10808... connected.
Proxy request sent, awaiting response... 200 OK
Saving to: ‘index.html’
```

这说明：

- WSL 成功连接到 Windows 的代理端口  
- v2rayN 正常处理请求  
- Google 返回 200 OK  
- WSL 已经完全走代理  

你的代理链路已经完全跑通。

---

# 最终效果（你现在的状态）

| 项目 | 状态 |
|------|------|
| WSL → Windows 主机网络 | ✔ 正常 |
| Windows v2rayN 10808 端口 | ✔ 正在监听 |
| WSL 代理变量 | ✔ 正确设置为 10.154.1.42 |
| 持久化 `.bashrc` | ✔ 生效 |
| wget/curl 走代理 | ✔ 成功 |
| WSL 能访问 Google | ✔ 成功 |

你已经完成了整个 WSL 代理配置的全部步骤。
