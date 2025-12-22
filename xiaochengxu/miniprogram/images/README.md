# TabBar 图标说明

## 图标生成

运行以下命令生成 iOS 风格的 TabBar 图标：

```bash
cd xiaochengxu/miniprogram/scripts
node create-tabbar-icons.js
```

这将在 `images` 目录下生成以下 PNG 文件（81x81 像素）：

- `home.png` - 首页图标（未选中，灰色 #8E8E93）
- `home-active.png` - 首页图标（选中，蓝色 #007AFF）
- `publish.png` - 发布图标（未选中）
- `publish-active.png` - 发布图标（选中）
- `profile.png` - 我的图标（未选中）
- `profile-active.png` - 我的图标（选中）

## 图标设计规范

- 尺寸：81 x 81 像素
- 格式：PNG（透明背景）
- 风格：iOS 简洁线条风格
- 未选中颜色：#8E8E93（iOS 系统灰色）
- 选中颜色：#007AFF（iOS 系统蓝色）

## 手动获取图标

如果脚本无法运行，可以从以下网站获取免费图标：

1. **SF Symbols**（推荐）
   - 官方 iOS 图标库
   - https://developer.apple.com/sf-symbols/

2. **IconPark**
   - 字节跳动开源图标库
   - https://iconpark.oceanengine.com/

3. **Lucide**
   - 简洁线条风格图标
   - https://lucide.dev/

4. **Iconfont**
   - 阿里巴巴图标库
   - https://www.iconfont.cn/

下载后重命名为上述文件名，确保尺寸为 81x81 像素。

## 图标样式参考

- **首页**：房子/主页图标（house）
- **发布**：圆圈加号图标（plus.circle）
- **我的**：用户头像图标（person）
