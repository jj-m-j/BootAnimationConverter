将包含 `trim.txt` 的 Android 开机动画转换为 **ColorOS 可用的格式**。

这是一个纯前端工具，所有文件处理均在浏览器本地完成，**不会上传到任何服务器**。

## 功能

- 还原 `trim.txt` 裁剪信息，将裁剪帧恢复为完整画面
- 自动转换 `desc.txt`
- 自定义输出画面尺寸
- 自定义背景色
    - 自动检测
    - HSV 取色器
    - 手动输入颜色
- 按 `desc.txt` 顺序预览完整开机动画
- 支持单独预览各个 `part`
- 全部处理在浏览器本地完成

## 使用方法

1. 打开 开机动画适配
2. 上传包含 `trim.txt` 的 `bootanimation.zip`
3. 根据需要调整画面尺寸、背景色等参数
4. 点击「开始处理」
5. 处理完成后预览开机动画
6. 确认无误后点击「下载新包」
7. 将生成的 `bootanimation.zip` 替换到对应的模块中使用

> **注意：** 上传的是开机动画 `bootanimation.zip`，不是 Magisk / KernelSU 等模块 ZIP。
> 

## 隐私说明

本项目采用纯前端处理方式。

你选择的开机动画文件不会被上传到服务器，也不会发送到第三方服务。文件的读取、转换、预览和打包均在当前浏览器环境中完成。

## 开源许可证

本项目采用[MIT License](https://github.com/jj-m-j/trimforge/blob/main/LICENSE)许可证。

## 致谢

- 界面设计参考 Miuix
- 字体使用 **MiSans © Xiaomi**
- 项目开发过程中使用 **DeepSeek v4 Flash** 辅助开发

---
