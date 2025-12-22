/**
 * TabBar 图标生成脚本
 * 
 * 此脚本会在 images 目录下创建简单的 PNG 图标文件
 * 使用纯 Node.js 生成 PNG (无需额外依赖)
 * 
 * 运行方式: node create-tabbar-icons.js
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const IMAGES_DIR = path.join(__dirname, '..', 'images');

// PNG 文件头
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

// 创建 PNG chunk
function createChunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  
  const crcData = Buffer.concat([typeBuffer, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcData));
  
  return Buffer.concat([length, typeBuffer, data, crc]);
}

// CRC32 计算
function crc32(buffer) {
  let crc = 0xFFFFFFFF;
  const table = [];
  
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  
  for (let i = 0; i < buffer.length; i++) {
    crc = table[(crc ^ buffer[i]) & 0xFF] ^ (crc >>> 8);
  }
  
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// 创建 IHDR chunk
function createIHDR(width, height) {
  const data = Buffer.alloc(13);
  data.writeUInt32BE(width, 0);
  data.writeUInt32BE(height, 4);
  data[8] = 8;  // bit depth
  data[9] = 6;  // color type (RGBA)
  data[10] = 0; // compression
  data[11] = 0; // filter
  data[12] = 0; // interlace
  return createChunk('IHDR', data);
}

// 创建 IDAT chunk
function createIDAT(imageData, width, height) {
  // 添加 filter byte (0) 到每行开头
  const rawData = [];
  for (let y = 0; y < height; y++) {
    rawData.push(0); // filter type: None
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      rawData.push(imageData[idx]);     // R
      rawData.push(imageData[idx + 1]); // G
      rawData.push(imageData[idx + 2]); // B
      rawData.push(imageData[idx + 3]); // A
    }
  }
  
  const compressed = zlib.deflateSync(Buffer.from(rawData));
  return createChunk('IDAT', compressed);
}

// 创建 IEND chunk
function createIEND() {
  return createChunk('IEND', Buffer.alloc(0));
}

// 创建 PNG 文件
function createPNG(width, height, imageData) {
  return Buffer.concat([
    PNG_SIGNATURE,
    createIHDR(width, height),
    createIDAT(imageData, width, height),
    createIEND()
  ]);
}

// 绘制圆形
function drawCircle(imageData, width, cx, cy, r, color, filled = false, lineWidth = 2) {
  for (let y = 0; y < width; y++) {
    for (let x = 0; x < width; x++) {
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (filled) {
        if (dist <= r) {
          setPixel(imageData, width, x, y, color);
        }
      } else {
        if (Math.abs(dist - r) <= lineWidth / 2) {
          setPixel(imageData, width, x, y, color);
        }
      }
    }
  }
}

// 绘制线条
function drawLine(imageData, width, x1, y1, x2, y2, color, lineWidth = 2) {
  const dx = Math.abs(x2 - x1);
  const dy = Math.abs(y2 - y1);
  const steps = Math.max(dx, dy) * 2;
  
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = Math.round(x1 + (x2 - x1) * t);
    const y = Math.round(y1 + (y2 - y1) * t);
    
    for (let ox = -lineWidth/2; ox <= lineWidth/2; ox++) {
      for (let oy = -lineWidth/2; oy <= lineWidth/2; oy++) {
        if (ox*ox + oy*oy <= (lineWidth/2) ** 2) {
          setPixel(imageData, width, Math.round(x + ox), Math.round(y + oy), color);
        }
      }
    }
  }
}

// 绘制矩形
function drawRect(imageData, width, x, y, w, h, color, filled = false, lineWidth = 2, radius = 0) {
  if (filled) {
    for (let py = y; py < y + h; py++) {
      for (let px = x; px < x + w; px++) {
        // 简单的圆角处理
        let draw = true;
        if (radius > 0) {
          // 检查四个角
          const corners = [
            [x + radius, y + radius],
            [x + w - radius, y + radius],
            [x + radius, y + h - radius],
            [x + w - radius, y + h - radius]
          ];
          for (const [cx, cy] of corners) {
            const inCornerRegion = (
              (px < x + radius && py < y + radius) ||
              (px >= x + w - radius && py < y + radius) ||
              (px < x + radius && py >= y + h - radius) ||
              (px >= x + w - radius && py >= y + h - radius)
            );
            if (inCornerRegion) {
              const dist = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
              if (dist > radius) draw = false;
            }
          }
        }
        if (draw) setPixel(imageData, width, px, py, color);
      }
    }
  } else {
    // 边框
    drawLine(imageData, width, x, y, x + w, y, color, lineWidth);
    drawLine(imageData, width, x + w, y, x + w, y + h, color, lineWidth);
    drawLine(imageData, width, x + w, y + h, x, y + h, color, lineWidth);
    drawLine(imageData, width, x, y + h, x, y, color, lineWidth);
  }
}

// 设置像素
function setPixel(imageData, width, x, y, color) {
  x = Math.round(x);
  y = Math.round(y);
  if (x < 0 || x >= width || y < 0 || y >= width) return;
  const idx = (y * width + x) * 4;
  imageData[idx] = color[0];
  imageData[idx + 1] = color[1];
  imageData[idx + 2] = color[2];
  imageData[idx + 3] = color[3];
}

// 创建图标
function createIcon(size, drawFn, color) {
  const imageData = new Uint8Array(size * size * 4);
  // 透明背景
  for (let i = 0; i < imageData.length; i += 4) {
    imageData[i] = 0;
    imageData[i + 1] = 0;
    imageData[i + 2] = 0;
    imageData[i + 3] = 0;
  }
  
  drawFn(imageData, size, color);
  return createPNG(size, size, imageData);
}

// 首页图标绘制函数
function drawHomeIcon(imageData, size, color) {
  const cx = size / 2;
  const lineWidth = 3;
  
  // 屋顶 (三角形)
  const roofTop = size * 0.18;
  const roofBottom = size * 0.45;
  const roofWidth = size * 0.42;
  
  // 绘制屋顶线条
  drawLine(imageData, size, cx, roofTop, cx - roofWidth, roofBottom, color, lineWidth);
  drawLine(imageData, size, cx, roofTop, cx + roofWidth, roofBottom, color, lineWidth);
  
  // 房子主体
  const houseTop = roofBottom - 5;
  const houseBottom = size * 0.82;
  const houseLeft = cx - size * 0.32;
  const houseRight = cx + size * 0.32;
  
  drawLine(imageData, size, houseLeft, houseTop, houseLeft, houseBottom, color, lineWidth);
  drawLine(imageData, size, houseRight, houseTop, houseRight, houseBottom, color, lineWidth);
  drawLine(imageData, size, houseLeft, houseBottom, houseRight, houseBottom, color, lineWidth);
  
  // 门
  const doorWidth = size * 0.18;
  const doorHeight = size * 0.25;
  const doorLeft = cx - doorWidth / 2;
  const doorTop = houseBottom - doorHeight;
  drawRect(imageData, size, doorLeft, doorTop, doorWidth, doorHeight, color, true, 0, 3);
}

// 发布图标绘制函数
function drawPublishIcon(imageData, size, color) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.35;
  const lineWidth = 3;
  
  // 圆圈
  drawCircle(imageData, size, cx, cy, radius, color, false, lineWidth);
  
  // 加号
  const plusSize = size * 0.22;
  drawLine(imageData, size, cx - plusSize, cy, cx + plusSize, cy, color, lineWidth);
  drawLine(imageData, size, cx, cy - plusSize, cx, cy + plusSize, color, lineWidth);
}

// 我的图标绘制函数
function drawProfileIcon(imageData, size, color) {
  const cx = size / 2;
  
  // 头部
  const headRadius = size * 0.17;
  const headY = size * 0.32;
  drawCircle(imageData, size, cx, headY, headRadius, color, true);
  
  // 身体 (半圆)
  const bodyY = size * 0.58;
  const bodyRadius = size * 0.32;
  for (let y = bodyY; y < size * 0.85; y++) {
    for (let x = 0; x < size; x++) {
      const dist = Math.sqrt((x - cx) ** 2 + (y - bodyY) ** 2);
      if (dist <= bodyRadius && y >= bodyY) {
        setPixel(imageData, size, x, y, color);
      }
    }
  }
}

// 颜色定义
const COLORS = {
  inactive: [142, 142, 147, 255],  // #8E8E93
  active: [0, 122, 255, 255]       // #007AFF
};

// 主函数
function main() {
  const SIZE = 81;
  
  console.log('开始生成 TabBar 图标...\n');
  
  // 确保目录存在
  if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
  }
  
  const icons = [
    { name: 'home', draw: drawHomeIcon },
    { name: 'publish', draw: drawPublishIcon },
    { name: 'profile', draw: drawProfileIcon }
  ];
  
  icons.forEach(({ name, draw }) => {
    // 未选中状态
    const inactivePng = createIcon(SIZE, draw, COLORS.inactive);
    fs.writeFileSync(path.join(IMAGES_DIR, `${name}.png`), inactivePng);
    console.log(`✓ ${name}.png`);
    
    // 选中状态
    const activePng = createIcon(SIZE, draw, COLORS.active);
    fs.writeFileSync(path.join(IMAGES_DIR, `${name}-active.png`), activePng);
    console.log(`✓ ${name}-active.png`);
  });
  
  console.log('\n✅ 所有图标生成完成！');
  console.log(`图标位置: ${IMAGES_DIR}`);
}

main();
