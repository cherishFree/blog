# 从零搭建 GitLab + GitLab Runner + SonarQube 持续集成环境（多模块 Maven 项目）

> 适用对象：本文档可以让**新手照做**搭出一套可用的环境，也可以**直接丢给 AI**，AI 按文末「给 AI 的复现说明」即可在新机器上一键落地。
> 本文环境：Windows 11 + WSL2 (Ubuntu) + Docker Desktop。最终效果：提交 MR 后自动 `maven-build` → `sonarqube-check` 跑 SonarQube 扫描，并在 GitLab 项目页展示质量门禁徽章。

---

## 0. 架构总览

```
Windows 主机 (IP 例如 10.154.1.42)
 └─ WSL2 (Ubuntu) 里的 Docker
     ├─ gitlab        (容器)  端口 8818→80   外部访问 http://<主机IP>:8818
     ├─ gitlab-runner (容器)  docker executor，接入 gitlab_default 网络
     └─ sonarqube     (容器)  端口 9000→9000 外部访问 http://<主机IP>:9000
                              （Community Edition，不支持 MR 评论，仅支持徽章）
```

关键点：
- GitLab 与 SonarQube 都跑在 WSL2 内，互相通过 Docker 网络 `gitlab_default` 用容器名（`http://gitlab`、`http://sonarqube` 或 `10.154.1.42`）通信。
- Runner 跑 Maven 任务时需要访问宿主机的 `10.154.1.42:9000`（SonarQube），所以 SonarQube 必须映射宿主机端口且 Runner 用这个地址。
- 多模块 Maven 项目分两个 job：`maven-build`（JDK8 编译并产出 artifact）和 `sonarqube-check`（JDK17 跑 `sonar:sonar`，复用已编译的 class）。

---

## 1. 前置条件

- Windows 10/11，已开启 **WSL2**（`wsl --install` 或手动装 Ubuntu）。
- 已安装 **Docker Desktop**，并在设置里勾选「Use the WSL 2 based engine」，并把 Ubuntu 加到 `Resources → WSL Integration`。
- 主机内存建议 ≥ 8GB（GitLab 较吃内存，已做调优）。
- 一个多模块 Maven 项目（根 `pom.xml` 的 `packaging=pom`，含若干子模块）。本文示例模块名为 `rest_common / rest_system / rest_cache / rest_quartz`（restaurant 项目），以及 `rest_oms_common / rest_oms_client / rest_oms_service`（rest_oms 项目）。

> 所有命令默认在 **WSL 的 Ubuntu 终端** 执行，除非特别说明（如 Windows PowerShell）。

---

## 2. 规划目录（在 WSL 内）

```bash
mkdir -p ~/gitlab/config ~/gitlab/logs ~/gitlab/data
mkdir -p ~/gitlab-runner/config
```

---

## 3. 第一步：部署 GitLab

创建 `~/gitlab/docker-compose.yml`：

```yaml
services:
  gitlab:
    image: gitlab/gitlab-ce:latest
    container_name: gitlab
    restart: always
    hostname: gitlab.local
    ports:
      - "8818:80"    # Web（浏览器访问 http://<主机IP>:8818）
      - "8822:22"    # SSH
    volumes:
      - ./config:/etc/gitlab
      - ./logs:/var/log/gitlab
      - ./data:/var/opt/gitlab
    shm_size: '256m'
    environment:
      GITLAB_OMNIBUS_CONFIG: |
        external_url 'http://localhost:8818'
        # ---- 内存调优（小机器）----
        puma['worker_processes'] = 2
        puma['min_threads'] = 1
        puma['max_threads'] = 2
        sidekiq['min_concurrency'] = 2
        sidekiq['max_concurrency'] = 5
        postgresql['shared_buffers'] = "128MB"
        # ---- 关闭耗内存的可选组件 ----
        prometheus_monitoring['enable'] = false
        gitaly['prometheus_exporter_enabled'] = false
        gitlab_exporter['enable'] = false
        # ---- 初始 root 密码（仅首次启动有效）----
        gitlab_rails['initial_root_password'] = 'Gitlab@2026'
        gitlab_rails['gitlab_shell_ssh_port'] = 8822
```

