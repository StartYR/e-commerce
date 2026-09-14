USE ecommerce;

START TRANSACTION;

-- The `all` entry in the frontend is a filter, not a persisted category.
INSERT INTO categories (id, name)
VALUES
  ('paper', '纸本手帐'),
  ('writing', '书写工具'),
  ('desk', '桌面小物'),
  ('carry', '收纳随行') AS incoming
ON DUPLICATE KEY UPDATE
  name = incoming.name;

-- Stock values were generated once and are fixed here. On repeated seed runs,
-- existing stock is deliberately preserved because inventory belongs to MySQL.
INSERT INTO products (
  id,
  category_id,
  name,
  description,
  price_cents,
  stock,
  is_active
)
VALUES
  ('notebook', 'paper', '原野 · 布面笔记本', 'A5 / 横线内页 / 160 页', 2800, 68, TRUE),
  ('gel-pens', 'writing', '日常 · 双色中性笔', '0.5 mm / 黑色墨水 / 2 支装', 1200, 50, TRUE),
  ('spiral', 'paper', '留白 · 线圈方格本', 'A5 / 方格内页 / 100 页', 1800, 66, TRUE),
  ('pouch', 'carry', '口袋 · 帆布笔袋', '原色帆布 / 拉链收纳 / 20 cm', 2400, 99, TRUE),
  ('highlighters', 'writing', '柔光 · 淡彩荧光笔', '柔和色系 / 双头设计 / 3 支装', 1500, 51, TRUE),
  ('tape', 'desk', '四季 · 和纸胶带', '植物与格纹 / 15 mm / 3 卷装', 1600, 62, TRUE),
  ('planner', 'paper', '一周 · 桌面计划本', '自由日期 / 每周计划 / 52 页', 2200, 86, TRUE),
  ('pencils', 'writing', '木语 · 原木铅笔', 'HB / 六角笔杆 / 3 支装', 900, 84, TRUE),
  ('clips', 'desk', '点点 · 金属长尾夹', '奶油配色 / 19 mm / 4 枚装', 800, 34, TRUE),
  ('tray', 'carry', '安放 · 桌面收纳盘', '浅口设计 / 雾面材质 / 米白色', 2600, 51, TRUE),
  ('notes', 'desk', '灵感 · 便签纸套装', '3 种颜色 / 可粘贴 / 共 150 张', 1000, 75, TRUE),
  ('tote', 'carry', '散步 · 帆布手提袋', '棉质帆布 / 可放 A4 / 自然白', 3200, 50, TRUE) AS incoming
ON DUPLICATE KEY UPDATE
  category_id = incoming.category_id,
  name = incoming.name,
  description = incoming.description,
  price_cents = incoming.price_cents,
  is_active = incoming.is_active;

COMMIT;
