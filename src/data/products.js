export const categories = [
  { id: 'all', name: '全部好物', icon: 'grid' },
  { id: 'paper', name: '纸本手帐', icon: 'book' },
  { id: 'writing', name: '书写工具', icon: 'pen' },
  { id: 'desk', name: '桌面小物', icon: 'desk' },
  { id: 'carry', name: '收纳随行', icon: 'bag' },
]

// 金额以分保存，避免小数相加造成金额误差。
export const products = [
  { id: 'notebook', name: '原野 · 布面笔记本', category: 'paper', description: 'A5 / 横线内页 / 160 页', price: 2800, art: 'notebook', color: '#6e826d', background: '#eef0e9', badge: '小店精选' },
  { id: 'gel-pens', name: '日常 · 双色中性笔', category: 'writing', description: '0.5 mm / 黑色墨水 / 2 支装', price: 1200, art: 'pens', color: '#7d907c', background: '#f0eee8' },
  { id: 'spiral', name: '留白 · 线圈方格本', category: 'paper', description: 'A5 / 方格内页 / 100 页', price: 1800, art: 'spiral', color: '#bba17c', background: '#f4ede3', badge: '人气好物' },
  { id: 'pouch', name: '口袋 · 帆布笔袋', category: 'carry', description: '原色帆布 / 拉链收纳 / 20 cm', price: 2400, art: 'pouch', color: '#c6b995', background: '#efede6' },
  { id: 'highlighters', name: '柔光 · 淡彩荧光笔', category: 'writing', description: '柔和色系 / 双头设计 / 3 支装', price: 1500, art: 'highlighters', color: '#c7a17d', background: '#f3eae5' },
  { id: 'tape', name: '四季 · 和纸胶带', category: 'desk', description: '植物与格纹 / 15 mm / 3 卷装', price: 1600, art: 'tape', color: '#7f977e', background: '#ebefe8' },
  { id: 'planner', name: '一周 · 桌面计划本', category: 'paper', description: '自由日期 / 每周计划 / 52 页', price: 2200, art: 'planner', color: '#d0b594', background: '#f3efe6' },
  { id: 'pencils', name: '木语 · 原木铅笔', category: 'writing', description: 'HB / 六角笔杆 / 3 支装', price: 900, art: 'pencils', color: '#cda76e', background: '#eeeae2' },
  { id: 'clips', name: '点点 · 金属长尾夹', category: 'desk', description: '奶油配色 / 19 mm / 4 枚装', price: 800, art: 'clips', color: '#b9a987', background: '#eeeae3' },
  { id: 'tray', name: '安放 · 桌面收纳盘', category: 'carry', description: '浅口设计 / 雾面材质 / 米白色', price: 2600, art: 'tray', color: '#c6b8a1', background: '#edece5' },
  { id: 'notes', name: '灵感 · 便签纸套装', category: 'desk', description: '3 种颜色 / 可粘贴 / 共 150 张', price: 1000, art: 'notes', color: '#c0ba91', background: '#f1ede4' },
  { id: 'tote', name: '散步 · 帆布手提袋', category: 'carry', description: '棉质帆布 / 可放 A4 / 自然白', price: 3200, art: 'tote', color: '#c9bea3', background: '#eceee8' },
]

export function formatMoney(cents) {
  return (cents / 100).toFixed(2)
}