启动：

```bash
cd ~/gitlab && docker compose up -d
```

等待约 2~5 分钟，浏览器打开 `http://localhost:8818`，用 `root` / `Gitlab@2026` 登录。
**首次登录后会强制改密码**，请记下新密码。

---

## 4. 第二步：部署 GitLab Runner

### 4.1 创建 runner 容器

Runner 通过 Docker 网络 `gitlab_default` 与 GitLab 通信，并挂载 Maven 的 settings（阿里云镜像）和依赖缓存卷。

```bash
# 创建共享网络（GitLab 容器起来后会有这个网络；若没有就手动建）
docker network create gitlab_default 2>/dev/null || true

# 准备 Maven 阿里云镜像 settings（见第 6 步的 maven-settings.xml），放到 ~/gitlab-runner/config/
# 先启动一个空 runner 容器，稍后用 gitlab-runner register 注册
docker run -d --name gitlab-runner --restart always \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v ~/gitlab-runner/config:/etc/gitlab-runner \
  gitlab/gitlab-runner:latest
```

### 4.2 注册 Runner

到 GitLab：**Admin Area → Runners → New instance runner**（或项目级 Settings → CI/CD → Runners），拿到 **注册令牌 (registration token)**。

```bash
docker exec -it gitlab-runner gitlab-runner register
# 按提示输入：
#   GitLab instance URL:  http://gitlab
#   registration token:   <上面拿到的 token>
#   description:          docker-runner-1
#   tags:                 (可留空)
#   executor:             docker
#   default image:        alpine:latest
```

注册完成后，编辑 `~/gitlab-runner/config/config.toml`，把 `[[runners]]` 这一段改成下面内容（重点：`network_mode`、`volumes`、`maven-cache`）：

```toml
concurrent = 1
check_interval = 0
shutdown_timeout = 0

[session_server]
  session_timeout = 1800

[[runners]]
  name = "docker-runner-1"
  url = "http://gitlab"
  # token / token_obtained_at / token_expires_at 由 register 自动写入，保留原值
  executor = "docker"
  [runners.cache]
    MaxUploadedArchiveSize = 0
    [runners.cache.s3]
      AssumeRoleMaxConcurrency = 0
    [runners.cache.gcs]
    [runners.cache.azure]
  [runners.docker]
    tls_verify = false
    image = "alpine:latest"
    network_mode = "gitlab_default"
    privileged = false
    disable_entrypoint_overwrite = false
    oom_kill_disable = false
    disable_cache = false
    volumes = ["/var/run/docker.sock:/var/run/docker.sock", "/cache", "/home/rongbang/gitlab-runner/config/maven-settings.xml:/usr/share/maven/conf/settings.xml:ro", "maven-cache:/root/.m2"]
    volume_keep = false
    shm_size = 0
    network_mtu = 0
```

> 注意：上面 `volumes` 里的 `/home/rongbang/gitlab-runner/config/maven-settings.xml` 是**宿主机（WSL）绝对路径**，请改成你实际的路径。该文件在下一步创建。
> `maven-cache` 是一个具名卷，用来跨 job 缓存 Maven 依赖（restaurant 编译产物也会进这里，供 rest_oms 复用）。手动建卷：`docker volume create maven-cache`。

改完重启 runner：

```bash
docker restart gitlab-runner
```

---

## 5. 第三步：部署 SonarQube（Community Edition）

> 社区版不支持 MR 自动评论/装饰（那是 Developer Edition 才有的功能），但**徽章（badge）可用**。

### 5.1 调整系统参数（Elasticsearch 需要）

```bash
# WSL 内执行（重启后失效，可加到 /etc/sysctl.conf 持久化）
sudo sysctl -w vm.max_map_count=262144
```

### 5.2 启动容器

