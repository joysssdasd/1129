/**
 * TabBar 图标生成脚本
 * 生成 iOS 风格的简洁图标 (81x81 PNG)
 * 
 * 运行方式: node generate-icons.js
 * 需要安装: npm install canvas
 */

const fs = require('fs');
const path = require('path');

// 检查是否有 canvas 模块
let createCanvas;
try {
  createCanvas = require('canvas').createCanvas;
} catch (e) {
  console.log('canvas 模块未安装，将生成 SVG 文件');
  console.log('如需生成 PNG，请运行: npm install canvas');
  generateSVG();
  process.exit(0);
}

const SIZE = 81;
const ICONS_DIR = path.join(__dirname, '..', 'images');

// 颜色配置
const COLORS = {
  inactive: '#8E8E93',  // iOS 灰色
  active: '#007AFF'     // iOS 蓝色
};

// 确保目录存在
if (!fs.existsSync(ICONS_DIR)) {
  fs.mkdirSync(ICONS_DIR, { recursive: true });
}

// 绘制首页图标
function drawHome(ctx, color) {
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  
  // 房子轮廓
  ctx.beginPath();
  ctx.moveTo(40.5, 18);  // 顶点
  ctx.lineTo(68, 40);    // 右上
  ctx.lineTo(68, 68);    // 右下
  ctx.lineTo(13, 68);    // 左下
  ctx.lineTo(13, 40);    // 左上
  ctx.closePath();
  ctx.stroke();
  
  // 屋顶
  ctx.beginPath();
  ctx.moveTo(8, 42);
  ctx.lineTo(40.5, 14);
  ctx.lineTo(73, 42);
  ctx.stroke();
  
  // 门
  ctx.fillRect(33, 48, 15, 20);
}

// 绘制发布图标
function drawPublish(ctx, color) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  
  // 圆圈
  ctx.beginPath();
  ctx.arc(40.5, 40.5, 28, 0, Math.PI * 2);
  ctx.stroke();
  
  // 加号
  ctx.beginPath();
  ctx.moveTo(40.5, 26);
  ctx.lineTo(40.5, 55);
  ctx.stroke();
  
  ctx.beginPath();
  ctx.moveTo(26, 40.5);
  ctx.lineTo(55, 40.5);
  ctx.stroke();
}

// 绘制我的图标
function drawProfile(ctx, color) {
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  
  // 头部
  ctx.beginPath();
  ctx.arc(40.5, 28, 14, 0, Math.PI * 2);
  ctx.fill();
  
  // 身体
  ctx.beginPath();
  ctx.arc(40.5, 80, 28, Math.PI * 1.15, Math.PI * 1.85);
  ctx.fill();
}

// 生成图标
function generateIcon(name, drawFn) {
  ['inactive', 'active'].forEach(state => {
    const canvas = createCanvas(SIZE, SIZE);
    const ctx = canvas.getContext('2d');
    
    // 清除背景（透明）
    ctx.clearRect(0, 0, SIZE, SIZE);
    
    // 绘制图标
    drawFn(ctx, COLORS[state]);
    
    // 保存文件
    const filename = state === 'active' ? `${name}-active.png` : `${name}.png`;
    const filepath = path.join(ICONS_DIR, filename);
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(filepath, buffer);
    console.log(`✓ 生成: ${filename}`);
  });
}

// 生成 SVG 备用方案
function generateSVG() {
  const svgIcons = {
    home: `<svg xmlns="http://www.w3.org/2000/svg" width="81" height="81" viewBox="0 0 81 81" fill="none">
      <path d="M8 42L40.5 14L73 42" stroke="{{COLOR}}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M13 40V68H68V40" stroke="{{COLOR}}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      <rect x="33" y="48" width="15" height="20" fill="{{COLOR}}"/>
    </svg>`,
    publish: `<svg xmlns="http://www.w3.org/2000/svg" width="81" height="81" viewBox="0 0 81 81" fill="none">
      <circle cx="40.5" cy="40.5" r="28" stroke="{{COLOR}}" stroke-width="3"/>
      <line x1="40.5" y1="26" x2="40.5" y2="55" stroke="{{COLOR}}" stroke-width="3" stroke-linecap="round"/>
      <line x1="26" y1="40.5" x2="55" y2="40.5" stroke="{{COLOR}}" stroke-width="3" stroke-linecap="round"/>
    </svg>`,
    profile: `<svg xmlns="http://www.w3.org/2000/svg" width="81" height="81" viewBox="0 0 81 81" fill="none">
      <circle cx="40.5" cy="28" r="14" fill="{{COLOR}}"/>
      <path d="M12.5 80C12.5 64.536 25.036 52 40.5 52C55.964 52 68.5 64.536 68.5 80" fill="{{COLOR}}"/>
    </svg>`
  };
  
  Object.entries(svgIcons).forEach(([name, svg]) => {
    ['inactive', 'active'].forEach(state => {
      const color = COLORS[state];
      const content = svg.replace(/\{\{COLOR\}\}/g, color);
      const filename = state === 'active' ? `${name}-active.svg` : `${name}.svg`;
      const filepath = path.join(ICONS_DIR, filename);
      fs.writeFileSync(filepath, content);
      console.log(`✓ 生成 SVG: ${filename}`);
    });
  });
  
  console.log('\n注意: 微信小程序 tabBar 需要 PNG 格式');
  console.log('请使用在线工具将 SVG 转换为 81x81 的 PNG');
  console.log('推荐: https://cloudconvert.com/svg-to-png');
}

// 主函数
function main() {
  console.log('开始生成 TabBar 图标...\n');
  
  generateIcon('home', drawHome);
  generateIcon('publish', drawPublish);
  generateIcon('profile', drawProfile);
  
  console.log('\n✅ 所有图标生成完成！');
}

main();
