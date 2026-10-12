# 关于 SEKAI Station 国服

本站主要收集并实时展示 Project SEKAI 国服社交平台上发布的房间招募信息。本站不生产也不会发布任何消息，请谨慎辨别外部信息。

如需反馈或发布招募信息，可加入本站的附属群聊：
- 点击链接加入群聊【SEKAI Station 国服】：https://qm.qq.com/q/uNPJTHD0ty
- 点击链接加入群聊【SEKAI Station 国服 重联编组】：https://qm.qq.com/q/ZJxEk3oAQC

本站部分组件相关源代码遵循 MIT 协议开源于 https://github.com/orgs/sekai-station

本站后端基建由 [Team Haruki](https://haruki.seiunx.com/) 提供。

## 使用 HarukiBot 上报车牌

本站支持通过 HarukiBot 自建车牌搭建服务，关于如何搭建 HarukiBot 请参考[该教程](https://neo.haruki.seiunx.com/haruki-client/)。

在完成 HarukiBot 部署后，你需要修改 `configs.yaml` 里的 `botAdmins` 并添加你的 QQ 号，同时需要在 `cn_collect_configs.yaml` 里配置以下内容（直接复制替换即可）

```yaml
enableRoomCollect: true
endpoint: https://cn-sekai-station.haruki.seiunx.com/station/api
toolboxBaseURL: https://toolbox-api-direct.haruki.seiunx.com
deviceLabel: ''
groupWhitelist: []
```

其中，`enableRoomCollect` 设置为 true 即代表开放国服车牌抓取功能。修改完配置保持启动，你会在终端中看到如下类似的消息

```
[INFO][runtime] app runtime started
[INFO][main] runtime startup completed
[INFO][main] control api route mounted on onebot websocket server at http://0.0.0.0:8111/haruki_client/controller
[INFO][main] onebot websocket server starting on ws://0.0.0.0:8111/ws
[WARNING][toolbox] ======== Toolbox 设备授权（车牌收集）========
[WARNING][toolbox] 请在浏览器打开 https://haruki.seiunx.com/device 并输入代码 ABCD-0123（10 分钟内有效）
[WARNING][toolbox] 也可以直接打开 https://haruki.seiunx.com/device?user_code=ABCD-0123
[WARNING][toolbox] 只有你本人刚刚启动本程序时才批准；不要把代码发给任何人。
```

点击其中形如 `https://haruki.seiunx.com/device?user_code=ABCD-0123` 的链接（或复制后在浏览器中打开）并在跳转的网页里完成权限授予，即可正式完成配置工作。

注意，车牌采集为**白名单**，也就是只有在白名单以内的群聊才会自动监听并上报车牌。这需要你，或者 `botAdmins` 里的人，在需要开启国服捡车牌的群里输入 `/haruki collect add` 将当前群加入采集白名单才行。更多管理命令如下：

| 命令 | 作用 | 别名 |
|---|---|---|
| `/haruki collect add` | 将当前群加入采集白名单 | `/haruki collect set`、`/hccollect add` |
| `/haruki collect remove` | 将当前群移出采集白名单 | `/haruki collect unset`、`/haruki collect rm`、`/hccollect del` |
| `/haruki collect enable` | 开启整个 Client 的国服采集开关 | `/hccollect on` |
| `/haruki collect disable` | 关闭整个 Client 的国服采集开关 | `/hccollect off` |
| `/haruki help collect` | 查看采集命令帮助 | — |

当然，你也可以直接手动在 `cn_collect_configs.yaml` 里配置 `groupWhitelist` ，效果是等价的。手动修改配置文件后需要重启才能生效。