```bash
docker network create gitlab_default 2>/dev/null || true

docker run -d --name sonarqube --restart unless-stopped \
  --network gitlab_default \
  -p 9000:9000 \
  -e SONAR_ES_BOOTSTRAP_CHECKS_DISABLE=true \
  -v sonar_conf:/opt/sonarqube/conf \
  -v sonar_data:/opt/sonarqube/data \
  -v sonar_ext:/opt/sonarqube/extensions \
  -v sonar_logs:/opt/sonarqube/logs \
  sonarqube:lts-community
```

等待约 1~2 分钟。浏览器打开 `http://localhost:9000`，默认管理员 `admin` / `admin`，**首次登录强制改密码**（本文示例密码设为 `123456`，请自行设定）。

> 建议用 `--restart unless-stopped` 而不是 `no`，否则容器一停就要手动 `docker start`。

---

## 6. Maven 阿里云镜像（加速依赖下载）

创建 `~/gitlab-runner/config/maven-settings.xml`：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<settings xmlns="http://maven.apache.org/SETTINGS/1.2.0"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xsi:schemaLocation="http://maven.apache.org/SETTINGS/1.2.0 https://maven.apache.org/xsd/settings-1.2.0.xsd">
  <mirrors>
    <mirror>
      <id>aliyun</id>
      <name>aliyun</name>
      <mirrorOf>*</mirrorOf>
      <url>https://maven.aliyun.com/repository/public</url>
    </mirror>
    <mirror>
      <id>aliyun-spring</id>
      <name>aliyun-spring</name>
      <mirrorOf>spring-milestones,spring-snapshots</mirrorOf>
      <url>https://maven.aliyun.com/repository/spring</url>
    </mirror>
  </mirrors>
</settings>
```

该文件通过 Runner 的 `volumes` 挂载到每个 Maven 任务容器的 `/usr/share/maven/conf/settings.xml`。

---

## 7. 第四步：让局域网 IP 也能访问（WSL2 端口转发）

WSL2 默认只把容器端口转发到 Windows 的 `localhost`，**不会**转发到 Windows 的局域网 IP（如 `10.154.1.42`）。若你想用 `http://10.154.1.42:8818` 访问，需在 Windows 上做端口代理。

**以管理员身份打开 PowerShell**，执行（把 `10.154.1.42` 换成你本机实际 IP）：

```powershell
# GitLab
netsh interface portproxy add v4tov4 listenaddress=10.154.1.42 listenport=8818 connectaddress=127.0.0.1 connectport=8818
netsh advfirewall firewall add rule name="GitLab-8818" dir=in action=allow protocol=TCP localport=8818

# SonarQube
netsh interface portproxy add v4tov4 listenaddress=10.154.1.42 listenport=9000 connectaddress=127.0.0.1 connectport=9000
netsh advfirewall firewall add rule name="SonarQube-9000" dir=in action=allow protocol=TCP localport=9000
```

验证：`netsh interface portproxy show all`，然后浏览器开 `http://10.154.1.42:8818` 和 `http://10.154.1.42:9000`。

> 若 Windows 重启后 IP 变了，重新执行上面的 `add` 命令（改 IP）即可。WSL IP 不用管（因为连的是 127.0.0.1，由 WSL 的 localhost 转发处理）。

---

## 8. 第五步：初始化 GitLab / SonarQube 配置

### 8.1 提高 Artifact 大小上限（避免 413）

GitLab 默认 `max_artifacts_size = 100MB`，多模块项目编译出的 `target/classes` 很容易超限导致上传失败（`413 Request Entity Too Large`）。在 GitLab **Admin Area → Settings → CI/CD → General pipelines → Maximum artifacts size (MB)** 改成 `500`（或更大），保存。

或后台命令（需 GitLab 容器内能跑 gitlab-rails）：

```bash
docker exec -it gitlab gitlab-rails runner \
  "ApplicationSetting.current.update!(max_artifacts_size: 500)"
```

### 8.2 创建 GitLab 项目并推送代码

