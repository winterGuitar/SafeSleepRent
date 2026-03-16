# 图片目录说明

这个目录用于存放床位类型的图片文件。

## 文件命名规范

- `bed1.png` - 标准折叠床
- `bed2.png` - 电动折叠床
- `bed3.png` - 加厚折叠床
- `bed4.png` - 多功能护理床
- `bed5.png` - 儿童折叠床
- `bed6.png` - 经济型折叠床

## 如何添加图片

1. 将图片文件放入此目录
2. 在后端管理界面或配置文件中设置图片路径
3. 图片路径可以是：
   - 相对路径：`bed1.png` → `http://localhost:8080/public/images/bed1.png`
   - 绝对路径：`/images/bed1.png` → `http://localhost:8080/images/bed1.png`
   - 完整URL：`https://example.com/image.jpg`（直接使用）

## 默认图片

如果图片不存在或加载失败，前端会显示占位图片。
