# 财务数据清洗工具

一款面向电商从业者（运营、财务、老板）的桌面端数据处理工具，支持对淘宝、京东、抖音、拼多多、天猫、快手等平台订单数据进行清洗、对账和分析。

## 主要功能

### 数据处理
- **导入导出** - 支持 CSV、Excel 多文件导入，自动识别编码（UTF-8/GBK/GB18030）
- **智能合并** - 多文件按列名智能合并，预览确认后执行
- **去重清洗** - 按行/列去重、清空值行、Trim空格、日期格式标准化
- **一键清洗** - 合并 Trim + 清空 + 日期标准化，一键完成常见清洗操作
- **选列** - 自由选择保留的列

### SKU映射
- 导入SKU映射表，将平台商品名称映射为内部编码
- 支持模糊匹配，自动追加映射列

### 收款对账
- 订单金额与收款记录按金额匹配
- 支持容差配置，自动核销

### 账单对账
- **平台账单解析** - 自动解析各平台月末账单，提取佣金、扣点、补贴
- **佣金自动计提** - 根据账单自动生成佣金计提表
- **退款损失还原** - 精确按订单号+平台匹配实际佣金计算退款损失
- **佣金明细匹配** - 支持导入佣金明细文件，实现精确退款损失计算

### 品牌返利
- 按月GMV自动计算阶梯返利
- 支持自定义返利阶梯规则

### 月度汇总
- 跨平台月度数据汇总对比
- 显示GMV、净收款、佣金、扣点、补贴
- 同比/环比数据分析

## 支持平台

| 平台 | 关键词 |
|------|--------|
| 淘宝 | taobao、淘宝 |
| 天猫 | tmall、天猫 |
| 京东 | jd、jingdong、京东 |
| 抖音电商 | douyin、抖音 |
| 快手电商 | kuaishou、快手 |
| 拼多多 | pinduoduo、拼多多 |

## 技术栈

- **框架** - Electron 28 + React 18 + TypeScript
- **构建** - Vite 5 + electron-builder
- **样式** - Tailwind CSS 3
- **数据处理** - xlsx (SheetJS)

## 安装运行

### 从源码运行

```bash
# 克隆项目
git clone https://github.com/heidsoft/finance-data-cleaner.git
cd finance-data-cleaner

# 安装依赖
npm install

# 开发模式运行
npm run dev

# 构建安装包
npm run build
```

### 构建产物

- macOS: `release/mac/财务数据清洗工具.app`
- Windows: `release/win-unpacked/财务数据清洗工具.exe`

## 项目结构

```
├── electron/
│   ├── main.ts        # Electron主进程
│   └── preload.ts     # 预加载脚本
├── src/
│   ├── App.tsx       # 主应用组件
│   ├── main.tsx      # React入口
│   ├── components/    # UI组件
│   └── utils/        # 工具函数
├── public/           # 静态资源
└── docs/            # 文档
```

## 开源协议

本项目基于 [MIT License](LICENSE) 开源。

## 贡献指南

欢迎提交 Issue 和 Pull Request！

## 免责声明

本工具仅供数据处理使用，不存储或上传任何用户数据。所有数据处理均在本地完成。
