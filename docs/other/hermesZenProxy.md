# Hermes 配置 opencode 免费模型：zen-proxy 本地代理配置全记录

> 起因：我把 Hermes 的模型切到 opencode 的 zen 免费通道后，请求全部被拒 —— `429 FreeUsageLimitError`，限流限到怀疑人生。排查到最后发现是个身份问题：opencode 的免费模型只认自家客户端的 `User-Agent`，第三方 Agent 直连统统被网关按"非官方客户端"处理。
>
> 解法：本地起一个 zen-proxy 代理，替所有请求注入正确的 UA，把 opencode 免费模型（deepseek-v4-flash-free / hy3-free / nemotron 等）重新包装成标准 OpenAI API。全程匿名、零账号、零 key，配置完 Hermes 走本地代理即可。

---

## 1. 原理：为什么直连会被 429

opencode 官方给自家客户端开放了一批匿名免费模型（`-free` 后缀：`deepseek-v4-flash-free`、`hy3-free`、`mimo-v2.5-free`、`nemotron`），但免费额度**只发给请求头带 `User-Agent: opencode/xxx` 的请求**。

Hermes 直连 `https://opencode.ai/zen/v1` 时有两个坑：

1. Hermes 自带身份（`User-Agent: HermesAgent/<ver>`），被网关按非官方客户端处理 → 429；
2. 更隐蔽的：Hermes 内置的 `opencode-zen` provider 插件把 `base_url` 和 UA **写死在插件代码里**，你在 config 里改 base_url 根本无效（源码实锤）。

zen-proxy 做的事（100% 本地，零依赖）：

```
Hermes ──(OpenAI 协议)──> zen-proxy :8787 ──(注入 opencode UA + 真实 IP)──> opencode 免费网关
                              │
                              └── 管理面板 http://127.0.0.1:8787/
```

- 注入正确的 `User-Agent: opencode/1.2.31`（开免费层的钥匙）
- 转发真实 IP（与 opencode 直连同一配额桶）
- 多模型智能回退：某个免费模型饱和（429/5xx）自动换下一个
- 支持模型别名（如 `gpt-4o` → `deepseek-v4-flash-free`）
- 附带管理面板：实时请求统计、一键测模型、日志

---

## 2. 前置条件

| 项目 | 要求 |
|------|------|
| Node.js | >= 18 |
| curl | 有即可 |
| WSL systemd（可选，常驻用） | `/etc/wsl.conf` 里 `[boot] systemd=true` |

检查命令：

```bash
node --version
curl --version
```

---

## 3. 安装 zen-proxy

方案 A：官方一行安装（推荐）：

```bash
curl -fsSL https://raw.githubusercontent.com/12errh/zen-proxy/main/install.sh | bash
```

方案 B：git clone（单文件零依赖，不需要 npm install）：

```bash
git clone https://github.com/12errh/zen-proxy.git ~/.zen-proxy
```

安装产物：

- 程序目录：`~/.zen-proxy/`（核心就是 `zen-proxy.mjs` 单文件）
- 启动器：`~/.local/bin/zen-proxy`

配置默认即可，无需手动改：

```json
// ~/.zen-proxy/zen-proxy.json
{ "host": "127.0.0.1", "port": 8787 }
```

---

## 4. 启动并验证代理

手动启动（先验证）：

```bash
node ~/.zen-proxy/zen-proxy.mjs
```

或

```bash
~/.local/bin/zen-proxy
```

验证三连：

```bash
# ① 进程活着，端口有响应
(curl -s --max-time 3 http://127.0.0.1:8787/v1/models >/dev/null && echo "8787 有响应") || echo "无响应"

# ② 模型列表（应能看到 7 个免费模型，含 deepseek-v4-flash-free / hy3-free / nemotron）
curl -s http://127.0.0.1:8787/v1/models | head -c 500

# ③ 真实 chat 请求（匿名 Bearer public）
curl -s --max-time 30 http://127.0.0.1:8787/v1/chat/completions \
  -H "Content-Type: application/json" -H "Authorization: Bearer public" \
  -d '{"model":"hy3-free","messages":[{"role":"user","content":"reply with the single word: ok"}],"stream":false}' | head -c 250
```

能返回 `"ok"` 即代理链路通了。管理面板：浏览器打开 **http://127.0.0.1:8787/**（实时请求统计、模型测试、日志）。

> 顺手看一眼代理启动日志还能实锤原理：它上游用的 UA 就是 `opencode/1.2.31`。

---

## 5. 配置 Hermes 走本地代理（关键步骤）

**核心坑**：`opencode-zen` 插件里 base_url 和 UA 写死，config 改它无效。必须改用 `custom` provider，才会走标准 OpenAI 客户端、真正用上你配的 base_url。

用官方命令改（别手编 config.yaml，容易缩进错误弄崩网关）：

```bash
hermes config set model.provider custom
hermes config set model.base_url http://127.0.0.1:8787/v1
hermes config set model.api_key public
hermes config set model.default hy3-free
hermes config set model.api_mode chat_completions
```

改动后的 model 块：

```yaml
model:
  default: hy3-free          # 默认模型，饱和时 zen-proxy 自动回退到其他免费模型
  provider: custom           # 关键：不能用 opencode-zen（UA/base_url 写死）
  base_url: http://127.0.0.1:8787/v1
  api_mode: chat_completions
  api_key: public            # 匿名 key，或换成你自己的 Zen key（BYOK）
```

