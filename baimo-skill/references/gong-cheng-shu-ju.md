# 工程数据约定 v1

模板core.js的validate为运行时字段检查，project.json为空白入口。Agent写完后先validate再载入，用户输入错误时保留当前工程，不部分应用。

顶层schemaVersion=1、mode=scene或storyboard、units=m；name项目名，revision编辑计数，source来源摘要，assumptions必要假设数组。sceneObjects是当前固定场景工作副本；working.actors是当前人物；working.camera为当前拍摄相机。shots每项保存完整sceneObjects/actors/camera，以及id/name/sourceShot/sourceVersion/status/frameType。

对象字段：id稳定字符串，name可读名称，kind为box/cylinder/plane/person，position=[x,y,z]米，rotation=[x,y,z]度，size三项正数，color可选#RRGGBB。盒体/平面坐标为中心；plane是有厚度盒体以便辨认支撑。圆柱size的X为直径、Y高度，Z留作约定但当前几何截面为圆，不支持椭圆柱。需要椭圆/复杂网格时明确扩展代码，不谎称模板已有。

人形position是脚部基准，默认面向本地+Z，size=[横向比例,身高米,纵深比例]，pose=standing/seated/crouching；joints可设置leftArm/rightArm/leftLeg/rightLeg四项角度。人物是组合几何，坐姿与手部接触需实际检查，不是自动人体求解。组合家具可用多个对象和相同groupId作关联；当前程序不支持父子组联动，修改时更新所有相关构件。

camera.position机位、target观察目标点、fov垂直视角5—150度、aspect宽高比。target不是旋转角，不能把角度填到目标点。拍摄预览按aspect留边，不拉伸画面；导出宽度64—4096，高度由aspect计算且不超过8192。默认宽1280、16:9；已有画幅/分辨率要求优先，超出模板能力说明后处理。

scene模式要求没有actors/shots；storyboard模式不强制有角色，空镜合法。每镜frameType=normal或black。status仅为项目编辑状态draft/manual，不冒称用户确认或画面验证。sourceShot/sourceVersion用于映射，不自动改原分镜。

镜头切换恢复其全部快照，包括几何结构；可移动道具当前也存sceneObjects，通过不同镜头快照表达不同状态。共享结构变化不会自动同步历史镜头，这是防止覆盖已确认构图的设计；Agent按授权范围显式更新受影响快照，记录待复查项。不同镜头可引用同一源对象id；每个快照内部id不可重复。

JSON只存数据，不存执行代码、不上传本地图片、也不自动把图片转成几何。参考图原件存项目assets；工程不保存图片绝对路径或密钥。大场景优先简化分组，当前校验限制累计对象数10000，含镜头快照；超限说明，不静默删物件。
