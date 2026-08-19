# WSL 中使用 Docker 部署 SonarQube 并配置代码扫描完整教程

---

## 一、环境说明

| 项目 | 说明 |
|------|------|
| Windows 主机 IP | 10.154.1.42 |
| WSL2 子系统 | Ubuntu（NAT 模式） |
| Docker | 29.1.3 + Compose 2.40.3（WSL 内） |
| SonarQube | 9.9.8.100196（LTS 社区版） |
| sonar-scanner | 7.0.2.4839（Windows） |
| Maven | 3.6.3（D:\apache-maven-3.6.3） |
| JDK | JDK8（编译用）+ JDK17（分析用） |

访问地址：

- GitLab：`http://localhost:8818`
- SonarQube：`http://localhost:9000`

---

## 二、WSL 中安装 Docker

WSL 内执行（需要 root）：

```
curl -fsSL https://get.docker.com | bash -s docker
```

验证：

```
docker --version
docker compose version
```

> 如果出现权限问题，将当前用户加入 docker 组：
> `sudo usermod -aG docker $USER && newgrp docker`

---

## 三、Docker 部署 SonarQube

### 3.1 拉取镜像并运行容器

```
docker run -d --name sonarqube \
  -p 9000:9000 \
  -v sonar_conf:/opt/sonarqube/conf \
  -v sonar_data:/opt/sonarqube/data \
  -v sonar_logs:/opt/sonarqube/logs \
  -v sonar_ext:/opt/sonarqube/extensions \
  -e SONAR_ES_BOOTSTRAP_CHECKS_DISABLE=true \
  sonarqube:lts-community
```

参数说明：

- `sonarqube:lts-community`：9.9 LTS 社区版，**免费**
- 挂载 4 个卷：conf / data / logs / extensions，**升级不丢数据**
- `SONAR_ES_BOOTSTRAP_CHECKS_DISABLE=true`：跳过 ES 启动时的宿主环境检查（WSL 内存限制必须加）

### 3.2 查看启动日志

```
docker logs -f sonarqube
```

看到 `SonarQube is up` 即启动成功。

### 3.3 首次登录

浏览器访问 `http://localhost:9000`，默认账号密码：

- 用户名：`admin`
- 密码：`admin`（首次登录会强制改密）

### 3.4 安装中文语言包

下载 `sonar-l10n-zh-plugin`（版本号要和 SonarQube 主版本一致，如 9.9），然后：

```
docker cp sonar-l10n-zh-plugin-9.9.jar sonarqube:/opt/sonarqube/extensions/plugins/
docker restart sonarqube
```

重启后到 头像 → Edit profile → Preferences 里把语言切为简体中文。

> **提示**：启动时的警告"内嵌数据库只能用于测试场景"可以忽略——默认使用内嵌 H2 数据库，适合个人/测试用；生产环境建议换 PostgreSQL。

---

## 四、Windows 安装 sonar-scanner（扫描 JS/Vue 项目用）

### 4.1 下载解压

- 下载 `sonar-scanner-cli-7.0.2.4839-windows-x64.zip`
- 解压到 `C:\sonar-scanner\sonar-scanner-7.0.2.4839-windows-x64`

> 注意：如果 SonarQube 是 9.9，**不要用** sonar-scanner 8.x（要求 SonarQube 10.6+），选 7.0.x。

### 4.2 配置环境变量

`sonar-scanner.properties` 中配置服务器地址：

```
sonar.host.url=http://localhost:9000
```

将 bin 目录加入系统 PATH：

```
C:\sonar-scanner\sonar-scanner-7.0.2.4839-windows-x64\bin
```

验证：

```
sonar-scanner.bat -v
```

---

## 五、Maven 项目扫描（Java 项目）

### 5.1 环境准备

- **JDK8** 编译（项目 `maven.compiler.source/target=8`）
- **JDK17** 分析（SonarQube 9.9 要求）

准备一个专用 settings 文件 `D:\apache-maven-3.6.3\conf\settings-sonar.xml`，使用阿里云镜像且不镜像内网 Nexus：

```xml
<settings>
  <mirrors>
    <mirror>
      <id>aliyun</id>
      <mirrorOf>central</mirrorOf>
      <url>https://maven.aliyun.com/repository/public</url>
    </mirror>
  </mirrors>
</settings>
```

### 5.2 获取项目 Token

SonarQube → 项目 → Administration → General Settings → 生成 Token。

### 5.3 两步扫描（关键）

**第一步：JDK8 编译**

```powershell
$env:JAVA_HOME="C:\Program Files\Java\jdk1.8.0_221"
mvn -s D:\apache-maven-3.6.3\conf\settings-sonar.xml clean compile
```

**第二步：JDK17 分析**