> 多 profile 注意：以上命令作用于当前 profile。每个 profile 都要改的话需重复执行或切换 profile。

**生效条件：重开 Hermes 会话**（配置只影响新会话，当前会话仍走旧配置，这是正常现象）。

默认模型怎么选：

- `deepseek-v4-flash-free`：主力模型，能力强，但免费额度小、高峰 429 概率高；
- `hy3-free`：更稳，配合 zen-proxy 回退链（deepseek-v4-flash-free → hy3-free → nemotron…），单模型饱和会自动换；
- 想指定回退顺序/别名，可在 zen-proxy 管理面板改。

---

## 6. 用 systemd 常驻（推荐，重启不丢）

写服务文件：

```ini
# ~/.config/systemd/user/zen-proxy.service
[Unit]
Description=Zen Proxy (opencode free models -> local OpenAI-compatible)
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/node /home/你的用户名/.zen-proxy/zen-proxy.mjs
Restart=always
RestartSec=3
Environment=NODE_ENV=production

[Install]
WantedBy=default.target
```

注册并启动：

```bash
systemctl --user daemon-reload
systemctl --user enable --now zen-proxy.service    # enable 开机自启 + 立即启动
```

状态检查：

```bash
systemctl --user is-active zen-proxy.service   # 期望 active
systemctl --user is-enabled zen-proxy.service  # 期望 enabled
journalctl --user -u zen-proxy.service -n 20 --no-pager   # 看日志
```

两个实操教训：

1. **端口被占会起不来**：如果之前手动 `node zen-proxy.mjs` 起过，先杀掉占用 8787 的进程，再 `systemctl --user restart zen-proxy.service`；
2. **Restart=always 自动接管**：即使手动进程被杀，systemd 也会自动拉新实例（restart counter），日志里能看到。

---

## 7. 整链路验收清单

```bash
# ① 代理进程归属（确认是 systemd 托管的）
pgrep -af zen-proxy.mjs

# ② Hermes 配置已生效
hermes config get   # 或看 model 块：provider=custom, base_url=127.0.0.1:8787

# ③ 新开一个 Hermes 会话发条消息，正常响应即闭环
# ④ 打开 http://127.0.0.1:8787/ 看实时请求统计，能看到 Hermes 的调用
```

---

## 8. 常用命令速查

| 操作 | 命令 |
|---|---|
| 手动启动代理 | `~/.local/bin/zen-proxy` 或 `node ~/.zen-proxy/zen-proxy.mjs` |
| 看代理状态 | `systemctl --user status zen-proxy.service --no-pager` |
| 重启代理 | `systemctl --user restart zen-proxy.service` |
| 看代理日志 | `journalctl --user -u zen-proxy.service -n 50 --no-pager` |
| 改端口/监听 | 编辑 `~/.zen-proxy/zen-proxy.json` 后重启 |
| 看 Hermes 模型配置 | `hermes config get`（model 块） |
| 改 Hermes 模型 | `hermes config set model.default <模型名>` 后重开会话 |
| 管理面板 | 浏览器开 `http://127.0.0.1:8787/` |

---

## 9. 故障排查

| 现象 | 原因 | 处理 |
|---|---|---|
| 模型全 429 / FreeUsageLimitError | 免费网关共享配额饱和 | 等一会儿重试；zen-proxy 会自动回退到其他免费模型；降并发、加退避 |
| Hermes 仍被拒（配置后新会话依旧） | provider 没改成 custom | 确认 `hermes config get` 里 provider=custom；opencode-zen 插件的 base_url 是写死的 |
| systemd 服务起不来 | 8787 被手动进程占用 | `pgrep -af zen-proxy.mjs` 找到并 kill，再 restart 服务 |
| 某个模型不可用 | 上游调整/该模型饱和 | 到管理面板一键测模型，换 default 模型 |
| WSL 里 systemctl 报错 | systemd 未启用 | /etc/wsl.conf 加 `[boot] systemd=true`，`wsl --shutdown` 重启 WSL |

---

## 10. 边界：免费午餐的前提

1. **只解决"UA 被拒"，不解决"免费额度小"**。高频调用仍可能 429，靠 zen-proxy 多模型回退缓解，不是根治。
2. **依赖非官方机制**：opencode 上游改规则（换 UA 版本、收紧匿名额度）后 zen-proxy 可能失效，届时升级版本或换方案。
3. **生产/高频建议 BYOK**：在 zen-proxy 配自己的 Zen key（带配额、稳定、不吃共享池限流），或者走正规 API（DeepSeek 官方等）。
4. **免费模型的配额桶按机器 IP 算**，别在同一网络下多台机器同时狂刷，会互相挤占。

---

## 最终效果一览

| 项目 | 状态 |
|------|------|
| zen-proxy 本地代理 :8787 | ✔ 运行中 |
| UA 注入（opencode/1.2.31） | ✔ 生效 |
| Hermes provider=custom 走本地代理 | ✔ 生效 |
| 免费模型调用（hy3-free 等） | ✔ 正常 |
| systemd 常驻（重启自拉起） | ✔ enabled + active |
| 管理面板统计 | ✔ http://127.0.0.1:8787/ |

至此，Hermes 白嫖 opencode 免费模型的链路全部打通。免费额度虽小，配合多模型回退，日常开发完全够用。
