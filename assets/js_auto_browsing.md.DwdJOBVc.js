import{_ as s,c as a,o as p,ah as l}from"./chunks/framework.DYJPYqf_.js";const g=JSON.parse('{"title":"油猴脚本实现自动循环浏览帖子","description":"","frontmatter":{},"headers":[],"relativePath":"js/auto_browsing.md","filePath":"js/auto_browsing.md","lastUpdated":1766115459000}'),e={name:"js/auto_browsing.md"};function t(i,n,o,c,r,u){return p(),a("div",null,[...n[0]||(n[0]=[l(`<h1 id="油猴脚本实现自动循环浏览帖子" tabindex="-1">油猴脚本实现自动循环浏览帖子 <a class="header-anchor" href="#油猴脚本实现自动循环浏览帖子" aria-label="Permalink to “油猴脚本实现自动循环浏览帖子”">​</a></h1><p>在日常浏览论坛时，我们常常需要逐个点击帖子、滚动阅读、关闭页面，再返回首页继续浏览。这种重复操作非常耗时。本文分享一个基于 <strong>Tampermonkey</strong> 的油猴脚本，用于在论坛上实现自动循环浏览帖子。</p><hr><h2 id="✨-功能需求" tabindex="-1">✨ 功能需求 <a class="header-anchor" href="#✨-功能需求" aria-label="Permalink to “✨ 功能需求”">​</a></h2><ul><li><strong>获取帖子列表</strong>：在首页抓取所有帖子链接</li><li><strong>打开第一个帖子</strong>：自动进入第一个未读帖子</li><li><strong>自动滚动阅读</strong>：每 0.5 秒滚动 300px，直到页面底部</li><li><strong>动态加载检测</strong>：如果页面高度发生变化，继续滚动；否则判定帖子已加载完成</li><li><strong>等待与跳转</strong>：滚动完成后等待 3 秒，标记已读并打开下一个帖子</li><li><strong>循环执行</strong>：所有帖子看完后返回首页，加载更多帖子，再继续浏览</li><li><strong>悬浮按钮控制</strong>：提供开始/停止按钮，用户可随时控制脚本运行</li></ul><hr><h2 id="🛠️-核心代码" tabindex="-1">🛠️ 核心代码 <a class="header-anchor" href="#🛠️-核心代码" aria-label="Permalink to “🛠️ 核心代码”">​</a></h2><div class="language-"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark" style="--shiki-light:#24292e;--shiki-dark:#e1e4e8;--shiki-light-bg:#fff;--shiki-dark-bg:#24292e;" tabindex="0" dir="ltr"><code><span class="line"><span>// ==UserScript==</span></span>
<span class="line"><span>// @name         Linux.do 和 idcflare 自动循环浏览帖子（带控制按钮）</span></span>
<span class="line"><span>// @namespace    http://tampermonkey.net/</span></span>
<span class="line"><span>// @version      5.0</span></span>
<span class="line"><span>// @description  循环获取帖子列表并逐个浏览，支持开始/停止按钮</span></span>
<span class="line"><span>// @match        https://linux.do/*</span></span>
<span class="line"><span>// @match        https://idcflare.com/*</span></span>
<span class="line"><span>// @grant        GM_openInTab</span></span>
<span class="line"><span>// ==/UserScript==</span></span>
<span class="line"><span></span></span>
<span class="line"><span>(function() {</span></span>
<span class="line"><span>    &#39;use strict&#39;;</span></span>
<span class="line"><span></span></span>
<span class="line"><span>    let isRunning = true; // 控制开关</span></span>
<span class="line"><span></span></span>
<span class="line"><span>    // -------------------------------</span></span>
<span class="line"><span>    // 工具函数</span></span>
<span class="line"><span>    // -------------------------------</span></span>
<span class="line"><span>    function getPostLinks() {</span></span>
<span class="line"><span>        let links = [];</span></span>
<span class="line"><span>        document.querySelectorAll(&#39;a.title&#39;).forEach(a =&gt; {</span></span>
<span class="line"><span>            links.push(a.href);</span></span>
<span class="line"><span>        });</span></span>
<span class="line"><span>        return links;</span></span>
<span class="line"><span>    }</span></span>
<span class="line"><span></span></span>
<span class="line"><span>    async function autoLoadMore(times = 3) {</span></span>
<span class="line"><span>        for (let i = 0; i &lt; times; i++) {</span></span>
<span class="line"><span>            window.scrollTo(0, document.body.scrollHeight);</span></span>
<span class="line"><span>            await new Promise(r =&gt; setTimeout(r, 3000));</span></span>
<span class="line"><span>        }</span></span>
<span class="line"><span>    }</span></span>
<span class="line"><span></span></span>
<span class="line"><span>    function markAsRead(url) {</span></span>
<span class="line"><span>        let readPosts = JSON.parse(localStorage.getItem(&quot;readPosts&quot;) || &quot;[]&quot;);</span></span>
<span class="line"><span>        if (!readPosts.includes(url)) {</span></span>
<span class="line"><span>            readPosts.push(url);</span></span>
<span class="line"><span>            localStorage.setItem(&quot;readPosts&quot;, JSON.stringify(readPosts));</span></span>
<span class="line"><span>        }</span></span>
<span class="line"><span>    }</span></span>
<span class="line"><span></span></span>
<span class="line"><span>    function getNextUnread(posts) {</span></span>
<span class="line"><span>        let readPosts = JSON.parse(localStorage.getItem(&quot;readPosts&quot;) || &quot;[]&quot;);</span></span>
<span class="line"><span>        return posts.find(p =&gt; !readPosts.includes(p));</span></span>
<span class="line"><span>    }</span></span>
<span class="line"><span></span></span>
<span class="line"><span>    // -------------------------------</span></span>
<span class="line"><span>    // 帖子页面：自动滚动并跳转下一个</span></span>
<span class="line"><span>    // -------------------------------</span></span>
<span class="line"><span>    function autoScrollAndNext(nextUrl) {</span></span>
<span class="line"><span>        let lastHeight = document.body.scrollHeight;</span></span>
<span class="line"><span></span></span>
<span class="line"><span>        let scrollInterval = setInterval(() =&gt; {</span></span>
<span class="line"><span>            if (!isRunning) {</span></span>
<span class="line"><span>                clearInterval(scrollInterval);</span></span>
<span class="line"><span>                return;</span></span>
<span class="line"><span>            }</span></span>
<span class="line"><span></span></span>
<span class="line"><span>            window.scrollBy(0, 300);</span></span>
<span class="line"><span></span></span>
<span class="line"><span>            if ((window.innerHeight + window.scrollY) &gt;= document.body.scrollHeight) {</span></span>
<span class="line"><span>                clearInterval(scrollInterval);</span></span>
<span class="line"><span></span></span>
<span class="line"><span>                setTimeout(() =&gt; {</span></span>
<span class="line"><span>                    let newHeight = document.body.scrollHeight;</span></span>
<span class="line"><span></span></span>
<span class="line"><span>                    if (newHeight &gt; lastHeight) {</span></span>
<span class="line"><span>                        lastHeight = newHeight;</span></span>
<span class="line"><span>                        autoScrollAndNext(nextUrl);</span></span>
<span class="line"><span>                    } else {</span></span>
<span class="line"><span>                        markAsRead(location.href);</span></span>
<span class="line"><span>                        if (nextUrl &amp;&amp; isRunning) {</span></span>
<span class="line"><span>                            GM_openInTab(nextUrl, { active: true });</span></span>
<span class="line"><span>                            window.close();</span></span>
<span class="line"><span>                        } else {</span></span>
<span class="line"><span>                            window.location.href = location.origin + &quot;/latest&quot;;</span></span>
<span class="line"><span>                        }</span></span>
<span class="line"><span>                    }</span></span>
<span class="line"><span>                }, 3000);</span></span>
<span class="line"><span>            }</span></span>
<span class="line"><span>        }, 500);</span></span>
<span class="line"><span>    }</span></span>
<span class="line"><span></span></span>
<span class="line"><span>    // -------------------------------</span></span>
<span class="line"><span>    // 首页逻辑：获取帖子列表并打开第一个未读</span></span>
<span class="line"><span>    // -------------------------------</span></span>
<span class="line"><span>    async function startBrowsing() {</span></span>
<span class="line"><span>        if (location.pathname === &quot;/&quot; || location.pathname.startsWith(&quot;/latest&quot;)) {</span></span>
<span class="line"><span>            await autoLoadMore(5);</span></span>
<span class="line"><span>            let posts = getPostLinks();</span></span>
<span class="line"><span>            localStorage.setItem(&quot;postList&quot;, JSON.stringify(posts));</span></span>
<span class="line"><span>            let nextUrl = getNextUnread(posts);</span></span>
<span class="line"><span>            if (nextUrl) {</span></span>
<span class="line"><span>                GM_openInTab(nextUrl, { active: true });</span></span>
<span class="line"><span>            }</span></span>
<span class="line"><span>        } else if (location.pathname.startsWith(&quot;/t/&quot;)) {</span></span>
<span class="line"><span>            let posts = JSON.parse(localStorage.getItem(&quot;postList&quot;) || &quot;[]&quot;);</span></span>
<span class="line"><span>            let currentUrl = location.href;</span></span>
<span class="line"><span>            let currentIndex = posts.indexOf(currentUrl);</span></span>
<span class="line"><span>            let nextUrl = (currentIndex &gt;= 0 &amp;&amp; currentIndex &lt; posts.length - 1) ? getNextUnread(posts.slice(currentIndex + 1)) : null;</span></span>
<span class="line"><span>            autoScrollAndNext(nextUrl);</span></span>
<span class="line"><span>        }</span></span>
<span class="line"><span>    }</span></span>
<span class="line"><span></span></span>
<span class="line"><span>    // -------------------------------</span></span>
<span class="line"><span>    // 添加悬浮按钮</span></span>
<span class="line"><span>    // -------------------------------</span></span>
<span class="line"><span>    function addControlButton() {</span></span>
<span class="line"><span>        let btn = document.createElement(&quot;button&quot;);</span></span>
<span class="line"><span>        btn.innerText = &quot;停止浏览&quot;;</span></span>
<span class="line"><span>        btn.style.position = &quot;fixed&quot;;</span></span>
<span class="line"><span>        btn.style.bottom = &quot;20px&quot;;</span></span>
<span class="line"><span>        btn.style.right = &quot;20px&quot;;</span></span>
<span class="line"><span>        btn.style.zIndex = 9999;</span></span>
<span class="line"><span>        btn.style.padding = &quot;10px 20px&quot;;</span></span>
<span class="line"><span>        btn.style.background = &quot;#007bff&quot;;</span></span>
<span class="line"><span>        btn.style.color = &quot;#fff&quot;;</span></span>
<span class="line"><span>        btn.style.border = &quot;none&quot;;</span></span>
<span class="line"><span>        btn.style.borderRadius = &quot;5px&quot;;</span></span>
<span class="line"><span>        btn.style.cursor = &quot;pointer&quot;;</span></span>
<span class="line"><span>        btn.style.boxShadow = &quot;0 2px 6px rgba(0,0,0,0.3)&quot;;</span></span>
<span class="line"><span></span></span>
<span class="line"><span>        btn.onclick = () =&gt; {</span></span>
<span class="line"><span>            isRunning = !isRunning;</span></span>
<span class="line"><span>            if (isRunning) {</span></span>
<span class="line"><span>                btn.innerText = &quot;停止浏览&quot;;</span></span>
<span class="line"><span>                startBrowsing();</span></span>
<span class="line"><span>            } else {</span></span>
<span class="line"><span>                btn.innerText = &quot;开始浏览&quot;;</span></span>
<span class="line"><span>            }</span></span>
<span class="line"><span>        };</span></span>
<span class="line"><span></span></span>
<span class="line"><span>        document.body.appendChild(btn);</span></span>
<span class="line"><span>    }</span></span>
<span class="line"><span></span></span>
<span class="line"><span>    addControlButton();</span></span>
<span class="line"><span>    startBrowsing();</span></span>
<span class="line"><span></span></span>
<span class="line"><span>})();</span></span></code></pre></div><hr><h2 id="🎛️-悬浮按钮控制" tabindex="-1">🎛️ 悬浮按钮控制 <a class="header-anchor" href="#🎛️-悬浮按钮控制" aria-label="Permalink to “🎛️ 悬浮按钮控制”">​</a></h2><p>为了方便用户操作，脚本在页面右下角添加了一个悬浮按钮：</p><ul><li>点击 <strong>开始浏览</strong> → 脚本启动，自动执行循环逻辑</li><li>点击 <strong>停止浏览</strong> → 脚本立即停止滚动和跳转</li></ul><p>按钮样式简洁，支持随时切换状态。</p><hr><h2 id="🔄-工作流程" tabindex="-1">🔄 工作流程 <a class="header-anchor" href="#🔄-工作流程" aria-label="Permalink to “🔄 工作流程”">​</a></h2><ol><li>首页加载 → 自动滚动触发更多帖子 → 保存帖子列表</li><li>打开第一个未读帖子 → 自动滚动阅读 → 检测是否加载更多内容</li><li>页面高度不再变化 → 标记已读 → 跳转下一个帖子</li><li>所有帖子看完 → 返回首页 → 再次加载 → 循环执行</li></ol><hr><h2 id="📌-总结" tabindex="-1">📌 总结 <a class="header-anchor" href="#📌-总结" aria-label="Permalink to “📌 总结”">​</a></h2><p>通过这个脚本，我们可以在论坛实现全自动的帖子浏览：</p><ul><li>自动获取帖子列表</li><li>自动滚动阅读</li><li>自动标记已读并跳转</li><li>支持循环执行与悬浮按钮控制</li></ul><p>这不仅节省了大量时间，也让论坛浏览更加高效。你可以根据需要调整滚动速度、等待时间和加载次数，打造属于自己的个性化浏览体验。</p>`,21)])])}const h=s(e,[["render",t]]);export{g as __pageData,h as default};
