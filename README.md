# zflow Atom 插件
> 在Atom中集成trello和evernote的个人操作习惯的插件；

个人习惯：

1. 使用[evernote][1]/[印象笔记][2]存放收集整理的资料;
2. 使用[trello][3] 管理工作任务和安排；

平时操作流程：

1. 在trello中创建任务（card）
2. 使用sublime text 编辑器记录任务相关资料，以markdown的形式
3. 发送资料到印象笔记，使用sublime text的evernote 插件


开发插件的情况：

1. 减少浏览器和编辑器等之间的切换操作，统一在编辑器中解决
2. sublime text编辑器有evernote和trello的插件，不过是相对独立的
3. sublime text编辑器使用python开发，对该语言当前没学习过，可能要花费的时间较长
4. 之前也没开发过atom 插件，也想接触学习一下整个开发过程

功能点：

- [x] 弹出选择列表，逐级选择trello的board list
- [x] 发送到trello，创建card，记录该card的url
- [x] 发送到evernote，创建笔记，记录该笔记的url，将该url记录到card的comment
- [x] 自动完成提示，trello的board、list
- [x] 自动完成提示，evernote的notebook、tag
- [ ] ~~代码功能重构成分可视化和命令行的方式~~
- [x] trello desc 描述分为简要描述，直接在desc字段中输入，如使用@desc，视为复杂描述，则取yaml头之后的“desc:”的内容；（后续支持正则、段选等方式）
- [ ] 文件本机存储记录，git/github提交集成
- [x] GitHub 博客文章生成


可视化方式： 通过弹出选择框等方式逐步选择trello和evernote的方式处理
命令行方式： 通过直接命令，生成模板，在对应字段上输入时，自动提示相应的内容

问题处理：

- [x] 启动Atom自动加载插件启动，配置使用gfm语法后，自动激活
- [ ] ~~输入框未获取焦点，列表选择过渡到输入框突兀~~
- [x] 新建模板后，折叠存在问题
- [x] Evernote url 文本超长，yaml格式化出现 `>-` 考虑去除
- [x] Evernote笔记显示yaml头格式难看，考虑隐藏仅提取链接，重新组装显示
- [x] Evernote笔记显示yaml中的evernote url未设置


## Trello

- ios在印象笔记中通过链接的方式打开，需要使用 url schema 和 x-callback-url

  trello://x-callback-url/showCard?x-source=MyTestApp&id=RCYytboM

- http url链接的方式打开，相对较慢，多一两个操作步骤

## Evernote

- 在trello中，通过http url 的方式，打开较慢
- 使用evernote:///...的 `In-App Note Url` 的方式,trello 无法直接打开，需要通过其他方式（如：拷贝链接，使用workflow 建个快捷打开）

## Github

将修改的文件，添加到git仓库，并且push到Github，需要先记录过Github的用户和密码（非ssh方式）；

原本想通过调用命令，触发git plus的命令，不过不行，git plus注册的命令都是没有参数的，所以没办法传参数；

```
$ git config credential.helper store
$ git push https://github.com/repo.git

Username for 'https://github.com': <USERNAME>
Password for 'https://USERNAME@github.com': <PASSWORD>
```

## git

git的功能实现 参考 [git plus](https://github.com/akonwi/git-plus)

原先使用ssh的方式，url也就是 git@github.com:  不是 https://github.com/ 需要修改一下

[1]: https://evernote.com/ "Evernote"
[2]: https://www.yinxiang.com/ "印象笔记"
[3]: https://trello.com/ "trello"
