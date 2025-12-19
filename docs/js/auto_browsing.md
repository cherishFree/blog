

# 油猴脚本实现自动循环浏览帖子

在日常浏览论坛时，我们常常需要逐个点击帖子、滚动阅读、关闭页面，再返回首页继续浏览。这种重复操作非常耗时。本文分享一个基于 **Tampermonkey** 的油猴脚本，用于在论坛上实现自动循环浏览帖子。

---

## ✨ 功能需求

- **获取帖子列表**：在首页抓取所有帖子链接  
- **打开第一个帖子**：自动进入第一个未读帖子  
- **自动滚动阅读**：每 0.5 秒滚动 300px，直到页面底部  
- **动态加载检测**：如果页面高度发生变化，继续滚动；否则判定帖子已加载完成  
- **等待与跳转**：滚动完成后等待 3 秒，标记已读并打开下一个帖子  
- **循环执行**：所有帖子看完后返回首页，加载更多帖子，再继续浏览  
- **悬浮按钮控制**：提供开始/停止按钮，用户可随时控制脚本运行  

---

## 🛠️ 核心代码


```
// ==UserScript==
// @name         Linux.do 和 idcflare 自动循环浏览帖子（带控制按钮）
// @namespace    http://tampermonkey.net/
// @version      5.0
// @description  循环获取帖子列表并逐个浏览，支持开始/停止按钮
// @match        https://linux.do/*
// @match        https://idcflare.com/*
// @grant        GM_openInTab
// ==/UserScript==

(function() {
    'use strict';

    let isRunning = true; // 控制开关

    // -------------------------------
    // 工具函数
    // -------------------------------
    function getPostLinks() {
        let links = [];
        document.querySelectorAll('a.title').forEach(a => {
            links.push(a.href);
        });
        return links;
    }

    async function autoLoadMore(times = 3) {
        for (let i = 0; i < times; i++) {
            window.scrollTo(0, document.body.scrollHeight);
            await new Promise(r => setTimeout(r, 3000));
        }
    }

    function markAsRead(url) {
        let readPosts = JSON.parse(localStorage.getItem("readPosts") || "[]");
        if (!readPosts.includes(url)) {
            readPosts.push(url);
            localStorage.setItem("readPosts", JSON.stringify(readPosts));
        }
    }

    function getNextUnread(posts) {
        let readPosts = JSON.parse(localStorage.getItem("readPosts") || "[]");
        return posts.find(p => !readPosts.includes(p));
    }

    // -------------------------------
    // 帖子页面：自动滚动并跳转下一个
    // -------------------------------
    function autoScrollAndNext(nextUrl) {
        let lastHeight = document.body.scrollHeight;

        let scrollInterval = setInterval(() => {
            if (!isRunning) {
                clearInterval(scrollInterval);
                return;
            }

            window.scrollBy(0, 300);

            if ((window.innerHeight + window.scrollY) >= document.body.scrollHeight) {
                clearInterval(scrollInterval);

                setTimeout(() => {
                    let newHeight = document.body.scrollHeight;

                    if (newHeight > lastHeight) {
                        lastHeight = newHeight;
                        autoScrollAndNext(nextUrl);
                    } else {
                        markAsRead(location.href);
                        if (nextUrl && isRunning) {
                            GM_openInTab(nextUrl, { active: true });
                            window.close();
                        } else {
                            window.location.href = location.origin + "/latest";
                        }
                    }
                }, 3000);
            }
        }, 500);
    }

    // -------------------------------
    // 首页逻辑：获取帖子列表并打开第一个未读
    // -------------------------------
    async function startBrowsing() {
        if (location.pathname === "/" || location.pathname.startsWith("/latest")) {
            await autoLoadMore(5);
            let posts = getPostLinks();
            localStorage.setItem("postList", JSON.stringify(posts));
            let nextUrl = getNextUnread(posts);
            if (nextUrl) {
                GM_openInTab(nextUrl, { active: true });
            }
        } else if (location.pathname.startsWith("/t/")) {
            let posts = JSON.parse(localStorage.getItem("postList") || "[]");
            let currentUrl = location.href;
            let currentIndex = posts.indexOf(currentUrl);
            let nextUrl = (currentIndex >= 0 && currentIndex < posts.length - 1) ? getNextUnread(posts.slice(currentIndex + 1)) : null;
            autoScrollAndNext(nextUrl);
        }
    }

    // -------------------------------
    // 添加悬浮按钮
    // -------------------------------
    function addControlButton() {
        let btn = document.createElement("button");
        btn.innerText = "停止浏览";
        btn.style.position = "fixed";
        btn.style.bottom = "20px";
        btn.style.right = "20px";
        btn.style.zIndex = 9999;
        btn.style.padding = "10px 20px";
        btn.style.background = "#007bff";
        btn.style.color = "#fff";
        btn.style.border = "none";
        btn.style.borderRadius = "5px";
        btn.style.cursor = "pointer";
        btn.style.boxShadow = "0 2px 6px rgba(0,0,0,0.3)";

        btn.onclick = () => {
            isRunning = !isRunning;
            if (isRunning) {
                btn.innerText = "停止浏览";
                startBrowsing();
            } else {
                btn.innerText = "开始浏览";
            }
        };

        document.body.appendChild(btn);
    }

    addControlButton();
    startBrowsing();

})();
```

---

## 🎛️ 悬浮按钮控制

为了方便用户操作，脚本在页面右下角添加了一个悬浮按钮：

- 点击 **开始浏览** → 脚本启动，自动执行循环逻辑  
- 点击 **停止浏览** → 脚本立即停止滚动和跳转  

按钮样式简洁，支持随时切换状态。

---

## 🔄 工作流程

1. 首页加载 → 自动滚动触发更多帖子 → 保存帖子列表  
2. 打开第一个未读帖子 → 自动滚动阅读 → 检测是否加载更多内容  
3. 页面高度不再变化 → 标记已读 → 跳转下一个帖子  
4. 所有帖子看完 → 返回首页 → 再次加载 → 循环执行  

---

## 📌 总结

通过这个脚本，我们可以在论坛实现全自动的帖子浏览：

- 自动获取帖子列表  
- 自动滚动阅读  
- 自动标记已读并跳转  
- 支持循环执行与悬浮按钮控制  

这不仅节省了大量时间，也让论坛浏览更加高效。你可以根据需要调整滚动速度、等待时间和加载次数，打造属于自己的个性化浏览体验。


