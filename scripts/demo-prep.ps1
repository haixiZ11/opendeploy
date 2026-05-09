# 演示录制环境准备脚本
# 用法: powershell -ExecutionPolicy Bypass -File scripts/demo-prep.ps1

Write-Host "=== OpenDeploy 演示录制准备 ===" -ForegroundColor Cyan

# 1. 创建演示输出目录
$demoDir = "D:/Project/opendeploy/tmp/demos"
if (-not (Test-Path $demoDir)) {
    New-Item -ItemType Directory -Path $demoDir -Force | Out-Null
    Write-Host "[OK] 创建输出目录: $demoDir"
} else {
    Write-Host "[OK] 输出目录已存在: $demoDir"
}

# 2. 检查 ScreenToGif 是否已装
$stg = Get-Command ScreenToGif -ErrorAction SilentlyContinue
if ($stg) {
    Write-Host "[OK] ScreenToGif 已安装: $($stg.Source)"
} else {
    Write-Host "[!] ScreenToGif 未安装，运行: winget install ScreenToGif" -ForegroundColor Yellow
}

# 3. 开"勿扰模式"避免通知弹窗
$qhPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Notifications\Settings"
if (Test-Path $qhPath) {
    Write-Host "[INFO] 手动操作: 设置 → 系统 → 通知 → 打开'勿扰模式'"
}

# 4. 演示用的 prompt 直接输出，方便复制
Write-Host ""
Write-Host "=== 演示 Prompt（复制粘贴到 OpenDeploy 对话框）===" -ForegroundColor Green
Write-Host @"

在销售订单 SAL_SaleOrder 上建个扩展叫"物流字段演示"，加 3 个 decimal 字段：
- F_OD_UnitWeight（单件重量，KG）
- F_OD_PackQty（包装数量）
- F_OD_TotalWeight（总重量，KG）

加完后再加一条业务规则：当 F_OD_UnitWeight 或 F_OD_PackQty 变化时，
自动计算 F_OD_TotalWeight = F_OD_UnitWeight * F_OD_PackQty。

最后反查确认字段和规则都在。

"@ -ForegroundColor White

# 5. 检查清单
Write-Host "=== 录制前最终检查 ===" -ForegroundColor Cyan
Write-Host "[ ] OpenDeploy 已启动 (pnpm dev) 且 dev K/3 项目已激活（状态栏绿点）"
Write-Host "[ ] DevTools 已关闭（避免侧边栏漏出）"
Write-Host "[ ] dev 账套已无 SAL_SaleOrder 历史扩展（pnpm tsx scripts/list-extensions.ts 检查）"
Write-Host "[ ] K/3 客户端已登录，准备好新建销售订单"
Write-Host "[ ] 桌面壁纸纯色 / 任务栏图标无敏感信息"
Write-Host "[ ] OpenDeploy 窗口拖到 1280x800 左右"
Write-Host ""
Write-Host "录完 GIF 放到: $demoDir/" -ForegroundColor Green