- 在 GitLab 新建项目（如 `citest/restaurant`），把多模块 Maven 工程推上去。
- 配置 CI 变量：项目 **Settings → CI/CD → Variables → Add**，加：
  - `SONAR_TOKEN`：值为 SonarQube 的用户 token（下一步生成），**取消 Masked**（Community 版徽章 URL 需要明文），`Protected` 视情况关闭。

### 8.3 生成 SonarQube Token

登录 SonarQube → **My Account → Security → Generate Token**（类型选 User Token），生成后复制（形如 `sqp_xxxx`）。把它填到上一步的 `SONAR_TOKEN` 变量里。

同时建议**关闭强制登录认证**，否则匿名无法访问徽章（徽章会显示 "Project has not been found"）：

- UI：Administration → Security → 关闭 "Force user authentication"
- 或 API（用 admin 账号）：

```bash
curl -u "admin:<你的admin密码>" -X POST \
  "http://10.154.1.42:9000/api/settings/set" \
  --data-urlencode "key=sonar.forceAuthentication" \
  --data-urlencode "value=false"
```

### 8.4 首次扫描会自动建项目

SonarQube 的项目 key 由 `sonar.projectKey` 指定。第一次跑 `sonar:sonar` 成功后会自动创建该项目（可见性默认 public）。本文示例 key 统一用项目名：`restaurant`、`rest_oms`。

---

## 9. 第六步：编写 `.gitlab-ci.yml`

### 9.1 关键要点（必读，都是踩过的坑）

1. **`sonar.java.binaries` 不能用 `**` 通配符**，必须用逗号分隔的**绝对路径**（用 `$CI_PROJECT_DIR` 拼模块路径）。
2. **`after_script` 的字符串里不能出现「冒号+空格」**（如 `badge: http://...`），否则 GitLab YAML lint 会误解析为映射导致 `config_error`。用单引号且去掉冒号，例如 `'SonarQube badge http://...'`。
3. **编译用 JDK8，扫描用 JDK17**：部分老代码用了 `sun.misc.BASE64Encoder` 等 JDK8 私有 API，JDK17 无法编译；但 `sonar:sonar` 本身不重新编译，只需读取已编译的 class，所以用 JDK17 镜像跑 `sonar:sonar` 即可（或直接用 JDK8 也行）。
4. **artifact 体积**：`**/target/classes` 可能很大，请务必先按 8.1 提高上限；若仍超限，可只上传 `**/target/*.jar` 并把 `sonar.java.binaries` 指向 jar（见 9.3）。
5. `only: [merge_requests]` 让流水线只在 MR 上跑。

### 9.2 示例：restaurant 项目（模块 rest_common/rest_system/rest_cache/rest_quartz）

```yaml
stages:
  - build
  - sonar
  - test

# 1. 构建阶段：使用 JDK 8
maven-build:
  image: maven:3.8.8-eclipse-temurin-8
  stage: build
  script:
    - mvn -B -U clean install
  artifacts:
    paths:
      - '**/target/*.jar'
      - '**/target/classes'
    exclude:
      - '**/target/*-sources.jar'
      - '**/target/*-javadoc.jar'
  only:
    - merge_requests
  allow_failure: false

# 2. SonarQube 扫描阶段：使用 JDK 17
sonarqube-check:
  image: maven:3.9.6-eclipse-temurin-17
  stage: sonar
  script:
    - mvn -B sonar:sonar -Dsonar.projectKey=restaurant -Dsonar.host.url=http://10.154.1.42:9000 -Dsonar.login=$SONAR_TOKEN -Dsonar.java.binaries=$CI_PROJECT_DIR/rest_common/target/classes,$CI_PROJECT_DIR/rest_system/target/classes,$CI_PROJECT_DIR/rest_cache/target/classes,$CI_PROJECT_DIR/rest_quartz/target/classes
  after_script:
    - echo 'SonarQube badge http://10.154.1.42:9000/api/project_badges/quality_gate?project=restaurant'
    - echo 'SonarQube report http://10.154.1.42:9000/dashboard?id=restaurant'
  dependencies:
    - maven-build
  only:
    - merge_requests
  allow_failure: false

# 3. 单元测试阶段（可选）
#unit-test:
#  image: maven:3.8.8-eclipse-temurin-8
#  stage: test
#  script:
#    - mvn -B test
#  dependencies:
#    - maven-build
#  only:
#    - merge_requests
```

