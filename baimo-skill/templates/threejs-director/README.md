# Three.js 白模导演台模板

固定Three.js r180（MIT，许可证在vendor），本地模块无需CDN、npm或构建步骤。Python只用于本机静态服务，无Python依赖包。

先复制此目录到项目，运行`python serve.py --port 8765`，浏览器打开`http://127.0.0.1:8765`。不能用file://直接打开模块。初始工程为空场景，不自动加人或镜头。主入口index.html，默认读取project.json，也可在界面载入其他JSON。

左侧编辑物体，中央全局观察与拍摄预览，右侧拍摄机与镜头管理。位置单位米，旋转度，Y向上；人物本地+Z为正面。对象变换是当前工作副本，点击保存镜头才写入该镜头快照；保存JSON文件才是跨会话持久保存。浏览器草稿不等于磁盘工程。

场景模式不加人物或镜头；切分镜模式后才开放。观察机位和拍摄机位完全分离。拍摄相机操作需显式开启右下预览拖拽控制，或通过数值输入/复制观察视角；默认预览不接受相机拖动。人物支持站/坐/蹲与简化四肢角度，非专业人体绑定。groupId只是关系元数据，不自动建立几何父子组。

当前PNG导出工作画面；批量导出保存的镜头快照。编辑辅助不进PNG。批量可能受浏览器下载策略限制，不自动声称全部保存。图像参考只本地显示，不上传、不嵌入JSON。

Agent自动化接口（页面就绪后）：

```js
window.directorAPI.getProject();
window.directorAPI.loadProject(projectObject); // validate后载入，拒绝错误输入
window.directorAPI.switchShot(shotId); // 自动化用，无人工切换确认
window.directorAPI.getActiveShot();
window.directorAPI.saveShot();
window.directorAPI.renderPNG(1280); // PNG data URL，不下载、不改变保存机位
```

这些是本页面API，不是额外MCP工具。直接载入会替换工作副本，自动化先导出保存用户修改。图片生成后需实际查看，不靠API返回成功证明构图正确。
