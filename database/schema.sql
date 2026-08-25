-- Native MySQL schema for cPanel staging/production.
-- The API also creates these tables automatically on first request.

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  email VARCHAR(190) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(160) NOT NULL DEFAULT '',
  role VARCHAR(20) NOT NULL DEFAULT 'user',
  reset_token_hash CHAR(64) NULL,
  reset_token_expires_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY users_email_unique (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id BIGINT UNSIGNED NOT NULL,
  bio TEXT NOT NULL,
  hall_of_fame_opt_in TINYINT(1) NOT NULL DEFAULT 0,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  CONSTRAINT user_profiles_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_ai_settings (
  user_id BIGINT UNSIGNED NOT NULL,
  mode VARCHAR(24) NOT NULL DEFAULT 'global',
  provider_id VARCHAR(80) NOT NULL DEFAULT '',
  model VARCHAR(220) NOT NULL DEFAULT '',
  base_url VARCHAR(500) NOT NULL DEFAULT '',
  adapter VARCHAR(32) NOT NULL DEFAULT 'openai-compatible',
  auth_mode VARCHAR(20) NOT NULL DEFAULT 'bearer',
  api_key_encrypted LONGTEXT NOT NULL,
  headers_encrypted LONGTEXT NOT NULL,
  oauth_provider VARCHAR(80) NOT NULL DEFAULT '',
  oauth_access_token_encrypted LONGTEXT NOT NULL,
  oauth_refresh_token_encrypted LONGTEXT NOT NULL,
  oauth_expires_at DATETIME NULL,
  allow_local TINYINT(1) NOT NULL DEFAULT 0,
  supports_vision TINYINT(1) NOT NULL DEFAULT 0,
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  CONSTRAINT user_ai_settings_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS auth_rate_limits (
  bucket_key VARCHAR(190) NOT NULL,
  attempts INT UNSIGNED NOT NULL DEFAULT 0,
  window_started_at BIGINT UNSIGNED NOT NULL,
  blocked_until BIGINT UNSIGNED NULL,
  updated_at BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (bucket_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS course_modules (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  level_number TINYINT UNSIGNED NOT NULL,
  level_name VARCHAR(160) NOT NULL DEFAULT '',
  module_number SMALLINT UNSIGNED NOT NULL,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(160) NOT NULL DEFAULT '',
  summary TEXT NOT NULL,
  content MEDIUMTEXT NOT NULL,
  video_script TEXT NOT NULL,
  video_url TEXT NULL,
  learning_objectives LONGTEXT NOT NULL,
  key_takeaways LONGTEXT NOT NULL,
  checklist LONGTEXT NOT NULL,
  practical_assignment TEXT NOT NULL,
  sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY course_modules_number_unique (module_number),
  KEY course_modules_order_idx (sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS quiz_questions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  module_number SMALLINT NOT NULL,
  question TEXT NOT NULL,
  options LONGTEXT NOT NULL,
  correct_index TINYINT UNSIGNED NOT NULL DEFAULT 0,
  explanation TEXT NOT NULL,
  difficulty VARCHAR(20) NOT NULL DEFAULT 'medium',
  type VARCHAR(20) NOT NULL DEFAULT 'mcq',
  learning_objective TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY quiz_questions_module_idx (module_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_progress (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  module_number SMALLINT NOT NULL,
  completed TINYINT(1) NOT NULL DEFAULT 0,
  quiz_score SMALLINT NULL,
  quiz_total SMALLINT NULL,
  practical_done TINYINT(1) NOT NULL DEFAULT 0,
  time_spent_minutes INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY user_progress_unique (user_id, module_number),
  CONSTRAINT user_progress_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS certificates (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  level_number TINYINT UNSIGNED NOT NULL,
  level_name VARCHAR(190) NOT NULL,
  score DECIMAL(5,2) NOT NULL DEFAULT 0,
  exam_type VARCHAR(20) NOT NULL,
  holder_name VARCHAR(190) NOT NULL DEFAULT '',
  issued_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY certificates_unique (user_id, level_number, exam_type),
  CONSTRAINT certificates_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS farm_data (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  week SMALLINT UNSIGNED NOT NULL,
  hen_day_production DECIMAL(8,3) NULL,
  feed_intake DECIMAL(10,3) NULL,
  egg_weight DECIMAL(10,3) NULL,
  mortality DECIMAL(8,3) NULL,
  water_intake DECIMAL(10,3) NULL,
  temperature DECIMAL(8,3) NULL,
  humidity DECIMAL(8,3) NULL,
  revenue DECIMAL(18,2) NULL,
  cost DECIMAL(18,2) NULL,
  fcr DECIMAL(8,3) NULL,
  notes TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY farm_data_user_week_idx (user_id, week),
  CONSTRAINT farm_data_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ai_conversations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(180) NOT NULL DEFAULT 'Percakapan baru',
  last_message_preview VARCHAR(280) NOT NULL DEFAULT '',
  message_count INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ai_conversations_user_updated_idx (user_id, updated_at),
  CONSTRAINT ai_conversations_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ai_chat_messages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  conversation_id BIGINT UNSIGNED NOT NULL,
  role VARCHAR(16) NOT NULL,
  content MEDIUMTEXT NOT NULL,
  provider VARCHAR(80) NULL,
  model VARCHAR(190) NULL,
  used_fallback TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ai_chat_messages_conversation_idx (conversation_id, id),
  CONSTRAINT ai_chat_messages_conversation_fk FOREIGN KEY (conversation_id) REFERENCES ai_conversations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS app_settings (
  setting_key VARCHAR(100) NOT NULL,
  setting_value LONGTEXT NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
