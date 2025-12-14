@echo off
chcp 65001 >nul
title 版本回滚工具

echo ========================================
echo        牛牛基地 - 版本回滚工具
echo ========================================
echo.

cd /d E:\claude15

echo 最近10次提交记录：
echo ----------------------------------------
git log --oneline -10
echo ----------------------------------------
echo.

echo 请选择操作：
echo [1] 回滚到上一个版本（软回滚，推荐）
echo [2] 回滚到指定版本（需要输入commit id）
echo [3] 查看更多历史记录
echo [4] 退出
echo.

set /p choice=请输入选项 (1-4): 

if "%choice%"=="1" (
    echo.
    echo 正在回滚到上一个版本...
    git revert HEAD --no-edit
    if %errorlevel%==0 (
        echo 本地回滚成功，正在推送到远程...
        git push
        echo.
        echo ✅ 回滚完成！请去 EdgeOne 重新部署。
    ) else (
        echo ❌ 回滚失败，可能有冲突需要手动处理。
    )
    pause
    goto :eof
)

if "%choice%"=="2" (
    echo.
    set /p commit_id=请输入要回滚到的 commit id: 
    echo.
    echo ⚠️  警告：这将删除该版本之后的所有提交！
    set /p confirm=确定要继续吗？(y/n): 
    if /i "%confirm%"=="y" (
        git reset --hard %commit_id%
        git push --force
        echo.
        echo ✅ 回滚完成！请去 EdgeOne 重新部署。
    ) else (
        echo 已取消操作。
    )
    pause
    goto :eof
)

if "%choice%"=="3" (
    echo.
    echo 最近30次提交记录：
    echo ----------------------------------------
    git log --oneline -30
    echo ----------------------------------------
    pause
    goto :eof
)

if "%choice%"=="4" (
    exit
)

echo 无效选项，请重新运行。
pause
