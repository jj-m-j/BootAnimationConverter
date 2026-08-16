# 开机动画适配

把带 trim.txt 的开机动画上传进来，自动还原成 ColorOS 能用的版本。

纯前端网页工具，所有处理都在浏览器本地完成，文件不会上传到任何服务器。

## 功能

- 还原 trim.txt 裁剪帧，输出全尺寸画面
- desc.txt 自动转换
- 自定义画面尺寸、背景色（自动检测 / HSV 取色器 / 手动输入）
- 透明像素填充背景色，防止花屏
- 按 desc 顺序整段预览，也可以单独看某个 part

## 使用方法

1. 打开 [开机动画适配](https://jj-m-j.github.io/trimforge/)
2. 把 bootanimation.zip 上传进去
3. 按需调整参数，点「开始处理」
4. 预览确认后点「下载新包」
5. 将下载的 bootanimation.zip 替换到你的模块中刷入

> 注意：上传的是开机动画素材，不是模块。
> 

## 致谢

- 界面设计参考 [Miuix](https://github.com/compose-miuix-ui/miuix)
- 字体 MiSans © Xiaomi
- 本项目由 DeepSeek v4 flash 开发