### 9.3 示例：rest_oms 项目（模块 rest_oms_common/rest_oms_client/rest_oms_service）

> rest_oms 与 restaurant 的区别只是**模块名不同**，`sonar.java.binaries` 必须改成自己的模块路径，否则 sonar 找不到 class。

```yaml
stages:
  - build
  - sonar
  - test

maven-build:
  image: maven:3.8.8-eclipse-temurin-8
  stage: build
  script:
    - mvn -B -U clean install
  artifacts:
    paths:
      - '**/target/*.jar'
      - '**/target/classes'
    exclude:
      - '**/target/*-sources.jar'
      - '**/target/*-javadoc.jar'
  only:
    - merge_requests
  allow_failure: false

sonarqube-check:
  image: maven:3.9.6-eclipse-temurin-17
  stage: sonar
  script:
    - mvn -B sonar:sonar -Dsonar.projectKey=rest_oms -Dsonar.host.url=http://10.154.1.42:9000 -Dsonar.login=$SONAR_TOKEN -Dsonar.java.binaries=$CI_PROJECT_DIR/rest_oms_common/target/classes,$CI_PROJECT_DIR/rest_oms_client/target/classes,$CI_PROJECT_DIR/rest_oms_service/target/classes
  after_script:
    - echo 'SonarQube badge http://10.154.1.42:9000/api/project_badges/quality_gate?project=rest_oms'
    - echo 'SonarQube report http://10.154.1.42:9000/dashboard?id=rest_oms'
  dependencies:
    - maven-build
  only:
    - merge_requests
  allow_failure: false
```

> 若想彻底避免 artifact 过大问题，可把 `maven-build` 的 artifacts 改为只传 `'**/target/*.jar'`，并把上面 `sonar.java.binaries` 的值改为各模块 `target/*.jar`（SonarQube 也支持直接分析 jar 包）。

提交并推送（或开 MR 触发）后，到 GitLab 项目 **CI/CD → Pipelines** 查看结果。

---

## 10. 第七步：在 GitLab 项目页加 SonarQube 徽章

GitLab 项目 **Settings → General → Badges → Add badge**：

- **Name**：`SonarQube Quality Gate`
- **Link URL**：`http://10.154.1.42:9000/dashboard?id=<项目key>`
  - 例：`http://10.154.1.42:9000/dashboard?id=restaurant`
- **Image URL**：`http://10.154.1.42:9000/api/project_badges/quality_gate?project=<项目key>`
  - 例：`http://10.154.1.42:9000/api/project_badges/quality_gate?project=restaurant`

保存后，项目页右上角即显示质量门禁徽章（绿色 PASS / 红色 FAILED）。

> 注意：`forceAuthentication` 必须已关闭（见 8.3），否则徽章图显示 "Project has not been found"。

---

## 11. 常见问题 / 踩坑速查