```powershell
$env:JAVA_HOME="C:\Program Files\Java\jdk-17.0.2"
mvn -s D:\apache-maven-3.6.3\conf\settings-sonar.xml org.sonarsource.scanner.maven:sonar-maven-plugin:3.9.1.2184:sonar -Dsonar.projectKey=rest_oms -Dsonar.projectName=rest_oms -Dsonar.host.url=http://localhost:9000 -Dsonar.login=sqp_xxxxxxxx
```

看到 `BUILD SUCCESS` + `Analysis report uploaded` 即成功。

> **注意**：如果项目 B 依赖项目 A 的模块（如 rest_oms 依赖 rest_common），需先用 JDK8 对 A 执行 `clean install -DskipTests` 装入本地仓库，再编译 B。

---

## 六、uni-app 小程序 / Vue 项目扫描

用 sonar-scanner 直接扫，需要**排除依赖目录**并**声明 .vue 后缀**：

```powershell
sonar-scanner.bat `
  -D"sonar.projectKey=sass_wxchart" `
  -D"sonar.projectName=sass_wxchart" `
  -D"sonar.sources=." `
  -D"sonar.sourceEncoding=UTF-8" `
  -D"sonar.host.url=http://localhost:9000" `
  -D"sonar.login=sqp_xxxxxxxx" `
  -D"sonar.javascript.file.suffixes=.js,.ts,.vue" `
  -D"sonar.exclusions=node_modules/**,unpackage/**,**/unpackage/dist/**,static/**,**/*.min.js,**/vendor/**,uni_modules/**"
```

关键点：

- 必须排除 `node_modules`、`unpackage`、`uni_modules`，否则扫描几千个第三方文件且报"文件语言无法判定"
- 必须加 `sonar.javascript.file.suffixes=.js,.ts,.vue`，否则 .vue 不被识别

---

## 七、常见坑

### 7.1 用 `sonar:sonar` 简写报错

`mvn sonar:sonar` 会解析到 `org.codehaus.mojo` 而失败。必须用完整坐标：

```
org.sonarsource.scanner.maven:sonar-maven-plugin:3.9.1.2184:sonar
```

### 7.2 PowerShell 里换行破坏参数

PowerShell 反引号 `\`` 续行会破坏 `-Dsonar...` 参数。建议把命令写成 `.ps1` 脚本文件执行。

### 7.3 Token 权限

- 项目级 Token 只能分析该项目，**不能**查 API（调 measure 接口会 403）
- 生成的 Token 属于哪个项目，就只能扫哪个项目

### 7.4 WSL 服务用局域网 IP 访问不到

SonarQube 跑在 WSL2（NAT）里，Windows 只把 **localhost** 转发到 WSL，本机局域网 IP（如 10.154.1.42）默认**不通**。

验证：

```
curl http://10.154.1.42:9000   # 000 不通
curl http://localhost:9000     # 200 通
```

解决（管理员 PowerShell + 防火墙放行 9000）：

```powershell
netsh interface portproxy add v4tov4 listenport=9000 listenaddress=0.0.0.0 connectport=9000 connectaddress=192.168.234.135
```

---

## 八、GitLab CI 集成（Docker executor）

在项目根目录新建 `.gitlab-ci.yml`，两步：JDK8 镜像编译 → JDK17 镜像分析：

```yaml
stages:
  - build
  - sonar

variables:
  SONAR_HOST_URL: "http://10.154.1.42:9000"
  SONAR_PLUGIN: "org.sonarsource.scanner.maven:sonar-maven-plugin:3.9.1.2184:sonar"

build_job:
  image: maven:3.6.3-jdk-8
  stage: build
  script:
    - mvn clean compile -DskipTests
  artifacts:
    paths:
      - "**/target/classes"
      - "**/target/generated-sources"
    expire_in: 1 day

sonar_job:
  image: maven:3.8.4-openjdk-17
  stage: sonar
  needs: [build_job]
  script:
    - mvn ${SONAR_PLUGIN} -Dsonar.projectKey=rest_oms -Dsonar.projectName=rest_oms -Dsonar.host.url=${SONAR_HOST_URL} -Dsonar.login=${SONAR_TOKEN}
  when: manual
```

注意：

- `SONAR_TOKEN` 在 GitLab 项目 **Settings → CI/CD → Variables** 中配置，**不要明文提交**到仓库
- 多模块项目若依赖其他项目模块，先 clone 依赖项目 `clean install`，再编译本项目

---

# 最终效果

| 项目 | 状态 |
|------|------|
| WSL Docker 安装 | ✔ 正常 |
| SonarQube 9.9 LTS | ✔ 运行中 |
| 中文语言包 | ✔ 已安装 |
| Java 项目扫描 | ✔ 成功 |
| Vue / 小程序项目扫描 | ✔ 成功 |
| 局域网 IP 访问 | ✔ 已放行 |
| GitLab CI 集成 | ✔ 已配置 |