import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  base: '/blog/',
  title: "Beria的个人博客",
  description: "一个高级程序员的成长之路",
    // 获取每个文件最后一次 git 提交的 UNIX 时间戳(ms)，同时它将以合适的日期格式显示在每一页的底部
  lastUpdated: true, // string | boolean
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: '首页', link: '/' },
      { text: '博客列表', link: '/java/stream' }
    ],

    sidebar: [
      {
        text: 'Java笔记',
        items: [
          { text: 'Java Stream', link: '/java/stream' },
          { text: 'MyBatis 符号转义', link: '/java/mybatis' }
        ]
      },
      {
        text: 'IDEA小技巧',
        items: [
          { text: '格式化代码片段', link: '/idea/format' },
          { text: '多选处理', link: '/idea/multiple' }
        ]
      },
      {
        text: 'notepad小技巧',
        items: [
          { text: '快速提取 SQL 表名的技巧', link: '/notepad/sql' }          
        ]
      },
      {
        text: 'JavaScript笔记',
        items: [
          { text: 'splice() 与 slice()', link: '/js/splice' }
        ]
      },
       {
        text: 'VS Code小技巧',
        items: [
          { text: '常用快捷键总表', link: '/vscode/keyMap' }
        ]
      }
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/cherishFree/blog' }
    ],
    // 右侧边栏配置，默认值是"In hac pagina"
    outlineTitle: "本页目录",
  
  // 主题配置
    lastUpdatedText: "最后更新", // string
    search: {
      provider: 'local'
    },
    docFooter: {
      prev: '上一篇',
      next: '下一篇'
    }
    
  },
})