| 现象 | 原因 | 解决 |
|------|------|------|
| 流水线 `config_error`，`after_script config should be a string` | `after_script` 内容含「冒号+空格」被误解析 | 用单引号，去掉冒号（如 `'SonarQube badge http://...'`） |
| sonar 报 `No files nor directories matching ...` | `sonar.java.binaries` 用了 `**` 或相对/错误路径 | 改逗号分隔的 `$CI_PROJECT_DIR/<模块>/target/classes` 绝对路径 |
| 上传 artifact 报 `413 Request Entity Too Large` | 超过 `max_artifacts_size`（默认 100MB） | 提高 GitLab 该上限（8.1），或只传 jar 不传 classes |
| 徽章显示 "Project has not been found" | `sonar.forceAuthentication=true` 拒绝匿名 | 关闭强制认证（8.3） |
| `sun.misc.BASE64Encoder` 编译失败 | 用 JDK17 编译老代码 | 编译阶段用 JDK8（如 9.2 所示） |
| 重启机器后 sonarqube 没起来 | 容器 `RestartPolicy=no` | 用 `--restart unless-stopped` 启动，或手动 `docker start sonarqube` |
| 用局域网 IP 访问不了 GitLab/SonarQube | WSL2 未转发到主机 IP | 按第 7 步加 `netsh interface portproxy` + 防火墙规则 |
| SonarQube 起不来 / ES 报错 | `vm.max_map_count` 太小 | `sudo sysctl -w vm.max_map_count=262144`（5.1） |
| Community 版 MR 下没有 SonarQube 评论 | 社区版不支持 MR Decoration | 仅徽章/报告链接可用；或自写脚本用 GitLab API 往 MR 发评论 |

---

## 12. 给 AI 的复现说明（把本环境搬到新机器）

如果你是 AI，请按以下顺序在新环境完整搭建，所有配置文件内容见上文对应章节：

1. **确认前置**：Windows + WSL2(Ubuntu) + Docker Desktop 已就绪；记录本机局域网 IP（如 `10.154.1.42`）和 WSL IP。
2. **建目录**：`~/gitlab/{config,logs,data}`、`~/gitlab-runner/config`；建 docker 卷 `maven-cache` 和 `gitlab_default` 网络。
3. **GitLab**：写 `~/gitlab/docker-compose.yml`（内容见第 3 步），`docker compose up -d`；等启动后用 root 登录并改密码。把文中 `Gitlab@2026` 替换为实际初始密码或自行设定。
4. **Runner**：`docker run` 起 runner 容器（挂 docker.sock 与 config 卷）；`gitlab-runner register`（URL=`http://gitlab`，executor=docker）；把 `config.toml` 改成第 4.2 节内容（注意把 maven-settings 的宿主机路径改成实际路径）；`docker restart gitlab-runner`。
5. **Maven settings**：写 `~/gitlab-runner/config/maven-settings.xml`（第 6 步，阿里云镜像）。
6. **SonarQube**：`sudo sysctl -w vm.max_map_count=262144`；`docker run` 起 `sonarqube:lts-community`（挂 4 个 named volume、映射 9000、`--restart unless-stopped`、加 `SONAR_ES_BOOTSTRAP_CHECKS_DISABLE=true`、`--network gitlab_default`）；首次登录 admin 改密码。
7. **端口转发**：在 Windows 管理员 PowerShell 执行第 7 步的 `netsh interface portproxy` + 防火墙规则（IP 替换为本机实际 IP）。
8. **GitLab 初始化**：提高 `max_artifacts_size` 到 500（8.1）；创建项目并推送多模块 Maven 代码；建 CI 变量 `SONAR_TOKEN`。
9. **SonarQube 初始化**：生成 User Token 填入 `SONAR_TOKEN`；调用 API 把 `sonar.forceAuthentication` 设为 `false`（8.3）。
10. **CI 配置**：把第 9 步的 `.gitlab-ci.yml` 放到项目根目录（**务必把 `sonar.java.binaries` 的各模块路径改成你项目的真实模块名**，把 `sonar.host.url` 的 IP 改成实际主机 IP，把 `sonar.projectKey` 改成你的项目 key）；开 MR 触发流水线。
11. **徽章**：在 GitLab 项目 Settings → Badges 添加质量门禁徽章（第 10 步）。
12. **验证清单**：① GitLab `http://<IP>:8818` 可登录；② SonarQube `http://<IP>:9000` 可登录；③ MR 流水线绿；④ 项目页徽章显示质量门禁状态；⑤ `http://<IP>:9000/api/project_badges/quality_gate?project=<key>` 返回 SVG。

> 重要约束（用户要求）：**不要使用 `git commit` / `git push` 命令**，由用户自行提交推送。所有配置改动只停留在文件与容器层面。
