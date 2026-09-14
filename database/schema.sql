CREATE DATABASE IF NOT EXISTS ecommerce
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

USE ecommerce;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  username VARCHAR(50) NOT NULL,
  email VARCHAR(254) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_username (username),
  UNIQUE KEY uq_users_email (email),
  CONSTRAINT chk_users_username_not_blank CHECK (CHAR_LENGTH(TRIM(username)) >= 3),
  CONSTRAINT chk_users_email_not_blank CHECK (CHAR_LENGTH(TRIM(email)) >= 3)
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS sessions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  token_hash BINARY(32) NOT NULL,
  expires_at DATETIME(6) NOT NULL,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uq_sessions_token_hash (token_hash),
  KEY idx_sessions_user_id (user_id),
  KEY idx_sessions_expires_at (expires_at),
  CONSTRAINT fk_sessions_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON UPDATE RESTRICT ON DELETE CASCADE
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS categories (
  id VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  name VARCHAR(100) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_categories_name (name),
  CONSTRAINT chk_categories_name_not_blank CHECK (CHAR_LENGTH(TRIM(name)) > 0)
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS products (
  id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  category_id VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  name VARCHAR(150) NOT NULL,
  description VARCHAR(500) NOT NULL,
  price_cents INT UNSIGNED NOT NULL,
  stock INT UNSIGNED NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  KEY idx_products_category_active (category_id, is_active),
  KEY idx_products_active_name (is_active, name),
  CONSTRAINT chk_products_name_not_blank CHECK (CHAR_LENGTH(TRIM(name)) > 0),
  CONSTRAINT chk_products_price_nonnegative CHECK (price_cents >= 0),
  CONSTRAINT chk_products_stock_nonnegative CHECK (stock >= 0),
  CONSTRAINT chk_products_is_active CHECK (is_active IN (FALSE, TRUE)),
  CONSTRAINT fk_products_category
    FOREIGN KEY (category_id) REFERENCES categories (id)
    ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS carts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uq_carts_user_id (user_id),
  CONSTRAINT fk_carts_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON UPDATE RESTRICT ON DELETE CASCADE
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS cart_items (
  cart_id BIGINT UNSIGNED NOT NULL,
  product_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  quantity SMALLINT UNSIGNED NOT NULL,
  PRIMARY KEY (cart_id, product_id),
  KEY idx_cart_items_product_id (product_id),
  CONSTRAINT chk_cart_items_quantity CHECK (quantity BETWEEN 1 AND 99),
  CONSTRAINT fk_cart_items_cart
    FOREIGN KEY (cart_id) REFERENCES carts (id)
    ON UPDATE RESTRICT ON DELETE CASCADE,
  CONSTRAINT fk_cart_items_product
    FOREIGN KEY (product_id) REFERENCES products (id)
    ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS orders (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  total_amount_cents BIGINT UNSIGNED NOT NULL,
  status VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'placed',
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  KEY idx_orders_user_created (user_id, created_at),
  KEY idx_orders_status_created (status, created_at),
  CONSTRAINT chk_orders_total_nonnegative CHECK (total_amount_cents >= 0),
  CONSTRAINT chk_orders_status_not_blank CHECK (CHAR_LENGTH(TRIM(status)) > 0),
  CONSTRAINT fk_orders_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS order_items (
  order_id BIGINT UNSIGNED NOT NULL,
  product_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  unit_price_cents INT UNSIGNED NOT NULL,
  PRIMARY KEY (order_id, product_id),
  KEY idx_order_items_product_id (product_id),
  CONSTRAINT chk_order_items_quantity_positive CHECK (quantity > 0),
  CONSTRAINT chk_order_items_price_nonnegative CHECK (unit_price_cents >= 0),
  CONSTRAINT fk_order_items_order
    FOREIGN KEY (order_id) REFERENCES orders (id)
    ON UPDATE RESTRICT ON DELETE CASCADE,
  CONSTRAINT fk_order_items_product
    FOREIGN KEY (product_id) REFERENCES products (id)
    ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE = InnoDB;
