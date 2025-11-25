#!/usr/bin/env node

/**
 * 老王我给你写的本地自动提交脚本！
 * 监控文件变化并自动提交到GitHub
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 配置
const CONFIG = {
  // 监控目录
  watchDir: './trade-platform',
  // 排除的文件和目录
  exclude: [
    'node_modules',
    '.git',
    'dist',
    'build',
    '.env*',
    '*.log',
    '.DS_Store'
  ],
  // 提交间隔（毫秒）
  commitInterval: 30000, // 30秒
  // GitHub token（从环境变量读取）
  githubToken: process.env.GITHUB_TOKEN,
  // 仓库名称
  repo: 'joysssdasd/1129'
};

class AutoCommiter {
  constructor() {
    this.lastCommitTime = 0;
    this.isRunning = false;
    this.fileWatcher = null;
  }

  // 检查是否有GitHub token
  checkGitHubToken() {
    if (!CONFIG.githubToken) {
      console.log('⚠️  未设置GITHUB_TOKEN环境变量');
      console.log('请设置: export GITHUB_TOKEN="your_github_token"');
      return false;
    }
    return true;
  }

  // 执行git命令
  execGitCommand(command) {
    try {
      const result = execSync(command, {
        encoding: 'utf8',
        cwd: CONFIG.watchDir
      });
      return result.trim();
    } catch (error) {
      console.error(`Git命令执行失败: ${command}`, error.message);
      return null;
    }
  }

  // 检查是否有未提交的更改
  hasUncommittedChanges() {
    const status = this.execGitCommand('git status --porcelain');
    return status && status.length > 0;
  }

  // 获取更改的文件列表
  getChangedFiles() {
    const status = this.execGitCommand('git status --porcelain');
    if (!status) return [];

    return status.split('\n')
      .filter(line => line.trim())
      .map(line => {
        const [status, ...filePath] = line.split(' ');
        return {
          status,
          file: filePath.join(' ')
        };
      });
  }

  // 生成智能提交信息
  generateCommitMessage(changedFiles) {
    const now = new Date();
    const timeStr = now.toLocaleString('zh-CN');

    // 分析更改类型
    const hasNewFiles = changedFiles.some(f => f.status === '??');
    const hasModifiedFiles = changedFiles.some(f => f.status.includes('M'));
    const hasDeletedFiles = changedFiles.some(f => f.status.includes('D'));

    let changeType = '';
    if (hasNewFiles && !hasModifiedFiles && !hasDeletedFiles) {
      changeType = '新增';
    } else if (hasDeletedFiles && !hasNewFiles && !hasModifiedFiles) {
      changeType = '删除';
    } else {
      changeType = '更新';
    }

    // 统计文件类型
    const fileTypes = {};
    changedFiles.forEach(file => {
      const ext = path.extname(file.file).toLowerCase() || 'no-ext';
      fileTypes[ext] = (fileTypes[ext] || 0) + 1;
    });

    const fileSummary = Object.entries(fileTypes)
      .map(([ext, count]) => `${ext}(${count})`)
      .join(', ');

    return `🤖 自动提交: ${changeType} ${changedFiles.length}个文件 [${fileSummary}] (${timeStr})

📁 主要变更:
${changedFiles.slice(0, 5).map(f => `- ${f.file} (${f.status})`).join('\n')}

💻 老王帮你自动同步代码到GitHub！`;
  }

  // 执行提交
  async commit() {
    if (this.isRunning) {
      console.log('⏳ 正在执行提交，跳过本次检查');
      return;
    }

    if (!this.hasUncommittedChanges()) {
      console.log('✅ 没有未提交的更改');
      return;
    }

    this.isRunning = true;
    try {
      console.log('🔍 发现文件更改，开始自动提交...');

      // 添加所有更改
      this.execGitCommand('git add .');

      // 获取更改的文件
      const changedFiles = this.getChangedFiles();
      console.log(`📁 发现 ${changedFiles.length} 个更改的文件`);

      // 生成提交信息
      const commitMessage = this.generateCommitMessage(changedFiles);
      console.log('📝 提交信息:', commitMessage.split('\n')[0]);

      // 提交
      this.execGitCommand(`git commit -m "${commitMessage}"`);

      // 推送到GitHub
      console.log('🚀 推送到GitHub...');
      this.execGitCommand(`git push https://${CONFIG.githubToken}@github.com/${CONFIG.repo}.git main`);

      console.log('✅ 自动提交成功！');
      this.lastCommitTime = Date.now();

    } catch (error) {
      console.error('❌ 自动提交失败:', error.message);
    } finally {
      this.isRunning = false;
    }
  }

  // 开始监控
  start() {
    if (!this.checkGitHubToken()) {
      return;
    }

    console.log('🚀 启动自动提交服务...');
    console.log(`📁 监控目录: ${CONFIG.watchDir}`);
    console.log(`⏰ 检查间隔: ${CONFIG.commitInterval / 1000}秒`);
    console.log('按 Ctrl+C 停止服务\n');

    // 立即检查一次
    this.commit();

    // 定时检查
    this.intervalId = setInterval(() => {
      this.commit();
    }, CONFIG.commitInterval);
  }

  // 停止监控
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    console.log('\n⏹️  自动提交服务已停止');
  }
}

// 主程序
if (require.main === module) {
  const autoCommiter = new AutoCommiter();

  // 处理退出信号
  process.on('SIGINT', () => {
    autoCommiter.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    autoCommiter.stop();
    process.exit(0);
  });

  // 启动服务
  autoCommiter.start();
}

module.exports = AutoCommiter;